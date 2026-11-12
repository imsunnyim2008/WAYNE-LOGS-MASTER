"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const svc=require("../services/paystackDvaService");
const secret="sk_test_"+crypto.randomBytes(20).toString("hex");
process.env.PAYSTACK_DVA_ENABLED="false";
process.env.PAYSTACK_SECRET_KEY=secret;
assert.equal(svc.enabled(),false,"Virtual accounts must be opt-in and off by default.");
process.env.PAYSTACK_DVA_ENABLED="true";
assert.equal(svc.enabled(),true);
process.env.NODE_ENV="production";
assert.equal(svc.enabled(),false,"Test DVA accounts must never appear on live production.");
delete process.env.NODE_ENV;
assert.equal(svc.enabled(),true);
const event={event:"dedicatedaccount.assign.success",data:{
  customer:{email:"Customer@example.invalid",customer_code:"CUS_TEST"},
  dedicated_account:{bank:{name:"Test Bank",slug:"test-bank"},
    account_number:"0123456789",account_name:"DEMO / CUSTOMER",currency:"NGN",active:true,id:99}
}};
const account=svc.normalizeAssignment(event);
assert(account,"Valid provider-signed assignment has a bank name and account number.");
assert.equal(account.email,"customer@example.invalid");
assert.equal(account.number,"0123456789");
assert.equal(svc.normalizeAssignment({data:{...event.data,dedicated_account:{...event.data.dedicated_account,account_number:"fake"}}}),null);
const raw=Buffer.from(JSON.stringify(event)),signature=crypto.createHmac("sha512",secret).update(raw).digest("hex");
assert(svc.verifySignature(raw,{"x-paystack-signature":signature}));
assert(!svc.verifySignature(raw,{"x-paystack-signature":"0".repeat(signature.length)}));
assert(!svc.verifySignature(Buffer.from('{"event":"charge.success"}'),{"x-paystack-signature":signature}));
assert.equal(svc.verifiedTransfer({
  reference:"provider-reference-12345",status:"success",currency:"NGN",amount:50000,
  authorization:{channel:"dedicated_nuban",receiver_bank_account_number:account.number},
  customer:{email:account.email}
},{accountNumber:account.number,customerEmail:account.email}),true);
for(const altered of [
  {status:"failed"}, {currency:"USD"}, {amount:-100}, {amount:1000000000},
  {customer:{email:"different@example.invalid"}},
  {authorization:{channel:"card",receiver_bank_account_number:account.number}},
  {authorization:{channel:"dedicated_nuban",receiver_bank_account_number:"0000000000"}}
]){
 const verified={reference:"provider-reference-12345",status:"success",currency:"NGN",amount:50000,
   authorization:{channel:"dedicated_nuban",receiver_bank_account_number:account.number},
   customer:{email:account.email},...altered};
 assert.equal(svc.verifiedTransfer(verified,{accountNumber:account.number,customerEmail:account.email}),false);
}
const fs=require("node:fs"),path=require("node:path");
const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
assert(server.includes('app.post("/api/wallet/webhooks/paystack-dva",express.raw('));
const file=fs.readFileSync(path.join(__dirname,"../controllers/virtualAccountController.js"),"utf8");
assert(file.includes("paystack.verifyTransaction(ref)"),"Webhook must requery Paystack before wallet credit.");
assert(file.includes("withTransaction"),"Wallet balance and ledger must share one atomic transaction.");
assert(file.includes("WalletTransaction.exists({reference:uniqueRef})"),"Duplicate callbacks must not credit twice.");
assert(file.includes("req.body?.consent!==true"),"Explicit consent is required.");
console.log("Paystack DVA signature, consent, account matching, idempotency and disabled-by-default checks passed.");
