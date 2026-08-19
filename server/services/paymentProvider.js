const crypto=require("crypto");
const providerName=()=>String(process.env.WALLET_PROVIDER||"manual_bank").toLowerCase();
async function paystack(path,options={}){
  if(!process.env.PAYSTACK_SECRET_KEY)throw new Error("PAYSTACK_SECRET_KEY is not configured.");
  const response=await fetch("https://api.paystack.co"+path,{...options,headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY,"Content-Type":"application/json",...(options.headers||{})}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok||body.status!==true)throw new Error(body.message||"Payment provider rejected the request.");
  return body.data;
}
exports.name=providerName;
exports.initializeTopup=async({email,amountKobo,reference,callbackUrl,userId})=>{
  if(providerName()!=="paystack")throw new Error("The selected wallet provider adapter is not configured yet. See services/paymentProvider.js.");
  const data=await paystack("/transaction/initialize",{method:"POST",body:JSON.stringify({email,amount:String(amountKobo),currency:"NGN",reference,callback_url:callbackUrl,metadata:{purpose:"wallet_topup",walletReference:reference,userId:String(userId)}})});
  return {authorizationUrl:data.authorization_url,providerReference:data.reference};
};
exports.verifyTopup=async(reference)=>{
  if(providerName()!=="paystack")throw new Error("The selected wallet provider adapter is not configured yet.");
  const data=await paystack("/transaction/verify/"+encodeURIComponent(reference),{method:"GET"});
  return {successful:data.status==="success",amountKobo:Number(data.amount),currency:data.currency,reference:data.reference};
};
exports.verifyWebhook=(name,raw,headers)=>{
  if(name!=="paystack"||providerName()!=="paystack")return false;
  const signature=String(headers["x-paystack-signature"]||"");
  const expected=crypto.createHmac("sha512",process.env.PAYSTACK_SECRET_KEY||"").update(raw).digest("hex");
  return !!signature&&signature.length===expected.length&&crypto.timingSafeEqual(Buffer.from(signature),Buffer.from(expected));
};
exports.parseWebhook=(name,raw)=>{
  if(name!=="paystack")return null; const event=JSON.parse(raw.toString("utf8"));
  if(event.event!=="charge.success")return null;
  return {reference:event.data.reference,successful:event.data.status==="success",amountKobo:Number(event.data.amount),currency:event.data.currency};
};
