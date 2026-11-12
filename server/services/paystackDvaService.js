"use strict";
const crypto=require("crypto");
const BASE="https://api.paystack.co";
function enabled(){
  return process.env.PAYSTACK_DVA_ENABLED==="true"&&
    /^sk_(?:test|live)_[A-Za-z0-9]+$/.test(String(process.env.PAYSTACK_SECRET_KEY||""));
}
function verifySignature(raw,headers){
  const secret=String(process.env.PAYSTACK_SECRET_KEY||"");
  const signature=String(headers?.["x-paystack-signature"]||"");
  if(!enabled()||!Buffer.isBuffer(raw)||!secret||!signature)return false;
  const digest=crypto.createHmac("sha512",secret).update(raw).digest("hex");
  return signature.length===digest.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(digest));
}
async function request(path,options={}){
  if(!enabled())throw new Error("Dedicated bank accounts are not enabled for this merchant.");
  const response=await fetch(BASE+path,{
    ...options,
    signal:AbortSignal.timeout(15000),
    headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY,"Content-Type":"application/json"}
  });
  const json=await response.json().catch(()=>({}));
  if(!response.ok||json.status!==true)throw new Error(String(json.message||"Paystack request failed").slice(0,160));
  return json.data||{};
}
function bankChoice(){return String(process.env.PAYSTACK_SECRET_KEY||"").startsWith("sk_test_")?
  "test-bank":String(process.env.PAYSTACK_DVA_BANK||"titan-paystack").trim()}
async function assign({email,firstName,lastName,phone}){
  const input={email,first_name:firstName,last_name:lastName,phone,
    preferred_bank:bankChoice(),country:"NG"};
  return request("/dedicated_account/assign",{method:"POST",body:JSON.stringify(input)});
}
async function verifyTransaction(reference){
  if(!/^[a-zA-Z0-9._-]{5,120}$/.test(String(reference||"")))throw new Error("Invalid reference.");
  return request("/transaction/verify/"+encodeURIComponent(reference),{method:"GET"});
}
function normalizeAssignment(event){
  const d=event?.data||{};
  const account=d.dedicated_account||d;
  const customer=d.customer||account.customer||{};
  const number=String(account.account_number||"");
  const email=String(customer.email||"").toLowerCase().trim();
  if(!/^\d{10}$/.test(number)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||
    !account.bank?.name||!account.account_name||account.active===false||
    (account.currency&&account.currency!=="NGN"))return null;
  return{number,email,bankName:String(account.bank.name).slice(0,90),
    bankSlug:String(account.bank.slug||"").slice(0,70),
    accountName:String(account.account_name).slice(0,130),
    externalId:String(account.id||"").slice(0,100),
    customerCode:String(customer.customer_code||"").slice(0,100)};
}
function verifiedTransfer(data,bankAccount){
  const ref=String(data?.reference||"");
  const amount=Number(data?.amount);
  const number=String(data?.authorization?.receiver_bank_account_number||"");
  const email=String(data?.customer?.email||"").toLowerCase().trim();
  const channel=String(data?.authorization?.channel||data?.channel||"").toLowerCase();
  return ref.length>=5&&ref.length<=120&&/^[A-Za-z0-9._-]+$/.test(ref)&&
    data?.status==="success"&&data?.currency==="NGN"&&
    Number.isSafeInteger(amount)&&amount>=100&&amount<=100000000&&
    channel==="dedicated_nuban"&&number===bankAccount.accountNumber&&
    email===bankAccount.customerEmail;
}
module.exports={enabled,verifySignature,request,assign,verifyTransaction,normalizeAssignment,verifiedTransfer};
