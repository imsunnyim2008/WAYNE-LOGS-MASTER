const jwt=require("jsonwebtoken");
const crypto=require("node:crypto");
let cached=new Map(),expires=0,pending;
async function refresh(){
 if(!pending)pending=(async()=>{
  const r=await fetch("https://www.googleapis.com/oauth2/v3/certs",{signal:AbortSignal.timeout(8000),redirect:"error"});
  if(!r.ok)throw Error("Google keys unavailable");
  const data=await r.json(),keys=new Map();
  for(const k of data.keys||[])if(k.kty==="RSA"&&k.alg==="RS256"&&typeof k.kid==="string")keys.set(k.kid,crypto.createPublicKey({key:k,format:"jwk"}));
  if(!keys.size)throw Error("No Google keys");
  cached=keys;const age=Number(r.headers.get("cache-control")?.match(/max-age=(\d+)/)?.[1]||300);
  expires=Date.now()+Math.min(age,3600)*1000;
 })().finally(()=>{pending=null});
 return pending;
}
function clientId(){const id=String(process.env.GOOGLE_CLIENT_ID||"").trim();return /^[a-zA-Z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)?id:""}
function validateClaims(p,nonce){
 if(!p||typeof p.sub!=="string"||!p.sub||p.sub.length>255||p.nonce!==nonce||typeof p.exp!=="number"||typeof p.iat!=="number"||p.iat>Date.now()/1000+60||p.email_verified!==true||typeof p.email!=="string"||p.email.length>254||!/^\S+@[^\s@]+\.[^\s@]+$/.test(p.email))throw Error("Invalid Google identity");
 return {sub:p.sub,email:p.email.toLowerCase(),authoritative:p.email.toLowerCase().endsWith("@gmail.com")||(typeof p.hd==="string"&&!!p.hd),firstName:String(p.given_name||"").slice(0,60),lastName:String(p.family_name||"").slice(0,60)};
}
async function verifyGoogle(credential,nonce){
 if(typeof credential!=="string"||credential.length>12000||!clientId())throw Error("Invalid credential");
 const decoded=jwt.decode(credential,{complete:true});if(!decoded||decoded.header.alg!=="RS256"||typeof decoded.header.kid!=="string")throw Error("Invalid token");
 if(Date.now()>=expires)await refresh();
 const key=cached.get(decoded.header.kid);if(!key)throw Error("Unknown Google key");
 const p=jwt.verify(credential,key,{algorithms:["RS256"],audience:clientId(),issuer:["accounts.google.com","https://accounts.google.com"],clockTolerance:30});
 if(p.azp&&p.azp!==clientId())throw Error("Invalid authorized party");
 return validateClaims(p,nonce);
}
module.exports={clientId,verifyGoogle,validateClaims};
