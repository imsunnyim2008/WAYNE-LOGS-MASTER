"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const source=fs.readFileSync(path.join(__dirname,"../services/ultronCustomerService.js"),"utf8");
const calls=[];
function chain(result){return{select(){return this},sort(){return this},limit(){return this},lean:async()=>result}}
const data={
  "../models/Order":{find:q=>{calls.push({type:"order",query:q});return chain([{productName:"Purchased 1",status:"completed",paymentStatus:"paid"}])}},
  "../models/WalletTransaction":{find:q=>{calls.push({type:"transaction",query:q});return chain([{amountKobo:40000,type:"deposit",status:"completed"}])}},
  "../models/User":{findById:id=>{calls.push({type:"user",id});return chain({isActive:true,walletBalanceKobo:789000})}},
  "../models/Product":{find:q=>{calls.push({type:"product",query:q});return chain([{name:"Test item",price:300}])}}
};
const moduleRef={exports:{}};
vm.runInNewContext(source,{module:moduleRef,exports:moduleRef.exports,require:id=>data[id]});
const service=moduleRef.exports;
(async()=>{
 assert.equal(service.intentFor("Where is my order?"),"orders");
 assert.equal(service.intentFor("What is my wallet balance?"),"balance");
 assert.equal(service.intentFor("Show my recent transactions"),"transactions");
 assert.equal(service.intentFor("Can you send money from my wallet now?"),"action");
 assert.equal(service.intentFor("Just saying hello"),null);
 const id="customer-A";
 const o=await service.answer({message:"Where are my orders?",userId:id});
 assert.equal(o.handled,true);
 assert.match(o.answer,/Purchased 1/);
 assert(!o.answer.includes("deliveryContent")&&!o.answer.includes("password"));
 const balance=await service.answer({message:"What is my wallet balance?",userId:id});
 assert.match(balance.answer,/7,890/);
 const tx=await service.answer({message:"Show my recent transactions",userId:id});
 assert.match(tx.answer,/400/);
 const action=await service.answer({message:"Please send money from my wallet now",userId:id});
 assert.match(action.answer,/cannot transfer/i);
 assert(calls.filter(c=>c.type==="order"||c.type==="transaction").every(c=>c.query.user===id),
  "User records must only be queried by authenticated account id.");
 assert(calls.filter(c=>c.type==="user").every(c=>c.id===id));
 const routes=fs.readFileSync(path.join(__dirname,"../routes/ultronAiRoutes.js"),"utf8");
 assert(routes.includes('r.post("/customer-help",protect'));
 assert(routes.includes("userId:req.user._id"));
 const chat=fs.readFileSync(path.join(__dirname,"../../ultron-store.js"),"utf8");
 assert(chat.includes("/api/ultron/ai/customer-help"));
 for(const file of ["config.js","feedback.js"]){
   const js=fs.readFileSync(path.join(__dirname,"../../"+file),"utf8");
   assert(js.includes("customer-help"),file+" must silence global success popup.");
 }
 console.log("ULTRON private account help, user-scoping, read-only and popup regression tests passed.");
})().catch(e=>{console.error(e);process.exitCode=1});
