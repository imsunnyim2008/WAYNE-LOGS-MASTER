const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const crypto=require("crypto");
const User=require("../models/User");
const Referral=require("../models/Referral");
const referralService=require("../services/referralService");
const token=u=>jwt.sign({id:u._id,role:u.role,sv:Number(u.sessionVersion||0)},process.env.JWT_SECRET,{expiresIn:u.role==="admin"?"2h":"7d"});
const attempts=new Map(),WINDOW=15*60*1000,MAX_ATTEMPTS=5;
function attemptKey(req,email){return String(req.ip||req.socket?.remoteAddress||"")+"|"+String(email||"").toLowerCase()}
const safe=u=>({id:u._id,firstName:u.firstName,lastName:u.lastName,email:u.email,phone:u.phone,role:u.role,isActive:u.isActive,walletBalanceKobo:u.walletBalanceKobo||0,referralCode:u.referralCode||"",mustChangePassword:!!u.mustChangePassword,createdAt:u.createdAt});
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
    if(u.mustChangePassword){const consumed=await User.findOneAndUpdate({_id:u._id,mustChangePassword:true,temporaryPasswordUsedAt:null},{$set:{temporaryPasswordUsedAt:new Date()}},{new:true});if(!consumed)return res.status(403).json({message:"This temporary password was already used. Ask the administrator for a new one."});u.temporaryPasswordUsedAt=consumed.temporaryPasswordUsedAt}
    attempts.delete(key);
    res.json({success:true,token:token(u),user:safe(u)});
  }catch(e){res.status(500).json({message:"Could not login."});}
};
exports.me=async(req,res)=>{try{req.user.referralCode=await referralService.ensureReferralCode(req.user);res.json({success:true,user:safe(req.user)})}catch(e){res.status(500).json({message:"Could not load profile."})}};
exports.adminUsers=async(req,res)=>{
  try{const users=await User.find().select("-password").sort({createdAt:-1});res.json({success:true,users});}
  catch(e){res.status(500).json({message:"Could not load users."});}
};
const assistanceAttempts=new Map();
function tempPassword(){const sets=["ABCDEFGHJKLMNPQRSTUVWXYZ","abcdefghijkmnopqrstuvwxyz","23456789","!@#$%&*?"];const pick=s=>s[crypto.randomInt(0,s.length)];const pool=sets.join("");const chars=sets.map(pick);while(chars.length<16)chars.push(pick(pool));for(let i=chars.length-1;i>0;i--){const j=crypto.randomInt(0,i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}return chars.join("")}
exports.adminPasswordSearch=async(req,res)=>{try{const email=String(req.query.email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter a valid customer email."});const user=await User.findOne({email,role:"user"}).select("firstName lastName email phone isActive mustChangePassword temporaryPasswordUsedAt createdAt");if(!user)return res.status(404).json({message:"Customer not found."});res.json({success:true,customer:user})}catch(e){res.status(500).json({message:"Could not search for the customer."})}};
exports.adminTemporaryPassword=async(req,res)=>{try{
  res.set("Cache-Control","no-store");
  const email=String(req.body.email||"").trim().toLowerCase(),adminPassword=String(req.body.adminPassword||""),key=String(req.user._id),now=Date.now(),record=assistanceAttempts.get(key)||{count:0,until:now+15*60*1000};if(record.until<now){record.count=0;record.until=now+15*60*1000}if(record.count>=5)return res.status(429).json({message:"Too many incorrect attempts. Try again in 15 minutes."});
  const admin=await User.findById(req.user._id);if(!admin||!(await bcrypt.compare(adminPassword,admin.password))){record.count++;assistanceAttempts.set(key,record);return res.status(403).json({message:"Your admin password is incorrect. Nothing was changed."})}assistanceAttempts.delete(key);
  const customer=await User.findOne({email,role:"user",isActive:true});if(!customer)return res.status(404).json({message:"Active customer not found."});const temporaryPassword=tempPassword();customer.password=await bcrypt.hash(temporaryPassword,12);customer.mustChangePassword=true;customer.temporaryPasswordUsedAt=null;customer.sessionVersion=Number(customer.sessionVersion||0)+1;await customer.save();res.json({success:true,temporaryPassword,customer:{firstName:customer.firstName,lastName:customer.lastName,email:customer.email},message:"One-use temporary password created. It will be shown only in this response."});
}catch(e){res.status(500).json({message:"Could not create a temporary password."})}};
exports.changeTemporaryPassword=async(req,res)=>{try{
  res.set("Cache-Control","no-store");
  if(!req.user.mustChangePassword)return res.status(400).json({message:"This account does not require a password change."});const password=String(req.body.password||"");if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/\d/.test(password))return res.status(400).json({message:"Use at least 8 characters with uppercase, lowercase and a number."});const user=await User.findById(req.user._id);if(!user||!user.mustChangePassword)return res.status(400).json({message:"Password change is no longer required."});if(await bcrypt.compare(password,user.password))return res.status(400).json({message:"Your new password cannot be the temporary password."});user.password=await bcrypt.hash(password,12);user.mustChangePassword=false;user.temporaryPasswordUsedAt=null;user.sessionVersion=Number(user.sessionVersion||0)+1;await user.save();res.json({success:true,token:token(user),user:safe(user),message:"Your private password was created successfully."});
}catch(e){res.status(500).json({message:"Could not change the password."})}};
