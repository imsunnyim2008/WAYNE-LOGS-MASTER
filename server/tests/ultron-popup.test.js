"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.join(__dirname,"..","..");
const config=fs.readFileSync(path.join(root,"config.js"),"utf8");
const feedback=fs.readFileSync(path.join(root,"feedback.js"),"utf8");

// Past bug: two wrappers treated EVERY POST as a successful purchase,
// opened overlapping "Successful" dialogs and replayed them after navigation.
for(const [name,source] of [["config.js",config],["feedback.js",feedback]]){
  assert(!source.includes("window.fetch=async function"),name+" must not install an automatic API popup hook.");
  assert(!source.includes('sessionStorage.setItem("wayneFeedbackPending"'),name+" must not replay success later.");
  assert(!source.includes('sessionStorage.setItem("waynePendingToast"'),name+" must not replay success later.");
  assert(source.includes('sessionStorage.removeItem("wayneFeedbackPending")'),name+" must clean old cached popup state.");
  assert(source.includes('sessionStorage.removeItem("waynePendingToast")'),name+" must clean old cached toast state.");
  assert(!source.includes("showPending()"),name+" must never auto-present old API notifications.");
}
assert(config.includes("window.wayneConfirm="));
assert(feedback.includes("window.wayneConfirm="));
assert(feedback.includes("window.waynePopup="));
assert(config.includes("window.wayneToast=toast"));
assert(!config.includes('window.waynePopup(message,kind,options.title)'),"Normal toast should never be promoted to a modal.");
assert(feedback.includes('window.wayneToast(message,kind)'),"Regular alerts should be non-blocking.");
const pages=["admin","dashboard","force-change-password","forgot-password","index","login","notifications","orders","pay","profile","register","reset-password","settings","support","verify-email","wallet"];
const version="20261113-no-auto-modal";
for(const page of pages){
 const html=fs.readFileSync(path.join(root,page+".html"),"utf8");
 assert(html.includes("config.js?v="+version),page+" must load fresh site-wide config.");
 if(!["pay","verify-email"].includes(page)){
   assert(html.includes("feedback.js?v="+version),page+" must load fresh site-wide feedback.");
 }
 assert(!html.includes("config.js?v=20261112"),page+" must not use cached legacy popup handlers.");
}
const orders=fs.readFileSync(path.join(root,"orders.html"),"utf8");
assert(orders.includes('if(selected?.paymentStatus==="paid")show('),"Order success must require verified paid status.");
assert(orders.includes('next.searchParams.delete("walletPurchase")'),"Remove navigation confirmation flag after first load.");
assert(!orders.includes('if(params.get("walletPurchase")==="success")show("Wallet payment completed successfully."'),"Must not claim payment succeeded from query alone.");
const vercel=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
for(const script of ["/config.js","/feedback.js"]){
 const rule=vercel.headers.find(item=>item.source===script);
 assert(rule,script+" needs specific cache rule.");
 assert(rule.headers.some(x=>x.key==="Cache-Control"&&x.value.includes("must-revalidate")));
}
console.log("Site-wide feedback tests passed: no automatic API modals, no old success replay, verified order confirmations, fresh assets.");
