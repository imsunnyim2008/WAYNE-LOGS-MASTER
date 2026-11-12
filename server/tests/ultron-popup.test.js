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
