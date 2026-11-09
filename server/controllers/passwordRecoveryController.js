"use strict";
const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const User=require("../models/User");
const emailService=require("../services/emailService");

const EXPIRES_MS=15*60*1000;
const COOLDOWN_MS=2*60*1000;
const genericMessage="If an active customer account exists for that email, a password reset link will be sent.";
function hashToken(token){return crypto.createHash("sha256").update(token).digest("hex");}
function validPassword(password){return password.length>=8&&password.length<=128&&/[a-z]/.test(password)&&/[A-Z]/.test(password)&&/[0-9]/.test(password);}
function emailAddress(input){return typeof input==="string"&&input.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input)?input.toLowerCase():"";}
function reply(res){return res.status(200).json({success:true,message:genericMessage});}

exports.status=(req,res)=>{
  res.set("Cache-Control","no-store");
  res.json({success:true,available:emailService.isConfigured()});
};

exports.forgotPassword=async(req,res)=>{
  res.set("Cache-Control","no-store");
  if(!emailService.isConfigured())return res.status(503).json({message:"Email password recovery has not been configured yet. Please contact support."});
  const email=emailAddress(typeof req.body?.email==="string"?req.body.email.trim():"");
  if(!email)return reply(res);
  try{
    const user=await User.findOne({email,role:"user",isActive:true}).select("email firstName +passwordResetRequestedAt");
    if(!user)return reply(res);
    const now=new Date();
    const raw=crypto.randomBytes(32).toString("hex");
    const hashed=hashToken(raw);
    const changed=await User.updateOne({
      _id:user._id,
      $or:[{passwordResetRequestedAt:{$exists:false}},{passwordResetRequestedAt:{$lte:new Date(now.getTime()-COOLDOWN_MS)}}]
    },{$set:{passwordResetTokenHash:hashed,passwordResetExpiresAt:new Date(now.getTime()+EXPIRES_MS),passwordResetRequestedAt:now}});
    if(!changed.modifiedCount)return reply(res);
    const resetUrl="https://www.waynelogs.com/reset-password.html#token="+raw;
    try{
      await emailService.sendPasswordReset({to:user.email,firstName:user.firstName,resetUrl});
    }catch(error){
      // Never reveal whether a customer email exists; permit retries after delivery failure.
      await User.updateOne({_id:user._id,passwordResetTokenHash:hashed},
        {$unset:{passwordResetTokenHash:"",passwordResetExpiresAt:"",passwordResetRequestedAt:""}}).catch(()=>{});
      console.error("Password recovery mail delivery failed:",String(error?.code||error?.name||"mail_error").slice(0,100));
    }
    return reply(res);
  }catch(error){
    console.error("Password recovery request failed:",String(error?.name||"database_error").slice(0,100));
    return res.status(503).json({message:"Password recovery is temporarily unavailable. Try again shortly."});
  }
};

exports.resetPassword=async(req,res)=>{
  res.set("Cache-Control","no-store");
  const raw=typeof req.body?.token==="string"?req.body.token.trim().toLowerCase():"";
  const password=typeof req.body?.password==="string"?req.body.password:"";
  if(!/^[0-9a-f]{64}$/.test(raw))return res.status(400).json({message:"This reset link is invalid or has expired. Request a new one."});
  if(!validPassword(password))return res.status(400).json({message:"Use 8–128 characters including uppercase, lowercase and a number."});
  try{
    const encrypted=await bcrypt.hash(password,12);
    // Atomic match, password update, token removal, and session revocation.
    const changed=await User.findOneAndUpdate({
      passwordResetTokenHash:hashToken(raw),
      passwordResetExpiresAt:{$gt:new Date()},
      role:"user",isActive:true
    },{
      $set:{password:encrypted,mustChangePassword:false,temporaryPasswordUsedAt:null},
      $unset:{passwordResetTokenHash:"",passwordResetExpiresAt:"",passwordResetRequestedAt:""},
      $inc:{sessionVersion:1}
    },{new:false,runValidators:true}).select("_id");
    if(!changed)return res.status(400).json({message:"This reset link has expired or was already used. Request a new one."});
    return res.json({success:true,message:"Password changed successfully. Sign in with your new password."});
  }catch(error){
    console.error("Password reset failed:",String(error?.name||"database_error").slice(0,100));
    return res.status(503).json({message:"Could not change your password. Please try again."});
  }
};
