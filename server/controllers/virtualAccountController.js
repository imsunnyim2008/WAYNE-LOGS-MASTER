"use strict";
// Merchant-owned, opt-in Paystack Dedicated Virtual Accounts. This is NOT a
// withdrawable bank account. Never credit wallets from client claims or screenshots.
const mongoose=require("mongoose");
const User=require("../models/User");
const WalletTransaction=require("../models/WalletTransaction");
const VirtualAccount=require("../models/VirtualBankAccount");
const Notification=require("../models/Notification");
const notifications=require("../services/notificationService");
const paystack=require("../services/paystackDvaService");

const publicAccount=row=>row&&row.status==="active"?{
  status:"active",bankName:row.bankName,accountName:row.accountName,
  accountNumber:row.accountNumber,currency:"NGN"
}:{status:row?.status||"none"};

exports.info=async(req,res)=>{
  res.set("Cache-Control","no-store");
  try{
    if(!paystack.enabled())return res.json({success:true,enabled:false,status:"unavailable",
      message:"Dedicated bank account funding is not enabled. Use the existing funding methods."});
    const row=await VirtualAccount.findOne({user:req.user._id}).lean();
    return res.json({success:true,enabled:true,account:publicAccount(row),
      message:row?.status==="pending"?"Your bank account request is being processed by Paystack.":undefined});
  }catch(error){return res.status(503).json({message:"Bank-account status is temporarily unavailable."})}
};

exports.assign=async(req,res)=>{
  res.set("Cache-Control","no-store");
  if(!paystack.enabled())return res.status(503).json({message:"Dedicated bank accounts are not yet enabled for WAYNE LOGS."});
  if(req.user?.role!=="user"||req.user?.emailVerified!==true)return res.status(403).json({message:"Verify a customer email address first."});
  if(req.body?.consent!==true)return res.status(400).json({message:"You must consent to sharing your registered account name, email and phone with Paystack for bank account creation."});
  try{
    const customer=await User.findById(req.user._id).select("firstName lastName email phone isActive emailVerified").lean();
    if(!customer?.isActive||customer.emailVerified!==true)return res.status(403).json({message:"Your customer account is not verified."});
    if(!customer.firstName||!customer.lastName||!customer.phone||!customer.email)return res.status(400).json({message:"Complete your profile name, phone and email first."});
    const existing=await VirtualAccount.findOne({user:req.user._id});
    if(existing)return res.json({success:true,account:publicAccount(existing),
      message:existing.status==="failed"?"The bank assignment requires review. Contact Support; do not keep retrying.":"Your bank account request already exists."});
    // Unique user index blocks parallel create requests from assigning multiple accounts.
    let created;
    try{
      created=await VirtualAccount.create({user:req.user._id,customerEmail:customer.email,status:"pending"});
    }catch(error){
      if(error?.code===11000)return res.status(409).json({message:"Your account request is already being processed. Refresh to see its status."});
      throw error;
    }
    try{
      const response=await paystack.assign({
        email:customer.email,firstName:customer.firstName,lastName:customer.lastName,
        phone:customer.phone
      });
      // Assignment is asynchronous. A signed dedicatedaccount.assign.success
      // event must arrive before any bank number can be displayed.
      return res.status(202).json({success:true,account:publicAccount(created),
        message:"Account request sent. Paystack will confirm the bank details shortly."});
    }catch(error){
      await VirtualAccount.updateOne({_id:created._id,status:"pending"},{$set:{status:"failed"}}).catch(()=>{});
      return res.status(503).json({message:"Paystack could not create an account for this business/customer. Check eligibility or contact Support."});
    }
  }catch(error){
    console.error("DVA request failed:",String(error?.name||"unknown"));
    return res.status(503).json({message:"Could not request a dedicated bank account."});
  }
};

async function bankAssigned(event){
  const normalized=paystack.normalizeAssignment(event);
  if(!normalized)return;
  const row=await VirtualAccount.findOne({customerEmail:normalized.email,status:{$in:["pending","active"]}});
  if(!row)return;
  if(row.status==="active"&&row.accountNumber!==normalized.number)return;
  await VirtualAccount.updateOne({_id:row._id,customerEmail:normalized.email,
    $or:[{accountNumber:{$exists:false}},{accountNumber:normalized.number}]},
    {$set:{status:"active",accountNumber:normalized.number,bankName:normalized.bankName,
      accountName:normalized.accountName,bankSlug:normalized.bankSlug,
      externalId:normalized.externalId,customerCode:normalized.customerCode,assignedAt:new Date()}});
}
async function bankAssignFailed(event){
  const email=String(event?.data?.customer?.email||event?.data?.email||"").toLowerCase().trim();
  if(!email)return;
  await VirtualAccount.updateOne({customerEmail:email,status:"pending"},{$set:{status:"failed"}});
}

async function depositReceived(event){
  const data=event?.data||{};
  const auth=data.authorization||{};
  if(String(auth.channel||data.channel||"").toLowerCase()!=="dedicated_nuban")return;
  const accountNumber=String(auth.receiver_bank_account_number||"");
  if(!/^\d{10}$/.test(accountNumber))return;
  const account=await VirtualAccount.findOne({accountNumber,status:"active"}).lean();
  if(!account)return;
  const ref=String(data.reference||"");
  if(!/^[a-zA-Z0-9._-]{5,120}$/.test(ref))return;
  // Do not trust the webhook payload amount. Requery Paystack's API and
  // confirm its account number, customer email, channel, status & currency.
  const verified=await paystack.verifyTransaction(ref);
  if(!paystack.verifiedTransfer(verified,account))return;
  const amount=Number(verified.amount);
  const uniqueRef="DVA-"+ref;
  const session=await mongoose.startSession();
  let creditedUser=null;
  try{
    await session.withTransaction(async()=>{
      if(await WalletTransaction.exists({reference:uniqueRef}).session(session))return;
      const user=await User.findOneAndUpdate({_id:account.user,role:"user",isActive:true},
        {$inc:{walletBalanceKobo:amount}},{new:true,session});
      if(!user)throw new Error("CUSTOMER_UNAVAILABLE");
      await WalletTransaction.create([{user:user._id,type:"deposit",status:"completed",
        amountKobo:amount,currency:"NGN",reference:uniqueRef,provider:"paystack_dva",
        providerReference:ref,description:"Verified bank transfer to dedicated account",
        balanceAfterKobo:user.walletBalanceKobo,verifiedAt:new Date()}],{session});
      creditedUser=user._id;
    });
  }catch(error){
    // A duplicate webhook in a parallel worker may hit the unique reference
    // index; the whole losing transaction is rolled back without a second credit.
    if(error?.code!==11000)throw error;
  }finally{await session.endSession()}
  if(creditedUser){
    await notifications.create({user:creditedUser,type:"wallet",title:"Bank transfer received",
      message:"Your verified transfer of ₦"+(amount/100).toLocaleString("en-NG")+" was added to your store wallet.",
      link:"dashboard.html",key:"paystack-dva:"+ref}).catch(()=>{});
  }
}
exports.webhook=async(req,res)=>{
  res.set("Cache-Control","no-store");
  if(!paystack.verifySignature(req.body,req.headers))return res.sendStatus(401);
  let event;
  try{event=JSON.parse(req.body.toString("utf8"))}catch{return res.sendStatus(400)}
  try{
    if(event.event==="dedicatedaccount.assign.success")await bankAssigned(event);
    else if(event.event==="dedicatedaccount.assign.failed")await bankAssignFailed(event);
    else if(event.event==="charge.success")await depositReceived(event);
    return res.sendStatus(200);
  }catch(error){
    console.error("Paystack DVA webhook processing failed:",String(error?.name||"unknown"));
    return res.sendStatus(500); // Provider retries. Do not silently lose funds.
  }
};
module.exports._test={bankAssigned,depositReceived};
