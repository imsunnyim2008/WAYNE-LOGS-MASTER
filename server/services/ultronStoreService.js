"use strict";
// Public, deterministic storefront guidance. Does not access private ULTRON or customer data.
function answer(question){
 const q=String(question||"").toLowerCase();
 if(/\b(refund|return|dispute|problem|wrong|scam|complain|not working|invalid|broken|issue)\b/.test(q))
  return {category:"support",text:"If your purchase has a problem, open My Orders to confirm its status and delivery, then contact Support with the order reference. Refund eligibility is reviewed by the store team; I can't issue refunds or change orders.",link:{label:"Contact Support",href:"support.html"}};
 if(/\b(orders?|delivery|delivered|my purchase|receipt|copy|credentials|login details)\b/.test(q))
  return {category:"orders",text:"Sign in and open My Orders to check the purchase status and view any delivery details. Use the Copy button to copy delivered information. If an order hasn't arrived, contact Support with its reference.",link:{label:"View My Orders",href:"orders.html"}};
 if(/\b(wallet|fund|deposit|top.?up|transfer|bank|pay|payment|credit|balance)\b/.test(q))
  return {category:"wallet",text:"Open Wallet to see the available funding method. For manual bank transfers, follow the bank instructions and upload your payment proof. Wallet credit is added only after an administrator verifies the transfer.",link:{label:"Open Wallet",href:"wallet.html"}};
 if(/\b(forgot|reset|password|sign.?in|login|register|account)\b/.test(q))
  return {category:"account",text:"If you forgot your password, select Forgot Password on the sign-in page. Email recovery requires the store's email service to be configured. You can also contact Support for help.",link:{label:"Password recovery",href:"forgot-password.html"}};
 if(/\b(stock|products?|catalog|catalogue|listings?|sell|buy|price|available|instagram|facebook|tiktok|telegram|youtube|vpn)\b/.test(q))
  return {category:"products"};
 if(/\b(human|support|help|contact|staff|agent|telegram)\b/.test(q))
  return {category:"support",text:"For account-specific questions, deliveries, complaints, or manual payment checks, contact the WAYNE LOGS support team. I don't have access to private customer accounts or your private ULTRON assistant.",link:{label:"Open Support",href:"support.html"}};
 if(/\b(ultron|who are you|what can you)\b/.test(q))
  return {category:"about",text:"I'm ULTRON Store Help — a read-only helper for WAYNE LOGS products, wallet funding, orders, and support. This storefront version is separate from the owner's private ULTRON brain and cannot perform admin actions.",link:{label:"Browse products",href:"index.html#shop"}};
 return {category:"fallback",text:"I can guide you through products, pricing, wallet deposits, orders, password recovery and customer support. Ask something about WAYNE LOGS or open Support for personal account help.",link:{label:"Contact Support",href:"support.html"}};
}
module.exports={answer};
