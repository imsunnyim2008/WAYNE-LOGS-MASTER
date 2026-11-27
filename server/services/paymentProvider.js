const crypto=require("crypto");
const PROVIDER_TIMEOUT_MS=Math.max(5000,Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS||15000));
const withTimeout=options=>({...options,signal:options.signal||AbortSignal.timeout(PROVIDER_TIMEOUT_MS)});
const providerName=()=>String(process.env.WALLET_PROVIDER||"manual_bank").trim().toLowerCase();
const successful=status=>["success","successful","paid","completed"].includes(String(status||"").toLowerCase());
const nairaToKobo=value=>Math.round(Number(value)*100);
async function requestJson(url,options={},valid){
  const response=await fetch(url,withTimeout(options)),body=await response.json().catch(()=>({}));
  if(!response.ok||(valid&&!valid(body)))throw new Error(body.message||body.error||"Payment provider rejected the request.");
  return body;
}
async function paystack(path,options={}){
  if(!process.env.PAYSTACK_SECRET_KEY)throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  const response=await fetch("https://api.paystack.co"+path,withTimeout({...options,headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY,"Content-Type":"application/json",...(options.headers||{})}})),body=await response.json().catch(()=>({}));
  if(!response.ok||body.status!==true)throw new Error(body.message||"Payment provider rejected the request.");
  return body.data;
}
async function pocketfi(path,options={}){
  if(!process.env.POCKETFI_SECRET_KEY||!process.env.POCKETFI_BUSINESS_ID)throw new Error("PocketFi keys are not configured yet.");
  const base=String(process.env.POCKETFI_BASE_URL||"https://api.pocketfi.ng").replace(/\/$/,"");
  return requestJson(base+path,{...options,headers:{Authorization:"Bearer "+process.env.POCKETFI_SECRET_KEY,"Content-Type":"application/json",...(options.headers||{})}});
}
async function kora(path,options={}){
  if(!process.env.KORA_SECRET_KEY)throw new Error("KORA_SECRET_KEY is not configured yet.");
  const base=String(process.env.KORA_BASE_URL||"https://api.korapay.com/merchant").replace(/\/$/,"");
  return requestJson(base+path,{...options,headers:{Authorization:"Bearer "+process.env.KORA_SECRET_KEY,"Content-Type":"application/json",...(options.headers||{})}},body=>body.status===true);
}
exports.name=providerName;
exports.paystackEnabled=()=>{
  const key=String(process.env.PAYSTACK_SECRET_KEY||"");
  return process.env.PAYSTACK_CHECKOUT_ENABLED==="true" && /^sk_(?:live|test)_[A-Za-z0-9]+$/.test(key) &&
    (process.env.NODE_ENV!=="production" || key.startsWith("sk_live_"));
};
exports.initializeTopup=async({providerName:name,email,firstName,lastName,phone,amountKobo,reference,callbackUrl,userId,webhookUrl})=>{
  if(name==="paystack"){
    if(!exports.paystackEnabled())throw new Error("Paystack checkout is not enabled.");
    const data=await paystack("/transaction/initialize",{method:"POST",body:JSON.stringify({email,amount:String(amountKobo),currency:"NGN",reference,channels:["card","bank_transfer"],callback_url:callbackUrl,metadata:{purpose:"wallet_topup",walletReference:reference,userId:String(userId)}})});
    if(data.reference!==reference||!/^https:\/\/checkout\.paystack\.com\//.test(String(data.authorization_url||"")))throw new Error("Invalid Paystack checkout response.");
    return {authorizationUrl:data.authorization_url,providerReference:data.reference};
  }
  if(name==="pocketfi"){
    const body=await pocketfi("/api/v1/checkout/request",{method:"POST",body:JSON.stringify({first_name:firstName,last_name:lastName,phone,business_id:process.env.POCKETFI_BUSINESS_ID,email,redirect_link:callbackUrl,amount:(amountKobo/100).toFixed(2)})});
    if(String(body.status).toLowerCase()!=="success"||!body.payment_link||!body.payment_id)throw new Error(body.message||"PocketFi did not return a checkout link.");
    return {authorizationUrl:body.payment_link,providerReference:body.payment_id};
  }
  if(name==="kora"||name==="korapay"){
    const body=await kora("/api/v1/charges/initialize",{method:"POST",body:JSON.stringify({amount:amountKobo/100,currency:"NGN",reference,redirect_url:callbackUrl,notification_url:webhookUrl,customer:{name:[firstName,lastName].filter(Boolean).join(" "),email},channels:["card","bank_transfer"],narration:"WAYNE LOGS wallet top-up"})}),data=body.data||{};
    const authorizationUrl=data.checkout_url||data.authorization_url||data?.authorization?.redirect_url;
    if(!authorizationUrl)throw new Error("Kora did not return a checkout link.");
    return {authorizationUrl,providerReference:data.reference||reference};
  }
  throw new Error("The selected wallet provider is not supported.");
};
exports.verifyTopup=async(reference,name=providerName())=>{
  if(name==="paystack"){
    const data=await paystack("/transaction/verify/"+encodeURIComponent(reference),{method:"GET"});
    return {successful:data.status==="success" && data.reference===reference && data.domain===(process.env.PAYSTACK_SECRET_KEY.startsWith("sk_live_")?"live":"test") && String(data.authorization?.channel||data.channel||"")!=="dedicated_nuban",amountKobo:Number(data.amount),currency:data.currency,reference:data.reference};
  }
  if(name==="pocketfi"){
    const body=await pocketfi("/api/v1/checkout/confirm",{method:"POST",body:JSON.stringify({payment_id:reference})}),data=body.data||body;
    return {successful:successful(data.status),amountKobo:nairaToKobo(data.amount),currency:data.currency||"NGN",reference:data.payment_id||reference};
  }
  if(name==="kora"||name==="korapay"){
    const body=await kora("/api/v1/charges/"+encodeURIComponent(reference),{method:"GET"}),data=body.data||{},amount=data.amount_accepted??data.amount_paid??data.amount;
    return {successful:successful(data.status),amountKobo:nairaToKobo(amount),currency:data.currency||"NGN",reference:data.reference||reference};
  }
  throw new Error("Online payment verification is unavailable for this provider.");
};
exports.verifyWebhook=(name,raw,headers)=>{
  if(name!=="paystack"||!Buffer.isBuffer(raw))return false;
  const secret=String(process.env.PAYSTACK_SECRET_KEY||"");
  if(!/^sk_(?:live|test)_[A-Za-z0-9]+$/.test(secret)||(process.env.NODE_ENV==="production"&&!secret.startsWith("sk_live_")))return false;
  const equal=(digest,hex)=>/^[0-9a-f]{128}$/.test(hex)&&crypto.timingSafeEqual(digest,Buffer.from(hex,"hex"));
  const modern=String(headers["paystack-signature"]||"");
  if(modern){
    const signingSecret=String(process.env.PAYSTACK_WEBHOOK_SECRET||"");
    if(!signingSecret.startsWith("whsec_"))return false;
    const fields=modern.split(",").map(x=>x.trim()),ts=fields.filter(x=>x.startsWith("t="));
    if(ts.length!==1||!/^t=\d+$/.test(ts[0]))return false;
    const t=Number(ts[0].slice(2));
    if(!Number.isSafeInteger(t)||Math.abs(Math.floor(Date.now()/1000)-t)>300)return false;
    const digest=crypto.createHmac("sha512",signingSecret).update(t+".").update(raw).digest();
    return fields.filter(x=>x.startsWith("v1=")).some(x=>{const m=/^v1=whk_[^:]+:([0-9a-f]{128})$/.exec(x);return !!m&&equal(digest,m[1]);});
  }
  const signature=String(headers["x-paystack-signature"]||"");
  return equal(crypto.createHmac("sha512",secret).update(raw).digest(),signature);
};
exports.parseWebhook=(name,raw)=>{
  if(name!=="paystack")return null;const event=JSON.parse(raw.toString("utf8"));
  if(event.event!=="charge.success"||!event.data||String(event.data.authorization?.channel||event.data.channel||"")==="dedicated_nuban")return null;
  return {reference:event.data.reference,successful:event.data.status==="success",amountKobo:Number(event.data.amount),currency:event.data.currency};
};

