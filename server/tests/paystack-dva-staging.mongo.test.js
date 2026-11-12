"use strict";
// Disposable localhost replica-set test; no live Paystack calls, no real money.
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const mongoose=require("mongoose");
const User=require("../models/User");
const VirtualBankAccount=require("../models/VirtualBankAccount");
const WalletTransaction=require("../models/WalletTransaction");
const Notification=require("../models/Notification");
const provider=require("../services/paystackDvaService");
const controller=require("../controllers/virtualAccountController");
const secret="sk_test_"+crypto.randomBytes(20).toString("hex");
process.env.PAYSTACK_SECRET_KEY=secret;
process.env.PAYSTACK_DVA_ENABLED="true";
const currencyAmount=180000; // ₦1,800.00 represented in kobo.
const customerEmail="test-"+crypto.randomBytes(4).toString("hex")+"@example.invalid";
function reply(){return{code:200,result:null,
  set(){return this},status(code){this.code=code;return this},
  json(result){this.result=result;return this},
  sendStatus(code){this.code=code;return this}}}
function signed(event){
 const raw=Buffer.from(JSON.stringify(event));
 const signature=crypto.createHmac("sha512",secret).update(raw).digest("hex");
 return{body:raw,headers:{"x-paystack-signature":signature}};
}
async function main(){
 const customer=await User.create({firstName:"Test",lastName:"Customer",email:customerEmail,
   phone:"08030000000",password:"staging-password",role:"user",isActive:true,emailVerified:true,walletBalanceKobo:0});
 const userRequest={user:{_id:customer._id,role:"user",emailVerified:true},
   body:{consent:true}};
 let calls=0;
 const actualAssign=provider.assign,actualVerify=provider.verifyTransaction;
 provider.assign=async details=>{
   calls++;
   assert.equal(details.email,customer.email);
   return {};
 };
 provider.verifyTransaction=async ref=>{
   assert.equal(ref,"test-verified-transfer-001");
   return{reference:ref,amount:currencyAmount,currency:"NGN",status:"success",
     authorization:{channel:"dedicated_nuban",receiver_bank_account_number:"0123456789"},
     customer:{email:customerEmail}};
 };
 try{
   let result=reply();await controller.assign({user:userRequest.user,body:{}},result);
   assert.equal(result.code,400,"Creation requires opt-in consent.");
   result=reply();await controller.assign(userRequest,result);
   assert.equal(result.code,202,JSON.stringify(result.result));
   assert.equal(calls,1);
   const again=reply();await controller.assign(userRequest,again);
   assert.equal(again.code,200);
   assert.equal(calls,1,"Assignment must be idempotent.");
   assert.equal((await VirtualBankAccount.findOne({user:customer._id})).status,"pending");
   const accountEvent={event:"dedicatedaccount.assign.success",data:{
     customer:{email:customerEmail,customer_code:"CUS_STAGING"},
     dedicated_account:{account_number:"0123456789",account_name:"WAYNE LOGS / CUSTOMER",
       bank:{name:"Test Bank",slug:"test-bank"},id:5,active:true,currency:"NGN"}
   }};
   result=reply();await controller.webhook(signed(accountEvent),result);
   assert.equal(result.code,200);
   let account=await VirtualBankAccount.findOne({user:customer._id});
   assert.equal(account.status,"active");
   assert.equal(account.accountNumber,"0123456789");
   const fraud={event:"charge.success",data:{
     reference:"test-verified-transfer-001",status:"success",currency:"NGN",amount:currencyAmount,
     authorization:{channel:"dedicated_nuban",receiver_bank_account_number:"0123456789"},
     customer:{email:customerEmail}
   }};
   result=reply();await controller.webhook({
     body:Buffer.from(JSON.stringify(fraud)),headers:{"x-paystack-signature":"0".repeat(128)}
   },result);
   assert.equal(result.code,401,"Unsigned or forged webhook must fail.");
   assert.equal((await User.findById(customer._id)).walletBalanceKobo,0);
   result=reply();await controller.webhook(signed(fraud),result);
   assert.equal(result.code,200);
   assert.equal((await User.findById(customer._id)).walletBalanceKobo,currencyAmount);
   assert.equal(await WalletTransaction.countDocuments({provider:"paystack_dva"}),1);
   assert.equal(await Notification.countDocuments({user:customer._id,type:"wallet"}),1);
   result=reply();await controller.webhook(signed(fraud),result);
   assert.equal(result.code,200,"Duplicate webhook should be acknowledged.");
   assert.equal((await User.findById(customer._id)).walletBalanceKobo,currencyAmount,
     "Balance must not double credit for replayed transfers.");
   assert.equal(await WalletTransaction.countDocuments({provider:"paystack_dva"}),1);
   const foreign={...fraud,data:{...fraud.data,
     authorization:{channel:"dedicated_nuban",receiver_bank_account_number:"9876543210"}}};
   result=reply();await controller.webhook(signed(foreign),result);
   assert.equal(result.code,200);
   assert.equal((await User.findById(customer._id)).walletBalanceKobo,currencyAmount);
   console.log("PASS: disposable Paystack DVA: consent, account assignment, forged-webhook rejection, verified credit, replay safety.");
 }finally{provider.assign=actualAssign;provider.verifyTransaction=actualVerify}
}
(async()=>{
 assert.equal(process.env.CI,"true");assert.equal(process.env.WAYNE_RUN_DISPOSABLE_DB_TESTS,"1");
 const databaseName="wayne_dva_ci_"+crypto.randomBytes(5).toString("hex");
 await mongoose.connect("mongodb://127.0.0.1:27017/?replicaSet=rs0&directConnection=true",
   {dbName:databaseName,serverSelectionTimeoutMS:15000});
 try{
   await Promise.all([User,VirtualBankAccount,WalletTransaction,Notification].map(m=>m.init()));
   await main();
 }finally{try{await mongoose.connection.dropDatabase()}finally{await mongoose.disconnect()}}
})().catch(e=>{console.error(e);process.exitCode=1});
