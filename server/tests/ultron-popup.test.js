"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

// Guard against chat requests being mistaken for wallet/checkout actions.
// Both global fetch wrappers must skip ULTRON chat endpoints.
for(const filename of ["config.js","feedback.js"]){
  const source=fs.readFileSync(path.join(__dirname,"..","..",filename),"utf8");
  const declaration="function isUltronConversationRequest(url){";
  const start=source.indexOf(declaration);
  assert.notEqual(start,-1,filename+" must define a chat-feedback exclusion.");
  const end=source.indexOf("\n  }",start);
  assert(end>start,filename+" must contain a complete exclusion function.");
  const predicate=new Function("URL","location",
    source.slice(start,end+5)+"; return isUltronConversationRequest;"
  )(URL,{href:"https://www.waynelogs.com/index.html"});
  assert.equal(predicate("https://wayne-logs-master-api.onrender.com/api/ultron/ask"),true);
  assert.equal(predicate("https://wayne-logs-master-api.onrender.com/api/ultron/ai/chat?x=1"),true);
  assert.equal(predicate("/api/ultron/ai/chat"),true);
  assert.equal(predicate("https://wayne-logs-master-api.onrender.com/api/orders"),false);
  assert.equal(predicate("/api/wallet/pay"),false);
  assert.equal(predicate("/api/auth/register"),false);
  assert.equal(predicate("/api/ultron/ai/chatty"),false);
  if(filename==="config.js")assert.match(source,/\|\|isUltronConversationRequest\(url\)\)return response/);
  else assert.match(source,/const mutation=![^;]+&&!isUltronConversationRequest\(url\)/);
}
console.log("ULTRON chat popup suppression tests passed; purchase/wallet feedback remains enabled.");


const root=path.join(__dirname,"..","..");
const pages=["admin","dashboard","force-change-password","forgot-password","index","login","notifications","orders","profile","register","reset-password","settings","support","verify-email","wallet"];
const cacheVersion="20261112-chatpopupfix-v2";
for(const page of pages){
  const html=fs.readFileSync(path.join(root,page+".html"),"utf8");
  assert(html.includes("config.js?v="+cacheVersion),page+" must load fresh config.js");
  if(page!=="verify-email")assert(html.includes("feedback.js?v="+cacheVersion),page+" must load fresh feedback.js");
}
const vercel=JSON.parse(fs.readFileSync(path.join(root,"vercel.json"),"utf8"));
for(const script of ["/config.js","/feedback.js"]){
  const rule=vercel.headers.find(x=>x.source===script);
  assert(rule,script+" must have a specific cache rule.");
  assert(rule.headers.some(h=>h.key==="Cache-Control"&&h.value.includes("must-revalidate")),script+" must revalidate");
}
console.log("All customer pages request fresh feedback scripts.");
