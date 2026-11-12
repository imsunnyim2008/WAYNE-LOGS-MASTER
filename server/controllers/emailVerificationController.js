"use strict";
const User=require("../models/User");
const emailService=require("../services/emailService");
const tokens=require("../services/verificationTokens");
const COOLDOWN_MS=2*60*1000;
const GENERIC_MESSAGE="If an unverified customer account exists for that email, a verification link will be sent.";
function validEmail(input){
  const email=typeof input==="string"?input.trim().toLowerCase():"";
  return email.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)?email:"";
}
function reply(res){res.set("Cache-Control","no-store");return res.json({success:true,message:GENERIC_MESSAGE});}
exports.verificationRequired=()=>String(process.env.REQUIRE_EMAIL_VERIFICATION||"").toLowerCase()==="true";
exports.verificationReady=()=>!exports.verificationRequired()||emailService.isConfigured();
exports.verifyEmail=async(req,res)=>{
  res.set("Cache-Control","no-store");
  const token=typeof req.body?.token==="string"?req.body.token.trim().toLowerCase():"";
  if(!tokens.valid(token))return res.status(400).json({message:"This verification link is invalid. Request another email."});
  try{
    const fingerprint=tokens.hash(token);
    const verifiedAt=new Date();
    const user=await User.findOneAndUpdate({
      role:"user",isActive:true,emailVerified:false,
      emailVerificationTokenHash:fingerprint,
      emailVerificationExpiresAt:{$gt:verifiedAt}
    },{
      $set:{
        emailVerified:true,emailVerifiedAt:verifiedAt,
        emailVerificationUsedTokenHash:fingerprint,emailVerificationUsedAt:verifiedAt
      },
      $unset:{emailVerificationTokenHash:"",emailVerificationExpiresAt:"",emailVerificationRequestedAt:""},
      $inc:{sessionVersion:1}
    },{new:false,runValidators:true}).select("_id");
    if(user)return res.json({success:true,message:"Email verified successfully. You can now sign in."});

    // Gmail/in-app browsers may open the same link twice within milliseconds.
    // A used token only receives a positive acknowledgement for 15 minutes:
    // it cannot change a password, sign anyone in, or reactivate an account.
    const recentlyVerified=await User.exists({
      role:"user",isActive:true,emailVerified:true,
      emailVerificationUsedTokenHash:fingerprint,
      emailVerificationUsedAt:{$gt:new Date(Date.now()-15*60*1000)}
    });
    if(recentlyVerified)return res.json({success:true,message:"Email already verified. You can now sign in."});
    return res.status(400).json({message:"This link cannot be used. If you already verified, try signing in; otherwise request another email."});
  }catch(error){
    console.error("Email verification failed:",String(error?.name||"database_error").slice(0,100));
    return res.status(503).json({message:"Could not verify your email right now. Please try again."});
  }
};
exports.resendVerification=async(req,res)=>{
  res.set("Cache-Control","no-store");
  if(!emailService.isConfigured())return res.status(503).json({message:"Verification emails are temporarily unavailable. Please contact support."});
  const email=validEmail(req.body?.email);
  if(!email)return reply(res);
  try{
    const user=await User.findOne({email,role:"user",isActive:true,emailVerified:false}).select("firstName email");
    if(!user)return reply(res);
    const now=new Date(),raw=tokens.generate(),hashed=tokens.hash(raw);
    const changed=await User.updateOne({
      _id:user._id,emailVerified:false,
      $or:[{emailVerificationRequestedAt:{$exists:false}},{emailVerificationRequestedAt:{$lte:new Date(now.getTime()-COOLDOWN_MS)}}]
    },{
      $set:{emailVerificationTokenHash:hashed,emailVerificationExpiresAt:tokens.expiration(now),emailVerificationRequestedAt:now}
    });
    if(!changed.modifiedCount)return reply(res);
    try{
      await emailService.sendEmailVerification({to:user.email,firstName:user.firstName,verifyUrl:"https://www.waynelogs.com/verify-email.html#token="+raw});
    }catch(error){
      // Never expose whether the address exists; release the cooldown after SMTP failure.
      await User.updateOne({_id:user._id,emailVerificationTokenHash:hashed},{
        $unset:{emailVerificationTokenHash:"",emailVerificationExpiresAt:"",emailVerificationRequestedAt:""}
      }).catch(()=>{});
      console.error("Verification email delivery failed:",String(error?.code||error?.name||"mail_error").slice(0,100));
    }
    return reply(res);
  }catch(error){
    console.error("Verification resend failed:",String(error?.name||"database_error").slice(0,100));
    return res.status(503).json({message:"Verification email requests are temporarily unavailable."});
  }
};
