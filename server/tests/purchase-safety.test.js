"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const checks=require("../services/purchaseChecks");
const product={price:1250.25,currency:"NGN",stock:2,status:"active"};
const order={
  status:"pending",paymentStatus:"pending",paymentReference:"",
  currency:"NGN",unitPrice:1250.25,totalAmount:1250.25,quantity:1
};
assert.equal(checks.toKobo(1250.25),125025);
assert.equal(checks.toKobo(0),null);
assert.equal(checks.toKobo(-1),null);
assert.equal(checks.toKobo("not a price"),null);
assert.equal(checks.toKobo(Infinity),null);
assert.equal(checks.toKobo(0.001),null);
assert.equal(checks.toKobo(9999999999999999),null);
assert.equal(checks.comparableSnapshot(order,product),true);
assert.equal(checks.validateWalletCheckout(order,product),null);
assert.match(checks.validateWalletCheckout({...order,status:"cancelled"},product),/no longer/i);
assert.match(checks.validateWalletCheckout({...order,status:"refunded",paymentStatus:"refunded"},product),/no longer/i);
assert.match(checks.validateWalletCheckout({...order,paymentStatus:"paid"},product),/no longer/i);
assert.match(checks.validateWalletCheckout({...order,paymentReference:"WL-CHARGE"},product),/external payment/i);
assert.match(checks.validateWalletCheckout(order,{...product,stock:0}),/unavailable/i);
assert.match(checks.validateWalletCheckout(order,{...product,status:"inactive"}),/unavailable/i);
assert.match(checks.validateWalletCheckout(order,{...product,price:1260}),/price has changed/i);
assert.match(checks.validateWalletCheckout({...order,totalAmount:500},product),/price has changed/i);
assert.match(checks.validateWalletCheckout({...order,currency:"USD"},product),/NGN/i);
assert.match(checks.validateWalletCheckout(order,{...product,currency:"USD"}),/price has changed/i);
assert.equal(checks.comparableSnapshot({...order,quantity:1.4},product),false);
const source=fs.readFileSync(path.resolve(__dirname,"../controllers/orderController.js"),"utf8");
assert.match(source,/purchaseChecks\.validateWalletCheckout\(order,snapshot\)/);
assert.match(source,/if\(order\?\.paymentStatus==="paid"\)/);
assert.match(source,/if\(!claimed\)return;/);
assert.match(source,/if\(order\?\.paymentStatus==="paid"\)return res\.json\(\{success:true,order,replayed:true\}\)/);
console.log("Checkout price, currency, status and duplicate-charge safety tests passed.");
