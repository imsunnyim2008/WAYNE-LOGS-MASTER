"use strict";

// Pure checkout rules. Do not mutate a wallet, order or inventory outside
// the MongoDB transaction which calls these helpers.
function toKobo(value){
  const amount=Number(value);
  if(!Number.isFinite(amount)||amount<=0)return null;
  const kobo=Math.round(amount*100);
  if(!Number.isSafeInteger(kobo)||kobo<=0||Math.abs(kobo/100-amount)>0.000001)return null;
  return kobo;
}
function comparableSnapshot(order,product){
  if(!order||!product)return false;
  const qty=Number(order.quantity);
  if(!Number.isSafeInteger(qty)||qty<1)return false;
  const cost=toKobo(product.price),unit=toKobo(order.unitPrice),total=toKobo(order.totalAmount);
  if(!cost||!unit||!total||!Number.isSafeInteger(cost*qty))return false;
  return unit===cost&&total===cost*qty&&
    String(order.currency||"NGN").toUpperCase()===String(product.currency||"NGN").toUpperCase();
}
function validateWalletCheckout(order,product){
  if(order?.paymentStatus!=="pending"||order?.status!=="pending")
    return "This order is no longer awaiting payment. Open My Orders to check its status.";
  if(order.paymentReference)
    return "An external payment has already been started for this order. Check My Orders or contact support before trying wallet payment.";
  if(!product||product.status!=="active"||Number(product.stock)<Number(order.quantity))
    return "This product is currently unavailable.";
  if(String(order.currency||"NGN").toUpperCase()!=="NGN")
    return "Wallet purchases currently support NGN products only.";
  if(!comparableSnapshot(order,product))
    return "The product price has changed. Return to the store and review the new price before paying.";
  return null;
}
module.exports={toKobo,comparableSnapshot,validateWalletCheckout};
