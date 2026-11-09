
"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
process.env.JWT_SECRET=process.env.JWT_SECRET||crypto.randomBytes(36).toString("hex");
const svc=require("../services/twoFactorService");
const secret=svc.newSecret();
assert.match(secret,/^[A-Z2-7]{32}$/);
const now=Date.now(),step=Math.floor(now/30000),code=svc.codeAt(secret,step);
assert.match(code,/^\d{6}$/);
assert.equal(svc.matchStep(secret,code,now),step);
assert.equal(svc.matchStep(secret,"ABCDEF",now),null);
assert.equal(svc.decrypt(svc.encrypt(secret)),secret);
const other=svc.encrypt(secret);
assert.notEqual(svc.encrypt(secret),other,"Fresh nonce required on every encryption");
assert.throws(()=>svc.decrypt(other.slice(0,-3)+"AAA"),/auth|invalid|authenticate|Unsupported|message/i);
const recovery=svc.newRecoveryCodes();
assert.equal(recovery.length,8);
assert.equal(new Set(recovery).size,8);
for(const value of recovery){
 assert.match(value,/^[A-Z2-7]{4}(?:-[A-Z2-7]{4}){3}$/);
 assert.equal(svc.hashRecoveryCode(value),svc.hashRecoveryCode(value.toLowerCase().replace(/-/g,"")));
}
console.log("WAYNE SHIELD cryptographic tests passed.");
