"use strict";
const r=require("express").Router();
const {protect}=require("../middleware/authMiddleware");
const Product=require("../models/Product");
const Order=require("../models/Order");
const User=require("../models/User");
const WalletTransaction=require("../models/WalletTransaction");
const bridge=require("../services/ultronBridgeQueue");
const local=require("../services/ultronStoreService");
const usage=new Map();
function respondError(res,e){return res.status(503).json({message:"ULTRON AI is currently unavailable. Basic store help remains available."});}
function remaining(user){
 const key=String(user._id),now=Date.now(),day=Math.floor(now/86400000),row=usage.get(key);
 const total=row?.day===day?row.count:0;
 const limit=user.role==="user"?35:90;
 if(total>=limit)return false;
 usage.set(key,{day,count:total+1});
 if(usage.size>2000)for(const [k,v] of usage)if(v.day!==day)usage.delete(k);
 return true;
}
async function context(mode){
 const products=await Product.find({status:"active"}).select("name platform price stock deliveryType").sort({createdAt:-1}).limit(35).lean();
 const catalog=products.map(p=>({name:String(p.name||"").slice(0,85),platform:String(p.platform||"").slice(0,30),price:Number(p.price||0),stock:Number(p.stock||0),deliveryType:p.deliveryType}));
 if(mode==="customer")return{store:"WAYNE LOGS",currency:"NGN",catalog:catalog.slice(0,22),policies:"Manual bank funding requires administrator verification. A screenshot is not proof of a completed payment. Refund requests require review. Never ask for customer passwords."};
 const [users,paidOrders,pendingOrders,pendingTransfers,failedTransfers,refunds,totals]=await Promise.all([
  User.countDocuments({role:"user"}),
  Order.countDocuments({paymentStatus:"paid"}),
  Order.countDocuments({status:{$in:["pending","processing"]},paymentStatus:"paid"}),
  WalletTransaction.countDocuments({provider:"manual_bank",status:"submitted"}),
  WalletTransaction.countDocuments({status:{$in:["failed","rejected"]}}),
  Order.countDocuments({status:"refunded"}),
  Order.aggregate([{$match:{paymentStatus:"paid"}},{$group:{_id:null,totalSales:{$sum:"$totalAmount"},count:{$sum:1}}}])
 ]);
 return{store:"WAYNE LOGS",currency:"NGN",customers:users,paidOrders,pendingPaidOrders:pendingOrders,pendingManualTransferReviews:pendingTransfers,failedOrRejectedTransactions:failedTransfers,refundedOrders:refunds,grossPaidOrderValueNGN:totals[0]?.totalSales||0,catalog,important:"Read-only summary data. No personal data, credentials, internal secrets, customer emails or transaction references are provided. Gross order value is not business profit."};
}
function historyOf(raw){
 if(!Array.isArray(raw))return[];
 return raw.slice(-6).filter(v=>v&&["user","assistant"].includes(v.role)&&typeof v.content==="string").map(v=>({role:v.role,content:v.content.slice(0,800)}));
}
r.get("/status",(req,res)=>{res.set("Cache-Control","no-store");const s=bridge.status();res.json({success:true,connected:s.connected,aiReady:s.ready,mode:s.ready?"ultron-ai":"store-help"})});
r.post("/bridge/next",(req,res)=>{
 res.set("Cache-Control","no-store");
 const result=bridge.next(req);
 return result.error?res.status(401).json({message:"Unauthorized"}):res.json(result);
});
r.post("/bridge/complete",(req,res)=>{
 res.set("Cache-Control","no-store");
 const result=bridge.complete(req);
 return result.error?res.status(401).json({message:"Unauthorized"}):res.json(result);
});
r.post("/chat",protect,async(req,res)=>{
 res.set("Cache-Control","no-store");
 const message=typeof req.body?.message==="string"?req.body.message.trim():"";
 const mode=["customer","admin","creator"].includes(req.body?.mode)?req.body.mode:"customer";
 if(message.length<2||message.length>650)return res.status(400).json({message:"Your question must be 2–650 characters long."});
 if(mode!=="customer"&&req.user.role!=="admin")return res.status(403).json({message:"Only the administrator can use this ULTRON mode."});
 if(mode==="creator"&&!req.user.totpEnabled)return res.status(403).json({message:"Enable administrator two-factor authentication before using creator mode."});
 if(!remaining(req.user))return res.status(429).json({message:"Your ULTRON AI daily allowance has been reached. Use store help or try again tomorrow."});
 const worker=bridge.status();
 if(!worker.ready)return res.status(503).json({message:"ULTRON's AI connection is offline. Store Help remains available."});
 try{
  const info=await context(mode);
  const result=await bridge.submit({mode,message:message.slice(0,650),context:info,history:historyOf(req.body?.history)});
  if(result.timeout)return res.status(504).json({message:"ULTRON did not respond in time. Please try again."});
  return res.json({success:true,mode,provider:"ultron-worker",answer:result.answer});
 }catch(error){console.error("ULTRON AI chat failed:",String(error?.name||"queue_error").slice(0,80));return respondError(res,error);}
});
module.exports=r;
