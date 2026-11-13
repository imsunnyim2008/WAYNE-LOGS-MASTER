"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.join(__dirname,"..","..");
let site={
  manualBankEnabled:true,bankName:"Customer-provided Bank",
  bankAccountName:"Merchant Test Account",bankAccountNumber:"0123456789",
  minimumTopupKobo:10000,maximumTopupKobo:5000000
};
const SiteSetting={findOne:()=>({select:()=>({lean:async()=>site})})};
const moduleRef={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../controllers/paymentLinkController.js"),"utf8"),{
  module:moduleRef,exports:moduleRef.exports,console,process,
  require:id=>{if(id==="../models/SiteSetting")return SiteSetting;throw Error("Unexpected dependency "+id)}
});
const api=moduleRef.exports;
function reply(){
  return{statusCode:200,data:null,headers:{},set(key,value){this.headers[key]=value;return this},
    status(v){this.statusCode=v;return this},json(v){this.data=v;return this}}
}
(async()=>{
  assert.deepEqual(JSON.parse(JSON.stringify(api.bankFrom(site,{}))),{
    name:"Customer-provided Bank",accountName:"Merchant Test Account",accountNumber:"0123456789"
  });
  assert.equal(api.bankFrom({...site,manualBankEnabled:false},{}),null);
  assert.equal(api.bankFrom({...site,bankAccountNumber:"fake"},{}),null);
  assert.equal(api.bankFrom({...site,bankName:""},{}),null);
  const response=reply();
  await api.instructions({},response);
  assert.equal(response.statusCode,200);
  assert.equal(response.data.mode,"manual_bank");
  assert.equal(response.data.automaticConfirmation,false);
  assert.equal(response.headers["Cache-Control"],"no-store");
  assert(!JSON.stringify(response.data).includes("walletBalance"));
  site={...site,manualBankEnabled:false};
  const disabled=reply();await api.instructions({},disabled);
  assert.equal(disabled.statusCode,503);
  assert.equal(disabled.data.available,false);

  const server=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
  assert(server.includes('app.get("/api/payment-link/bank"'));
  const html=fs.readFileSync(path.join(root,"pay.html"),"utf8");
  const script=html.slice(html.lastIndexOf("<script>")+8,html.lastIndexOf("</script>"));
  new vm.Script(script,{filename:"pay.html"});
  assert(html.includes('/api/payment-link/bank'));
  assert(html.includes('/api/wallet/topups/initialize'));
  assert(html.includes('/submit'));
  assert(html.includes('Authorization:"Bearer "+token()'));
  assert(html.includes('bank transfer')&&html.includes('manual'));
  assert(html.includes('Pending manual review'));
  assert(!html.includes('auto credit')&&!html.includes('Payment successful'));
  const login=fs.readFileSync(path.join(root,"login.html"),"utf8");
  assert(login.includes('qs.get("pay")==="1"'));
  assert(login.includes('qs.get("amount")'));
  const config=fs.readFileSync(path.join(root,"config.js"),"utf8");
  assert(!config.includes('window.fetch=async function'),"Payment link should not auto-trigger dialogs from network requests.");
  const dashboard=fs.readFileSync(path.join(root,"dashboard.html"),"utf8");
  assert(dashboard.includes('href="pay.html"'));
  console.log("Payment link: configured bank, disabled settings, pending review and safe customer flows passed.");
})().catch(error=>{console.error(error);process.exitCode=1});
