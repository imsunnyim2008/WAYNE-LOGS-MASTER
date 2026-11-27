"use strict";
const assert=require("node:assert/strict");
const crypto=require("node:crypto");
const provider=require("../services/paymentProvider");
async function run(){
 const key="sk_test_"+crypto.randomBytes(16).toString("hex");
 process.env.PAYSTACK_SECRET_KEY=key;
 process.env.PAYSTACK_CHECKOUT_ENABLED="false";
 assert.equal(provider.paystackEnabled(),false);
 process.env.PAYSTACK_CHECKOUT_ENABLED="true";
 process.env.NODE_ENV="production";
 assert.equal(provider.paystackEnabled(),false);
 process.env.NODE_ENV="test";
 assert.equal(provider.paystackEnabled(),true);
 const reference="WLT-123456789-1234567890abcdef";
 const raw=Buffer.from(JSON.stringify({event:"charge.success",data:{reference,status:"success",amount:150000,currency:"NGN",channel:"card"}}));
 const legacy=crypto.createHmac("sha512",key).update(raw).digest("hex");
 assert(provider.verifyWebhook("paystack",raw,{"x-paystack-signature":legacy}));
 assert(!provider.verifyWebhook("paystack",Buffer.from("{}"),{"x-paystack-signature":legacy}));
 assert(!provider.verifyWebhook("paystack",raw,{"x-paystack-signature":"0".repeat(128)}));
 process.env.PAYSTACK_WEBHOOK_SECRET="whsec_"+crypto.randomBytes(16).toString("hex");
 const now=Math.floor(Date.now()/1000);
 function header(t){return "t="+t+",v1=whk_test:"+crypto.createHmac("sha512",process.env.PAYSTACK_WEBHOOK_SECRET).update(t+".").update(raw).digest("hex")}
 assert(provider.verifyWebhook("paystack",raw,{"paystack-signature":header(now)}));
 assert(!provider.verifyWebhook("paystack",raw,{"paystack-signature":header(now-301)}));
 assert(!provider.verifyWebhook("paystack",Buffer.from("{}"),{"paystack-signature":header(now)}));
 assert.equal(provider.parseWebhook("paystack",raw).reference,reference);
 assert.equal(provider.parseWebhook("paystack",Buffer.from(JSON.stringify({event:"charge.success",data:{channel:"dedicated_nuban"}}))),null);
 const originalFetch=global.fetch;
 try {
   let response={reference,status:"success",amount:150000,currency:"NGN",domain:"test",channel:"card"};
   global.fetch=async(url,options)=>{
     assert(url.startsWith("https://api.paystack.co/transaction/"));
     assert.equal(options.headers.Authorization,"Bearer "+key);
     return {ok:true,json:async()=>({status:true,data:response})};
   };
   assert.equal((await provider.verifyTopup(reference,"paystack")).successful,true);
   for(const change of [{reference:"wrong"},{domain:"live"},{status:"failed"},{channel:"dedicated_nuban"}]){
     response={reference,status:"success",amount:150000,currency:"NGN",domain:"test",channel:"card",...change};
     assert.equal((await provider.verifyTopup(reference,"paystack")).successful,false);
   }
   response={reference,authorization_url:"https://checkout.paystack.com/example"};
   assert.equal((await provider.initializeTopup({providerName:"paystack",email:"test@example.invalid",amountKobo:150000,reference,callbackUrl:"https://example.invalid",userId:"demo"})).providerReference,reference);
   response={reference,authorization_url:"https://example.invalid/checkout"};
   await assert.rejects(provider.initializeTopup({providerName:"paystack",reference}));
 } finally { global.fetch=originalFetch; }
 console.log("Paystack checkout provider tests passed");
}
run().catch(error=>{console.error(error);process.exitCode=1;});
