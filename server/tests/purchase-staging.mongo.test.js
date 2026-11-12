"use strict";
// Real MongoDB replica-set integration tests, run only against a throwaway
// localhost database. No credentials, live balances, email or external payments.
const assert=require("node:assert/strict");
const mongoose=require("mongoose");
const crypto=require("node:crypto");
const mongoUrl="mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true";
const dbName="wayne_checkout_ci_"+crypto.randomBytes(5).toString("hex");
const User=require("../models/User");
const Product=require("../models/Product");
const Order=require("../models/Order");
const WalletTransaction=require("../models/WalletTransaction");
const InventoryItem=require("../models/InventoryItem");
const Notification=require("../models/Notification");
const SiteSetting=require("../models/SiteSetting");
const Referral=require("../models/Referral");
const inv=require("../services/inventoryCrypto");
const controller=require("../controllers/orderController");
process.env.INVENTORY_ENCRYPTION_KEY="STAGING_ONLY_"+crypto.randomBytes(32).toString("hex");
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;
delete process.env.PAYSTACK_SECRET_KEY;
let last=0;
function response(){return {statusCode:200,payload:null,
  status(code){this.statusCode=code;return this},
  json(body){this.payload=body;return this},
  sendStatus(code){this.statusCode=code;return this}
}}
const req=(user,id,body={})=>({user:{_id:user._id,email:user.email},params:{id:String(id)},body,headers:{}});
const wallet=async(user,id)=>{const res=response();await controller.payWithWallet(req(user,id),res);return res};
const mine=async user=>{const res=response();await controller.mine(req(user,"unused"),res);return res};
async function product(name,price=1250,stock=1,managed=true){
  const p=await Product.create({name,platform:"Demo",type:"social",
    price,currency:"NGN",stock,status:"active",deliveryType:"instant",
    inventoryManaged:managed,privateDelivery:managed?"":"DEMO-ONLY"});
  if(managed)for(let i=0;i<stock;i++){
    const content="TEST-DELIVERY-"+name+"-"+i;
    await InventoryItem.create({product:p._id,fingerprint:inv.fingerprint(content),encryptedContent:inv.encrypt(content)});
  }
  return p;
}
async function order(user,p,changes={}){
  return Order.create({user:user._id,product:p._id,productName:p.name,
    unitPrice:p.price,totalAmount:p.price,currency:p.currency,
    quantity:1,...changes});
}
async function user(name,balance=500000){
  return User.create({firstName:name,lastName:"Test",email:name.toLowerCase()+"@example.invalid",
    phone:"0000000000",password:"staging-password-only",walletBalanceKobo:balance,
    role:"user",isActive:true,emailVerified:true});
}
async function execute(){
  const customer=await user("Customer",500000);
  const admin=await User.create({firstName:"Admin",lastName:"Test",role:"admin",
    email:"admin@example.invalid",phone:"0000000000",password:"staging-password-only"});
  const item=await product("InstantOne",1250,1,true);
  const a=await order(customer,item);

  let result=await wallet(customer,a._id);
  assert.equal(result.statusCode,200,JSON.stringify(result.payload));
  assert.equal(result.payload?.order?.paymentStatus,"paid");
  assert.equal(result.payload?.order?.status,"completed");
  let after=await User.findById(customer._id);
  assert.equal(after.walletBalanceKobo,375000,"Wallet should be debited exactly once.");
  assert.equal((await Product.findById(item._id)).stock,0);
  assert.equal(await WalletTransaction.countDocuments({order:a._id,type:"purchase"}),1);
  const assigned=await InventoryItem.findOne({product:item._id,status:"sold"});
  assert.equal(String(assigned.soldTo),String(customer._id));
  assert.equal(String(assigned.order),String(a._id));
  const orderView=await mine(customer);
  assert.equal(orderView.statusCode,200);
  assert.match(orderView.payload.orders[0].deliveryContent,/TEST-DELIVERY-InstantOne-0/);
  assert.equal(await Notification.countDocuments({user:customer._id,key:"purchase:"+a._id}),1);
  assert.equal(await Notification.countDocuments({user:admin._id,key:"admin-purchase:"+a._id}),1);
  result=await wallet(customer,a._id);
  assert.equal(result.statusCode,200,"Replaying paid order should succeed without a debit.");
  assert.equal((await User.findById(customer._id)).walletBalanceKobo,375000);
  assert.equal(await WalletTransaction.countDocuments({order:a._id,type:"purchase"}),1);

  // Cancelled and refunded orders are terminal; a ref cannot start another debit.
  const terminalProduct=await product("Terminal",200,2,true);
  for(const state of [{status:"cancelled"},{status:"refunded",paymentStatus:"refunded"},
    {status:"pending",paymentReference:"EXT-STARTED"}]){
    const pending=await order(customer,terminalProduct,state);
    const reply=await wallet(customer,pending._id);
    assert.equal(reply.statusCode,409,JSON.stringify({state,reply:reply.payload}));
  }
  assert.equal((await User.findById(customer._id)).walletBalanceKobo,375000);
  assert.equal((await Product.findById(terminalProduct._id)).stock,2);

  // Price change must not quietly debit yesterday's order.
  const repriced=await product("Repriced",300,1,true);
  const staleOrder=await order(customer,repriced);
  await Product.updateOne({_id:repriced._id},{$set:{price:320}});
  result=await wallet(customer,staleOrder._id);
  assert.equal(result.statusCode,409);
  assert.equal((await User.findById(customer._id)).walletBalanceKobo,375000);
  assert.equal((await Product.findById(repriced._id)).stock,1);

  // Insufficient wallet: inventory assignment & stock decrement must roll back.
  const poor=await user("Underfunded",0);
  const limited=await product("Rollback",400,1,true);
  const poorOrder=await order(poor,limited);
  result=await wallet(poor,poorOrder._id);
  assert.equal(result.statusCode,409);
  assert.equal((await Product.findById(limited._id)).stock,1);
  assert.equal(await InventoryItem.countDocuments({product:limited._id,status:"available"}),1);
  assert.equal(await WalletTransaction.countDocuments({order:poorOrder._id}),0);

  // Two different buyers must never receive the same one-use credential.
  const rival=await user("Rival",500000);
  const scarce=await product("Scarce",250,1,true);
  const first=await order(customer,scarce),second=await order(rival,scarce);
  const races=await Promise.all([wallet(customer,first._id),wallet(rival,second._id)]);
  const latestOrders=await Order.find({_id:{$in:[first._id,second._id]}});
  assert.equal(latestOrders.filter(o=>o.paymentStatus==="paid").length,1,
    "Exactly one customer may pay for one unique stock record.");
  assert.equal(await WalletTransaction.countDocuments({order:{$in:[first._id,second._id]},type:"purchase"}),1);
  assert.equal(await InventoryItem.countDocuments({product:scarce._id,status:"sold"}),1);
  assert.equal((await Product.findById(scarce._id)).stock,0);
  assert(races.some(r=>r.statusCode===200));
  const winner=latestOrders.find(o=>o.paymentStatus==="paid");
  const loser=latestOrders.find(o=>o.paymentStatus!=="paid");
  assert(winner&&loser);
  const received=await mine(String(winner.user)===String(customer._id)?customer:rival);
  assert(received.payload.orders.some(o=>String(o._id)===String(winner._id)&&o.deliveryContent));

  // Separate Paystack verification: stub provider response, no HTTP request.
  const external=await product("ExternalPaid",670,1,true);
  const externalRef="WL-STAGING-FAKE-REFERENCE";
  const externalOrder=await order(customer,external,{paymentReference:externalRef,paymentMethod:"paystack"});
  process.env.PAYSTACK_SECRET_KEY="NOT_A_REAL_SECRET_STAGING_ONLY";
  const originalFetch=global.fetch;
  let providerCalls=0;
  global.fetch=async url=>{
    assert.equal(url,"https://api.paystack.co/transaction/verify/"+externalRef);
    providerCalls++;
    return {ok:true,json:async()=>({status:true,data:{
      status:"success",reference:externalRef,amount:67000,currency:"NGN",
      metadata:{orderId:String(externalOrder._id),userId:String(customer._id)}
    }})};
  };
  try{
    const res=response();
    await controller.verify(req(customer,externalOrder._id,{reference:externalRef}),res);
    assert.equal(res.statusCode,200,JSON.stringify(res.payload));
    assert.equal(res.payload.order.paymentStatus,"paid");
    assert.equal(res.payload.order.status,"completed");
    const again=response();
    await controller.verify(req(customer,externalOrder._id,{reference:externalRef}),again);
    assert.equal(again.statusCode,200);
    assert.equal(providerCalls,1);
  }finally{global.fetch=originalFetch;delete process.env.PAYSTACK_SECRET_KEY;}
  assert.equal((await Product.findById(external._id)).stock,0);
  assert.equal(await InventoryItem.countDocuments({product:external._id,status:"sold"}),1);
  assert.equal(await Notification.countDocuments({user:admin._id,key:"admin-purchase:"+externalOrder._id}),1);
  assert.equal(await WalletTransaction.countDocuments({order:externalOrder._id}),0,
    "Paystack payment must not create a wallet debit.");
  console.log("PASS: disposable MongoDB transactions: wallet, delivery, order lookup, replay, refunds, stock races, rollback and simulated Paystack.");
}
(async()=>{
  assert.equal(process.env.WAYNE_RUN_DISPOSABLE_DB_TESTS,"1",
    "Refusing to run against anything except the explicitly enabled isolated CI replica set.");
  assert.equal(process.env.CI,"true","These tests are restricted to CI.");
  await mongoose.connect(mongoUrl,{dbName,serverSelectionTimeoutMS:15000});
  try{
    await Promise.all([User,Product,Order,WalletTransaction,InventoryItem,Notification,SiteSetting,Referral].map(m=>m.init()));
    await execute();
  }finally{
    // Drop only the uniquely named, never-production staging database.
    try{await mongoose.connection.dropDatabase()}finally{await mongoose.disconnect()}
  }
})().catch(error=>{console.error(error);process.exitCode=1});
