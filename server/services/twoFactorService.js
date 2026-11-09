"use strict";
const crypto=require("crypto");
const User=require("../models/User");
const alphabet="ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
function encodeBase32(bytes){
  let buffer=0,bits=0,out="";
  for(const byte of bytes){buffer=(buffer<<8)|byte;bits+=8;while(bits>=5){bits-=5;out+=alphabet[(buffer>>bits)&31];}}
  if(bits>0)out+=alphabet[(buffer<<(5-bits))&31];
  return out;
}
function decodeBase32(source){
  const text=String(source||"").toUpperCase().replace(/=+$/,"").replace(/\s/g,"");
  let buffer=0,bits=0,bytes=[];
  for(const ch of text){const idx=alphabet.indexOf(ch);if(idx<0)throw Error("Bad authenticator secret.");buffer=(buffer<<5)|idx;bits+=5;if(bits>=8){bits-=8;bytes.push((buffer>>bits)&255);}}
  return Buffer.from(bytes);
}
function encryptionKey(){
  const raw=process.env.TOTP_ENCRYPTION_KEY||process.env.JWT_SECRET;
  if(!raw||String(raw).length<32)throw Error("TOTP encryption key is not configured.");
  return crypto.createHash("sha256").update("wayne-logs-totp-v1:"+raw).digest();
}
exports.encrypt=secret=>{
  const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",encryptionKey(),iv);
  const payload=Buffer.concat([cipher.update(secret,"utf8"),cipher.final()]);
  return [iv,cipher.getAuthTag(),payload].map(x=>x.toString("base64")).join(".");
};
exports.decrypt=record=>{
  const parts=String(record||"").split(".");if(parts.length!==3)throw Error("Invalid authenticator configuration.");
  const [iv,tag,data]=parts.map(x=>Buffer.from(x,"base64"));
  const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey(),iv);
  decipher.setAuthTag(tag);return Buffer.concat([decipher.update(data),decipher.final()]).toString("utf8");
};
exports.newSecret=()=>encodeBase32(crypto.randomBytes(20));
exports.codeAt=(secret,step)=>{
  const message=Buffer.alloc(8);message.writeBigUInt64BE(BigInt(step));
  const digest=crypto.createHmac("sha1",decodeBase32(secret)).update(message).digest();
  const offset=digest[digest.length-1]&15;
  const number=(digest.readUInt32BE(offset)&0x7fffffff)%1000000;
  return String(number).padStart(6,"0");
};
exports.matchStep=(secret,code,now=Date.now())=>{
  const input=String(code||"").trim();if(!/^\d{6}$/.test(input))return null;
  const step=Math.floor(now/30000);
  // Prefer newer time steps, avoid accepting previously consumed codes.
  for(const delta of [1,0,-1]){const at=step+delta;const expected=exports.codeAt(secret,at);if(crypto.timingSafeEqual(Buffer.from(input),Buffer.from(expected)))return at;}
  return null;
};
const normalizeRecovery=code=>String(code||"").trim().toUpperCase().replace(/[\s-]/g,"");
exports.newRecoveryCodes=()=>Array.from({length:8},()=>{
  const raw=encodeBase32(crypto.randomBytes(10));
  return raw.match(/.{1,4}/g).join("-");
});
exports.hashRecoveryCode=code=>crypto.createHash("sha256").update("wayne-recovery-v1:"+normalizeRecovery(code)).digest("hex");
exports.consumeCode=async(user,code)=>{
  if(!user?.totpEnabled||!user.totpSecretEncrypted)return false;
  const candidate=String(code||"").trim();
  if(/^\d{6}$/.test(candidate)){
    const step=exports.matchStep(exports.decrypt(user.totpSecretEncrypted),candidate);
    if(step===null)return false;
    const changed=await User.updateOne({
      _id:user._id,totpEnabled:true,totpLastUsedStep:{$lt:step}
    },{$set:{totpLastUsedStep:step}});
    return changed.modifiedCount===1;
  }
  if(!/^[A-Z2-7]{4}(?:-?[A-Z2-7]{4}){3}$/i.test(candidate))return false;
  const hashed=exports.hashRecoveryCode(candidate);
  const changed=await User.updateOne({_id:user._id,totpEnabled:true,totpRecoveryCodeHashes:hashed},{$pull:{totpRecoveryCodeHashes:hashed}});
  return changed.modifiedCount===1;
};
