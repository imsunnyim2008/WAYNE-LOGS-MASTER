"use strict";
const assert=require("node:assert/strict");
const tokens=require("../services/verificationTokens");
const first=tokens.generate(),second=tokens.generate();
assert.match(first,/^[a-f0-9]{64}$/);
assert.match(second,/^[a-f0-9]{64}$/);
assert.notEqual(first,second);
assert.equal(tokens.valid(first),true);
assert.equal(tokens.valid(first.toUpperCase()),false);
assert.equal(tokens.valid(first.slice(1)),false);
assert.equal(tokens.valid(""),false);
assert.equal(tokens.valid(undefined),false);
assert.equal(tokens.hash(first).length,64);
assert.notEqual(tokens.hash(first),first,"Never store plaintext verification tokens.");
assert.notEqual(tokens.hash(first),tokens.hash(second));
const now=new Date("2026-11-12T10:00:00.000Z");
assert.equal(tokens.expiration(now).toISOString(),"2026-11-13T10:00:00.000Z");
console.log("Email verification token tests passed.");


const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
// Simulate Gmail opening the same one-use verification link more than once.
(async()=>{
  let verified=false,usedHash="",usedAt=null,changes=0;
  const fakeUser={
    findOneAndUpdate:(filter,update)=>({select:async()=>{
      if(verified||filter.emailVerificationTokenHash!==tokens.hash(first))return null;
      verified=true;usedHash=update.$set.emailVerificationUsedTokenHash;
      usedAt=update.$set.emailVerificationUsedAt;changes++;
      return {_id:"test-customer"};
    }}),
    exists:async(filter)=>verified&&
      filter.emailVerificationUsedTokenHash===usedHash&&
      usedAt>filter.emailVerificationUsedAt.$gt?{_id:"test-customer"}:null
  };
  const sandbox={exports:{},process,Date,console,require:(id)=>{
    if(id==="../models/User")return fakeUser;
    if(id==="../services/emailService")return {isConfigured:()=>true};
    if(id==="../services/verificationTokens")return tokens;
    throw Error("Unexpected dependency: "+id);
  }};
  const source=fs.readFileSync(path.join(__dirname,"../controllers/emailVerificationController.js"),"utf8");
  vm.runInNewContext(source,sandbox,{filename:"emailVerificationController.js"});
  function res(){return{statusCode:200,set(){return this},status(code){this.statusCode=code;return this},json(data){this.payload=data;return this}}}
  const request={body:{token:first}};
  const firstResult=res();await sandbox.exports.verifyEmail(request,firstResult);
  assert.equal(firstResult.statusCode,200);
  assert.equal(firstResult.payload.success,true);
  const secondResult=res();await sandbox.exports.verifyEmail(request,secondResult);
  assert.equal(secondResult.statusCode,200,"Duplicate browser request must not show a false failure.");
  assert.equal(changes,1,"Duplicate requests must not change the verified account again.");
  usedAt=new Date(0);
  const oldResult=res();await sandbox.exports.verifyEmail(request,oldResult);
  assert.equal(oldResult.statusCode,400,"Replay acknowledgement must expire.");
  const invalidResult=res();await sandbox.exports.verifyEmail({body:{token:second}},invalidResult);
  assert.equal(invalidResult.statusCode,400,"Unknown tokens must not be accepted.");
  console.log("Duplicate email verification regression tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1;});
