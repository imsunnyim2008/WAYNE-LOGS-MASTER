"use strict";
const assert=require("node:assert/strict"),jwt=require("jsonwebtoken");
const {validAsset,passwordOk,exact,token,key}=require("../routes/employeePortalRoutes")._test;
process.env.JWT_SECRET="test-only-employee-portal-isolation-key";
const good={contactEmail:"company@example.invalid",assetId:"123456789",authorized:true};
assert(validAsset(good));
for(const bad of [{...good,password:"secret"},{...good,accessToken:"secret"},{...good,authorized:false},{...good,assetId:"password"},{...good,contactEmail:"bad"},null])assert(!validAsset(bad));
assert(passwordOk("unique-test-password"));assert(!passwordOk("short"));assert(!passwordOk("a".repeat(73)));assert(!exact({email:"a",password:"b",role:"admin"},["email","password"]));
const t=token({_id:"507f1f77bcf86cd799439011",version:4});
assert.equal(jwt.verify(t,key(),{audience:"wayne-employee",algorithms:["HS256"]}).purpose,"employee_portal");
assert.throws(()=>jwt.verify(t,process.env.JWT_SECRET));
assert.throws(()=>jwt.verify(jwt.sign({id:"507f1f77bcf86cd799439011"},process.env.JWT_SECRET),key(),{audience:"wayne-employee",algorithms:["HS256"]}));
const fs=require("node:fs"),path=require("node:path");
for(const file of ["employee.html","employee-admin.html"]){const html=fs.readFileSync(path.join(__dirname,"../..",file),"utf8");for(const m of html.matchAll(/<script>([\s\S]*?)<\/script>/g))new Function(m[1]);}
console.log("Employee portal validation and token isolation tests passed.");
