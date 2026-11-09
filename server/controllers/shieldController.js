"use strict";
const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const User=require("../models/User");
const AuditLog=require("../models/AuditLog");
const totp=require("../services/twoFactorService");
const adminOnly=(req,res)=>{if(req.user.role!=="admin"){res.status(403).json({message:"Only the owner administrator can manage two-factor authentication."});return false}return true};
const record=(req,action,summary)=>AuditLog.create({
 admin:req.user._id,action,entity:"security",summary,ipAddress:String(req.ip||"").slice(0,100),
 userAgent:String(req.get("user-agent")||"").slice(0,300)
}).catch(()=>{});
exports.status=async(req,res)=>{try{
 const u=await User.findById(req.user._id).select("totpEnabled +totpPendingExpiresAt +totpRecoveryCodeHashes");
 res.set("Cache-Control","no-store");
 return res.json({success:true,isOwner:req.user.role==="admin",enabled:!!u?.totpEnabled,
 pending:!!u?.totpPendingExpiresAt&&u.totpPendingExpiresAt>new Date(),remainingRecoveryCodes:u?.totpEnabled?(u.totpRecoveryCodeHashes||[]).length:0});
}catch{res.status(503).json({message:"Security status is temporarily unavailable."})}};
exports.setup=async(req,res)=>{
 if(!adminOnly(req,res))return;
 res.set("Cache-Control","no-store");
 try{
  const password=String(req.body?.password||"");
  const u=await User.findById(req.user._id).select("+password totpEnabled");
  if(!u||!await bcrypt.compare(password,u.password))return res.status(403).json({message:"Incorrect administrator password."});
  if(u.totpEnabled)return res.status(409).json({message:"Two-factor authentication is already enabled."});
  const secret=totp.newSecret();
  await User.updateOne({_id:u._id,totpEnabled:false},{$set:{totpPendingEncrypted:totp.encrypt(secret),totpPendingExpiresAt:new Date(Date.now()+10*60*1000)}});
  record(req,"auth.2fa_setup","Administrator started authenticator enrollment.");
  return res.json({success:true,secret,otpauth:"otpauth://totp/"+encodeURIComponent("WAYNE LOGS:"+u.email)+"?secret="+secret+"&issuer="+encodeURIComponent("WAYNE LOGS")+"&algorithm=SHA1&digits=6&period=30",expiresMinutes:10,message:"Save this setup key in your authenticator app. It will not be shown again."});
 }catch(e){console.error("2FA setup failed:",e?.name);return res.status(503).json({message:"Could not begin security setup."});}
};
exports.enable=async(req,res)=>{
 if(!adminOnly(req,res))return;
 res.set("Cache-Control","no-store");
 try{
  const code=String(req.body?.code||"").trim(),user=await User.findById(req.user._id).select("totpEnabled +totpPendingEncrypted +totpPendingExpiresAt");
  if(!user||user.totpEnabled)return res.status(409).json({message:"Already enabled or account unavailable."});
  if(!user.totpPendingEncrypted||!user.totpPendingExpiresAt||user.totpPendingExpiresAt<new Date())return res.status(410).json({message:"Setup expired. Start again."});
  const at=totp.matchStep(totp.decrypt(user.totpPendingEncrypted),code);
  if(at===null)return res.status(400).json({message:"The authenticator code is invalid. Check your phone time and try again."});
  const codes=totp.newRecoveryCodes();
  const updated=await User.findOneAndUpdate({_id:user._id,totpEnabled:false,totpPendingEncrypted:user.totpPendingEncrypted,totpPendingExpiresAt:{$gt:new Date()}},
  {$set:{totpEnabled:true,totpSecretEncrypted:user.totpPendingEncrypted,totpRecoveryCodeHashes:codes.map(totp.hashRecoveryCode),totpLastUsedStep:at},$unset:{totpPendingEncrypted:"",totpPendingExpiresAt:""},$inc:{sessionVersion:1}},
  {new:true});
  if(!updated)return res.status(409).json({message:"Setup changed. Start again."});
  record(req,"auth.2fa_enabled","Administrator enabled authenticator verification.");
  const token=jwt.sign({id:updated._id,role:updated.role,sv:Number(updated.sessionVersion||0)},process.env.JWT_SECRET,{expiresIn:"2h"});
  return res.json({success:true,token,recoveryCodes:codes,message:"Two-factor authentication enabled. Save your recovery codes offline now; they are displayed only once."});
 }catch(error){console.error("2FA enable failed:",error?.name);return res.status(503).json({message:"Could not enable two-factor authentication."})}
};
exports.disable=async(req,res)=>{
 if(!adminOnly(req,res))return;
 res.set("Cache-Control","no-store");
 try{
  const password=String(req.body?.password||""),code=String(req.body?.code||"").trim();
  const user=await User.findById(req.user._id).select("+password +totpSecretEncrypted +totpRecoveryCodeHashes +totpLastUsedStep");
  if(!user||!user.totpEnabled||!await bcrypt.compare(password,user.password))return res.status(403).json({message:"Incorrect password or two-factor authentication is disabled."});
  if(!await totp.consumeCode(user,code))return res.status(403).json({message:"Incorrect authenticator or recovery code."});
  const changed=await User.findOneAndUpdate({_id:user._id,totpEnabled:true},
  {$set:{totpEnabled:false,totpLastUsedStep:-1},$unset:{totpSecretEncrypted:"",totpPendingEncrypted:"",totpPendingExpiresAt:"",totpRecoveryCodeHashes:""},$inc:{sessionVersion:1}},{new:true});
  if(!changed)return res.status(409).json({message:"Security state changed. Please sign in again."});
  record(req,"auth.2fa_disabled","Administrator disabled authenticator verification.");
  const token=jwt.sign({id:changed._id,role:changed.role,sv:Number(changed.sessionVersion||0)},process.env.JWT_SECRET,{expiresIn:"2h"});
  return res.json({success:true,token,message:"Two-factor authentication disabled. Please enable it again when possible."});
 }catch(error){console.error("2FA disable failed:",error?.name);return res.status(503).json({message:"Could not disable two-factor authentication."});}
};
