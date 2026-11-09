"use strict";
const crypto=require("node:crypto");
const jobs=new Map();
let lastWorkerSeen=0,lastWorkerReady=false,processed=0;
const MAX_PENDING=36;
const SECRET=String(process.env.ULTRON_BRIDGE_SECRET||"");
const available=()=>SECRET.length>=40;
function permitted(req){
  if(!available())return false;
  const header=String(req.get("authorization")||"");
  const supplied=header.startsWith("Bearer ")?header.slice(7):"";
  const a=Buffer.from(supplied),b=Buffer.from(SECRET);
  return a.length===b.length&&crypto.timingSafeEqual(a,b);
}
function status(){
 const connected=available()&&Date.now()-lastWorkerSeen<14000;
 return {connected,ready:connected&&lastWorkerReady,pending:jobs.size,processed};
}
function heartbeat(req){
 lastWorkerSeen=Date.now();
 lastWorkerReady=req.get("x-ultron-model-ready")==="1";
}
async function submit(payload){
 if(jobs.size>=MAX_PENDING)throw Error("busy");
 return new Promise(resolve=>{
  const id=crypto.randomBytes(20).toString("hex");
  const timer=setTimeout(()=>{if(jobs.delete(id))resolve({timeout:true})},33000);
  timer.unref?.();
  jobs.set(id,{id,payload,resolve,timer,createdAt:Date.now(),leased:false});
 });
}
function next(req){
 if(!permitted(req))return {error:"unauthorized"};
 heartbeat(req);
 if(!lastWorkerReady)return{job:null};
 for(const job of jobs.values()){
   if(!job.leased){
     job.leased=true;
     return{job:{id:job.id,mode:job.payload.mode,message:job.payload.message,context:job.payload.context,history:job.payload.history}};
   }
 }
 return{job:null};
}
function complete(req){
 if(!permitted(req))return{error:"unauthorized"};
 heartbeat(req);
 const id=String(req.body?.id||""),value=req.body?.answer,job=jobs.get(id);
 if(!job||!job.leased)return{ok:false};
 if(typeof value!=="string"||value.length>8000)return{ok:false};
 jobs.delete(id);
 clearTimeout(job.timer);
 processed++;
 job.resolve({answer:value.trim().slice(0,3500)});
 return{ok:true};
}
module.exports={submit,next,complete,status,permitted,available};
