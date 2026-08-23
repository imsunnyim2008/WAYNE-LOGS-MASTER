const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const User=require("../models/User");
const Referral=require("../models/Referral");
const referralService=require("../services/referralService");
const token=u=>jwt.sign({id:u._id,role:u.role},process.env.JWT_SECRET,{expiresIn:u.role==="admin"?"2h":"7d"});
const attempts=new Map(),WINDOW=15*60*1000,MAX_ATTEMPTS=5;
function attemptKey(req,email){return String(req.ip||req.socket?.remoteAddress||"")+"|"+String(email||"").toLowerCase()}
const safe=u=>({id:u._id,firstName:u.firstName,lastName:u.lastName,email:u.email,phone:u.phone,role:u.role,isActive:u.isActive,walletBalanceKobo:u.walletBalanceKobo||0,referralCode:u.referralCode||"",createdAt:u.createdAt});
exports.register=async(req,res)=>{
  let createdUser=null;
  try{
    const{firstName,lastName,email,phone,password}=req.body;
    const enteredCode=String(req.body.referralCode||"").trim().toUpperCase();
    if(!firstName||!lastName||!email||!phone||!password) return res.status(400).json({message:"All fields are required."});
    if(await User.findOne({email:email.toLowerCase()})) return res.status(409).json({message:"Email already registered."});
    const referrer=enteredCode?await User.findOne({referralCode:enteredCode,isActive:true}):null;
    if(enteredCode&&!referrer)return res.status(400).json({message:"That referral code is not valid."});
    if(referrer&&String(referrer.phone).replace(/\D/g,"")===String(phone).replace(/\D/g,""))return res.status(400).json({message:"A referral cannot use the same phone number."});
    const hash=await bcrypt.hash(password,12);
    const role=process.env.ADMIN_EMAIL&&email.toLowerCase()===process.env.ADMIN_EMAIL.toLowerCase()?"admin":"user";
    const u=await User.create({firstName,lastName,email,phone,password:hash,role,referredBy:referrer?referrer._id:null});
    createdUser=u;
    u.referralCode=await referralService.ensureReferralCode(u);
    if(referrer)await Referral.create({referrer:referrer._id,referredUser:u._id,code:enteredCode});
    res.status(201).json({success:true,token:token(u),user:safe(u)});
  }catch(e){if(createdUser?._id)await User.deleteOne({_id:createdUser._id}).catch(()=>{});res.status(500).json({message:"Could not register."});}
};
exports.login=async(req,res)=>{
  try{
    const{email,password}=req.body;
    const key=attemptKey(req,email),now=Date.now(),record=attempts.get(key);
    if(record&&record.until>now&&record.count>=MAX_ATTEMPTS)return res.status(429).json({message:"Too many failed login attempts. Try again in 15 minutes."});
    const u=await User.findOne({email:(email||"").toLowerCase()});
    if(!u||!(await bcrypt.compare(password||"",u.password))){const active=record&&record.until>now?record:{count:0,until:now+WINDOW};active.count++;attempts.set(key,active);return res.status(401).json({message:"Invalid email or password."})}
    if(!u.isActive) return res.status(403).json({message:"Account disabled."});
    u.referralCode=await referralService.ensureReferralCode(u);
    attempts.delete(key);
    res.json({success:true,token:token(u),user:safe(u)});
  }catch(e){res.status(500).json({message:"Could not login."});}
};
exports.me=async(req,res)=>{try{req.user.referralCode=await referralService.ensureReferralCode(req.user);res.json({success:true,user:safe(req.user)})}catch(e){res.status(500).json({message:"Could not load profile."})}};
exports.adminUsers=async(req,res)=>{
  try{const users=await User.find().select("-password").sort({createdAt:-1});res.json({success:true,users});}
  catch(e){res.status(500).json({message:"Could not load users."});}
};
