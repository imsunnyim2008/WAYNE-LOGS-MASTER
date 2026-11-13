"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const login=require("../services/adminLoginIdentifier");
const root=path.resolve(__dirname,"../..");
const owner={_id:"owner-test",role:"admin",isActive:true,email:"owner@example.invalid",password:"hashed-secret"};
const customer={_id:"customer-test",role:"user",email:"customer@example.invalid"};
function mockUser(accounts,configuredEmail){
 const calls=[];
 return {
   calls,
   findOne:async filter=>{
     calls.push({method:"findOne",filter});
     if(filter.email===configuredEmail&&filter.role==="admin")return accounts.find(x=>x.email===configuredEmail&&x.role==="admin"&&x.isActive)||null;
     return filter.email===customer.email?customer:null;
   },
   find:filter=>{
     calls.push({method:"find",filter});
     return{sort:()=>({limit:async n=>accounts.filter(x=>x.role==="admin"&&x.isActive).slice(0,n)})};
   }
 };
}
(async()=>{
 assert.equal(login.isAdminAlias("ADMIN_PASS"),true);
 assert.equal(login.isAdminAlias("admin_pass "),true);
 assert.equal(login.isAdminAlias("not-admin"),false);
 const model=mockUser([owner],"owner@example.invalid");
 assert.equal(await login.resolveLoginUser(model,"ADMIN_PASS","007","owner@example.invalid"),null,
   "An exposed 3-digit PIN must never allow admin ID login.");
 assert.equal(model.calls.length,0,"A weak admin PIN must not query or reveal owner accounts.");
 assert.equal(await login.resolveLoginUser(model,"ADMIN_PASS","SecurePassword12!","owner@example.invalid"),owner,
   "Alias requires existing, active, configured owner account.");
 assert.equal(await login.resolveLoginUser(model,"customer@example.invalid","007",""),customer,
   "Existing customer email login remains unchanged and password is checked in the controller.");
 const fallback=mockUser([owner],"");
 assert.equal(await login.resolveLoginUser(fallback,"admin_pass","LongPrivatePassword#123",""),owner,
   "A single active admin can use the alias.");
 const two=mockUser([owner,{...owner,_id:"other-admin",email:"other@example.invalid"}],"");
 assert.equal(await login.resolveLoginUser(two,"admin_pass","LongPrivatePassword#123",""),null,
   "Ambiguous owner account must not be silently chosen.");
 const disabled=mockUser([{...owner,isActive:false}],"");
 assert.equal(await login.resolveLoginUser(disabled,"admin_pass","LongPrivatePassword#123",""),null);
 const backend=fs.readFileSync(path.join(__dirname,"../controllers/authController.js"),"utf8");
 assert(backend.includes("adminLoginIdentifier.resolveLoginUser(User,email,password,process.env.ADMIN_EMAIL)"));
 assert(backend.includes("bcrypt.compare(password||\"\",u.password)"),
   "Alias must pass original bcrypt verification.");
 assert(backend.includes('u.totpEnabled'),"Existing two-factor auth must remain in force.");
 assert(backend.includes('attempts.get(key)'),"Admin ID must remain behind failed-login limits.");
 const html=fs.readFileSync(path.join(root,"login.html"),"utf8");
 assert(html.includes('login.html?admin=1'));
 assert(html.includes('identifier.type="text"'),"Admin ID field must accept non-email aliases.");
 assert(html.includes('if(adminMode&&d.user.role!=="admin")'));
 assert(html.includes('d.user.role==="admin"?"admin.html"'));
 assert(!backend.includes("password===\"007\"")&&!backend.includes("password===\'007\'"),
   "No fixed password bypass can be installed.");
 console.log("Secure admin-ID checks passed: weak PIN blocked, bcrypt/2FA retained, owner-only alias, existing login untouched.");
})().catch(e=>{console.error(e);process.exitCode=1});
