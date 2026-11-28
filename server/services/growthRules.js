"use strict";
const validId=x=>typeof x==="string"&&/^[a-f0-9]{24}$/i.test(x);
function reviewInput(body){const rating=Number(body?.rating),comment=typeof body?.comment==="string"?body.comment.trim():"";if(!Number.isInteger(rating)||rating<1||rating>5||comment.length>500)throw Error("Choose 1–5 stars and up to 500 characters.");return{rating,comment}}
function expenseInput(value){const n=Number(value);if(value===""||!Number.isSafeInteger(n)||n<0||n>1000000000000)throw Error("Invalid expense in kobo.");return n}
function safeReceipt(order){if(order?.paymentStatus!=="paid")throw Error("Receipt unavailable.");return ["WAYNE LOGS — Payment receipt","Order: "+String(order._id),"Product: "+String(order.productName).replace(/[\r\n]/g," "),"Quantity: "+order.quantity,"Amount: NGN "+Number(order.totalAmount).toFixed(2),"Payment status: Paid","Order date: "+new Date(order.createdAt).toISOString(),"This receipt does not contain delivery details."].join("\n")}
function membership(points){return points>=1000?"VIP":points>=500?"Gold":points>=100?"Silver":"Bronze"}
function countdown(ms){const seconds=Math.max(0,Math.ceil(ms/1000));return [Math.floor(seconds/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,"0")).join(":")}
module.exports={membership,countdown,validId,reviewInput,expenseInput,safeReceipt};
