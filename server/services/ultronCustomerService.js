"use strict";
// Read-only account help. Every query is scoped to the JWT authenticated user.
const Order=require("../models/Order");
const WalletTransaction=require("../models/WalletTransaction");
const User=require("../models/User");
const Product=require("../models/Product");
const safeMoney=kobo=>"₦"+(Number(kobo||0)/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
function intentFor(message){
  const q=String(message||"").toLowerCase();
  if(/\b(send|transfer|withdraw|pay|buy|purchase)\b/.test(q)&&/\b(now|for me|on my behalf|from my wallet|to\s+(?:a|my|their|another))\b/.test(q))return"action";
  if(/\b(balance|how much.*(?:wallet|credit)|wallet.*(?:have|money|balance))\b/.test(q))return"balance";
  if(/\b(transactions?|deposits?|credit history|payment history|last transfer|recent transfer|funding status|top.?up status)\b/.test(q))return"transactions";
  if(/\b(my|mine|latest|last|recent|track|where|status)\b/.test(q)&&/\b(orders?|purchases?|delivery|deliveries)\b/.test(q))return"orders";
  if(/\b(recommend|suggest|available products?|what.*(?:buy|sell|available)|in stock)\b/.test(q))return"products";
  if(/\b(agent|human support|contact support|support ticket)\b/.test(q))return"support";
  return null;
}
function orderLabel(order){
  const paid=order.paymentStatus==="paid";
  const state=order.paymentStatus==="refunded"||order.status==="refunded"?"refunded":
    order.status==="completed"&&paid?"completed":paid?"paid, awaiting fulfillment":
    order.status==="cancelled"?"cancelled":"awaiting payment";
  return String(order.productName||"Item").slice(0,90)+" — "+state;
}
async function answer({message,userId}){
  const intent=intentFor(message);
  if(!intent)return{handled:false};
  if(intent==="action")return{handled:true,answer:"I can check your orders and wallet, but I cannot transfer money or purchase products for you. Open the Wallet or Shop page and confirm any payment yourself.",link:{label:"Open wallet",href:"dashboard.html"}};
  if(intent==="orders"){
    const rows=await Order.find({user:userId}).select("productName status paymentStatus createdAt").sort({createdAt:-1}).limit(3).lean();
    return {handled:true,answer:rows.length?
      "Your latest orders:\n"+rows.map(orderLabel).join("\n")+"\n\nFor delivery details, sign in to My Orders. I cannot disclose private credentials in chat.":
      "You have no orders yet. Browse the marketplace to make your first purchase.",link:{label:"My Orders",href:"orders.html"}};
  }
  if(intent==="balance"){
    const customer=await User.findById(userId).select("walletBalanceKobo isActive").lean();
    if(!customer?.isActive)throw new Error("Account unavailable");
    return {handled:true,answer:"Your current WAYNE LOGS store credit balance is "+safeMoney(customer.walletBalanceKobo)+". This is store credit, not a withdrawable bank balance.",link:{label:"Wallet & transactions",href:"dashboard.html"}};
  }
  if(intent==="transactions"){
    const rows=await WalletTransaction.find({user:userId}).select("type status amountKobo createdAt").sort({createdAt:-1}).limit(3).lean();
    return{handled:true,answer:rows.length?
      "Your latest wallet activity:\n"+rows.map(x=>String(x.type).replace(/_/g," ")+": "+safeMoney(x.amountKobo)+" ("+String(x.status)+")").join("\n")+"\n\nUnverified deposits do not increase your balance.":
      "No wallet transactions were found for your account.",link:{label:"View transactions",href:"dashboard.html"}};
  }
  if(intent==="products"){
    const matches=await Product.find({status:"active",stock:{$gt:0}}).select("name price currency stock").sort({createdAt:-1}).limit(4).lean();
    return {handled:true,answer:matches.length?"These products are currently listed as available:\n"+
      matches.map(x=>String(x.name).slice(0,90)+" — ₦"+Number(x.price).toLocaleString("en-NG")).join("\n")+
      "\n\nAvailability may change before checkout.":
      "There are no products currently listed as available.",link:{label:"Browse products",href:"index.html#shop"}};
  }
  return{handled:true,answer:"Open Support for help with refunds, payment reviews, delivery problems or account issues. An administrator must review sensitive actions.",link:{label:"Contact Support",href:"support.html"}};
}
module.exports={intentFor,answer};
