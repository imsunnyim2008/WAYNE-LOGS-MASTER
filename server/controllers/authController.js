const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const crypto=require("crypto");
const twoFactor=require("../services/twoFactorService");
const AuditLog=require("../models/AuditLog");
const User=require("../models/User");
const Referral=require("../models/Referral");
const referralService=require("../services/referralService");
const wayneIdService=require("../services/wayneIdService");
const emailService=require("../services/emailService");
const adminLoginIdentifier=require("../services/adminLoginIdentifier");
const verification=require("./emailVerificationController");
const verificationTokens=require("../services/verificationTokens");
const token=u=>jwt.sign({id:u._id,role:u.role,sv:Number(u.sessionVersion||0)},process.env.JWT_SECRET,{expiresIn:["admin","staff"].includes(u.role)?"2h":"7d"});
const attempts=new Map(),WINDOW=15*60*1000,MAX_ATTEMPTS=5;
function attemptKey(req,email){return String(req.ip||req.socket?.remoteAddress||"")+"|"+String(email||"").toLowerCase()}
const safe=u=>({id:u._id,wayneId:u.wayneId||"",username:u.username||"",firstName:u.firstName,lastName:u.lastName,email:u.email,phone:u.phone,role:u.role,staffPermissions:u.staffPermissions||[],isActive:u.isActive,walletBalanceKobo:u.walletBalanceKobo||0,referralCode:u.referralCode||"",mustChangePassword:!!u.mustChangePassword,notificationPreferences:u.notificationPreferences||{orderUpdates:true,walletAlerts:true,productAnnouncements:true,promotions:false},createdAt:u.createdAt});
exports.register=async(req,res)=>{
  let createdUser=null,emailFailed=false;
  try{
    const firstName=String(req.body.firstName||"").trim().slice(0,60),lastName=String(req.body.lastName||"").trim().slice(0,60),email=String(req.body.email||"").trim().toLowerCase().slice(0,254),phone=String(req.body.phone||"").trim().slice(0,30),password=String(req.body.password||"");
    const username=req.body.username===undefined?undefined:String(req.body.username||"").trim().toLowerCase();
    if(username!==undefined&&!/^[a-z0-9_]{3,24}$/.test(username))return res.status(400).json({message:"Choose a username with 3–24 letters, numbers or underscores."});
    if(req.body.confirmPassword!==undefined&&req.body.confirmPassword!==password)return res.status(400).json({message:"Passwords do not match."});
    const enteredCode=String(req.body.referralCode||"").trim().toUpperCase();
    if(!firstName||!lastName||!email||!phone||!password) return res.status(400).json({message:"All fields are required."});
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter a valid email address."});
    if(String(phone).replace(/\D/g,"").length<7)return res.status(400).json({message:"Enter a valid phone number."});
    if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/\d/.test(password))return res.status(400).json({message:"Use at least 8 characters with uppercase, lowercase and a number."});
    if(!verification.verificationReady())return res.status(503).json({message:"Email verification is temporarily unavailable. Please try again later."});
    if(await User.findOne({email})) return res.status(409).json({message:"Email already registered."});
    if(username&&await User.findOne({username}))return res.status(409).json({message:"Username already taken."});
    const referrer=enteredCode?await User.findOne({referralCode:enteredCode,isActive:true}):null;
    if(enteredCode&&!referrer)return res.status(400).json({message:"That referral code is not valid."});
    if(referrer&&String(referrer.phone).replace(/\D/g,"")===String(phone).replace(/\D/g,""))return res.status(400).json({message:"A referral cannot use the same phone number."});
    const hash=await bcrypt.hash(password,12);
    // Public registration can never create an administrator. Admin accounts are
    // created only through the protected seed/recovery process.
    const verificationRequired=verification.verificationRequired();
    const verifyToken=verificationRequired?verificationTokens.generate():null;
    const verificationTime=new Date();
    const u=await User.create({firstName,lastName,email,phone,password:hash,...(username?{username}:{}),role:"user",referredBy:referrer?referrer._id:null,
      emailVerified:!verificationRequired,
      ...(verificationRequired?{
        emailVerificationTokenHash:verificationTokens.hash(verifyToken),
        emailVerificationExpiresAt:verificationTokens.expiration(verificationTime),
        emailVerificationRequestedAt:verificationTime
      }:{})
    });
    createdUser=u;
    try{u.referralCode=await referralService.ensureReferralCode(u)}catch(error){console.error("Referral ID creation error:",error)}
    try{u.wayneId=await wayneIdService.ensureWayneId(u)}catch(error){console.error("WAYNE ID creation error:",error)}
    if(referrer)await Referral.create({referrer:referrer._id,referredUser:u._id,code:enteredCode});
    if(verificationRequired){
      try{
        await emailService.sendEmailVerification({to:u.email,firstName:u.firstName,verifyUrl:"https://www.waynelogs.com/verify-email.html#token="+verifyToken});
      }catch(error){emailFailed=true;throw error}
      return res.status(201).json({success:true,verificationRequired:true,message:"Check your email for your secure verification link. Verify your address before signing in."});
    }
    res.status(201).json({success:true,token:token(u),user:safe(u)});
  }catch(e){
    if(createdUser?._id){
      await Referral.deleteMany({referredUser:createdUser._id}).catch(()=>{});
      await User.deleteOne({_id:createdUser._id}).catch(()=>{});
    }
    if(e?.code===11000&&!createdUser)return res.status(409).json({message:e?.keyPattern?.username?"Username already taken.":"Email already registered."});
    if(emailFailed)console.error("Registration verification email failed:",String(e?.code||e?.name||"mail_error").slice(0,100));
    res.status(emailFailed?503:500).json({message:emailFailed?"Could not send your verification email. Please try again shortly.":"Could not register."});
  }
};
exports.login=async(req,res)=>{
  try{
    const{email,password}=req.body;
    const key=attemptKey(req,email),now=Date.now(),record=attempts.get(key);
    if(record&&record.until>now&&record.count>=MAX_ATTEMPTS)return res.status(429).json({message:"Too many failed login attempts. Try again in 15 minutes."});
    const u=await adminLoginIdentifier.resolveLoginUser(User,email,password,process.env.ADMIN_EMAIL);
    if(!u||!(await bcrypt.compare(password||"",u.password))){
      const active=record&&record.until>now?record:{count:0,until:now+WINDOW};active.count++;attempts.set(key,active);
      if(u&&["admin","staff"].includes(u.role))AuditLog.create({admin:u._id,action:"auth.failed",entity:"security",summary:"Incorrect password submitted at administrator login.",ipAddress:String(req.ip||"").slice(0,100),userAgent:String(req.get("user-agent")||"").slice(0,300),metadata:{count:active.count}}).catch(()=>{});
      return res.status(401).json({message:"Invalid email or password."})
    }
    if(!u.isActive) return res.status(403).json({message:"Account disabled."});
    if(u.role==="user"&&u.emailVerified===false)return res.status(403).json({code:"EMAIL_NOT_VERIFIED",message:"Please verify your email address before signing in."});
    try{u.referralCode=await referralService.ensureReferralCode(u)}catch(error){console.error("Referral ID login error:",error)}
    try{u.wayneId=await wayneIdService.ensureWayneId(u)}catch(error){console.error("WAYNE ID login error:",error)}
    if(u.mustChangePassword){const consumed=await User.findOneAndUpdate({_id:u._id,mustChangePassword:true,temporaryPasswordUsedAt:null},{$set:{temporaryPasswordUsedAt:new Date()}},{new:true});if(!consumed)return res.status(403).json({message:"This temporary password was already used. Ask the administrator for a new one."});u.temporaryPasswordUsedAt=consumed.temporaryPasswordUsedAt}
    attempts.delete(key);
    if(u.totpEnabled){
      const challenge=jwt.sign({id:u._id,sv:Number(u.sessionVersion||0),purpose:"totp-login"},process.env.JWT_SECRET,{expiresIn:"5m"});
      return res.json({success:true,requiresTwoFactor:true,challenge,message:"Enter the code from your authenticator app or a recovery code."});
    }
    if(u.role==="admin")AuditLog.create({admin:u._id,action:"auth.login",entity:"security",summary:"Administrator signed in.",ipAddress:String(req.ip||"").slice(0,100),userAgent:String(req.get("user-agent")||"").slice(0,300)}).catch(()=>{});
    res.json({success:true,token:token(u),user:safe(u)});
  }catch(e){console.error("Login error:",e);res.status(500).json({message:"Could not login."});}
};
exports.me=async(req,res)=>{try{try{req.user.referralCode=await referralService.ensureReferralCode(req.user)}catch(error){console.error("Referral ID profile error:",error)}try{req.user.wayneId=await wayneIdService.ensureWayneId(req.user)}catch(error){console.error("WAYNE ID profile error:",error)}res.json({success:true,user:safe(req.user)})}catch(e){res.status(500).json({message:"Could not load profile."})}};
exports.adminUsers=async(req,res)=>{
  try{const users=await User.find().select("-password").sort({createdAt:-1}).limit(1000);res.json({success:true,users});}
  catch(e){res.status(500).json({message:"Could not load users."});}
};
const assistanceAttempts=new Map();
function tempPassword(){const sets=["ABCDEFGHJKLMNPQRSTUVWXYZ","abcdefghijkmnopqrstuvwxyz","23456789","!@#$%&*?"];const pick=s=>s[crypto.randomInt(0,s.length)];const pool=sets.join("");const chars=sets.map(pick);while(chars.length<16)chars.push(pick(pool));for(let i=chars.length-1;i>0;i--){const j=crypto.randomInt(0,i+1);[chars[i],chars[j]]=[chars[j],chars[i]]}return chars.join("")}
exports.adminPasswordSearch=async(req,res)=>{try{const email=String(req.query.email||"").trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter a valid customer email."});const user=await User.findOne({email,role:"user"}).select("firstName lastName email phone isActive mustChangePassword temporaryPasswordUsedAt createdAt");if(!user)return res.status(404).json({message:"Customer not found."});res.json({success:true,customer:user})}catch(e){res.status(500).json({message:"Could not search for the customer."})}};
exports.adminTemporaryPassword=async(req,res)=>{try{
  if(req.user.role!=="admin")return res.status(403).json({message:"Only the owner admin may reset customer passwords."});
  res.set("Cache-Control","no-store");
  const email=String(req.body.email||"").trim().toLowerCase(),adminPassword=String(req.body.adminPassword||""),key=String(req.user._id),now=Date.now(),record=assistanceAttempts.get(key)||{count:0,until:now+15*60*1000};if(record.until<now){record.count=0;record.until=now+15*60*1000}if(record.count>=5)return res.status(429).json({message:"Too many incorrect attempts. Try again in 15 minutes."});
  const admin=await User.findById(req.user._id);if(!admin||!(await bcrypt.compare(adminPassword,admin.password))){record.count++;assistanceAttempts.set(key,record);return res.status(403).json({message:"Your admin password is incorrect. Nothing was changed."})}assistanceAttempts.delete(key);
  const customer=await User.findOne({email,role:"user",isActive:true});if(!customer)return res.status(404).json({message:"Active customer not found."});const temporaryPassword=tempPassword();customer.password=await bcrypt.hash(temporaryPassword,12);customer.mustChangePassword=true;customer.temporaryPasswordUsedAt=null;customer.sessionVersion=Number(customer.sessionVersion||0)+1;await customer.save();res.json({success:true,temporaryPassword,customer:{firstName:customer.firstName,lastName:customer.lastName,email:customer.email},message:"One-use temporary password created. It will be shown only in this response."});
}catch(e){res.status(500).json({message:"Could not create a temporary password."})}};
exports.changeTemporaryPassword=async(req,res)=>{try{
  res.set("Cache-Control","no-store");
  if(!req.user.mustChangePassword)return res.status(400).json({message:"This account does not require a password change."});const password=String(req.body.password||"");if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/\d/.test(password))return res.status(400).json({message:"Use at least 8 characters with uppercase, lowercase and a number."});const user=await User.findById(req.user._id);if(!user||!user.mustChangePassword)return res.status(400).json({message:"Password change is no longer required."});if(await bcrypt.compare(password,user.password))return res.status(400).json({message:"Your new password cannot be the temporary password."});user.password=await bcrypt.hash(password,12);user.mustChangePassword=false;user.temporaryPasswordUsedAt=null;user.sessionVersion=Number(user.sessionVersion||0)+1;await user.save();res.json({success:true,token:token(user),user:safe(user),message:"Your private password was created successfully."});
}catch(e){res.status(500).json({message:"Could not change the password."})}};


exports.updateProfile=async(req,res)=>{try{
  const firstName=String(req.body.firstName||"").trim().slice(0,60),lastName=String(req.body.lastName||"").trim().slice(0,60),phone=String(req.body.phone||"").trim().slice(0,30),email=String(req.body.email||"").trim().toLowerCase().slice(0,254),currentPassword=String(req.body.currentPassword||"");
  if(!firstName||!lastName||!phone||!email)return res.status(400).json({message:"Name, email and phone number are required."});
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter a valid email address."});
  if(phone.replace(/\D/g,"").length<7)return res.status(400).json({message:"Enter a valid phone number."});
  const user=await User.findById(req.user._id);if(!user)return res.status(404).json({message:"Account not found."});
  if(email!==user.email){if(!currentPassword||!(await bcrypt.compare(currentPassword,user.password)))return res.status(403).json({message:"Enter your current password to change your email."});if(verification.verificationRequired())return res.status(409).json({message:"Verified email changes require additional confirmation. Contact support to change your email address securely."});const exists=await User.findOne({email,_id:{$ne:user._id}});if(exists)return res.status(409).json({message:"That email address is already in use."})}
  user.firstName=firstName;user.lastName=lastName;user.phone=phone;user.email=email;await user.save();res.json({success:true,user:safe(user),message:"Account details updated."});
}catch(e){res.status(500).json({message:"Could not update account details."})}};
exports.changePassword=async(req,res)=>{try{
  res.set("Cache-Control","no-store");const currentPassword=String(req.body.currentPassword||""),password=String(req.body.password||"");
  if(password.length<8||!/[a-z]/.test(password)||!/[A-Z]/.test(password)||!/[0-9]/.test(password))return res.status(400).json({message:"Use at least 8 characters with uppercase, lowercase and a number."});
  const user=await User.findById(req.user._id);if(!user||!(await bcrypt.compare(currentPassword,user.password)))return res.status(403).json({message:"Your current password is incorrect."});
  if(await bcrypt.compare(password,user.password))return res.status(400).json({message:"Choose a password you have not just used."});
  user.password=await bcrypt.hash(password,12);user.mustChangePassword=false;user.temporaryPasswordUsedAt=null;user.sessionVersion=Number(user.sessionVersion||0)+1;await user.save();res.json({success:true,token:token(user),user:safe(user),message:"Password changed successfully."});
}catch(e){res.status(500).json({message:"Could not change password."})}};
exports.logoutAll=async(req,res)=>{try{await User.updateOne({_id:req.user._id},{$inc:{sessionVersion:1}});res.json({success:true,message:"All devices have been logged out."})}catch(e){res.status(500).json({message:"Could not end account sessions."})}};
exports.updatePreferences=async(req,res)=>{try{
  const input=req.body||{},preferences={orderUpdates:input.orderUpdates!==false,walletAlerts:input.walletAlerts!==false,productAnnouncements:input.productAnnouncements!==false,promotions:input.promotions===true};
  const user=await User.findByIdAndUpdate(req.user._id,{$set:{notificationPreferences:preferences}},{new:true});res.json({success:true,preferences:user.notificationPreferences,message:"Notification preferences saved."});
}catch(e){res.status(500).json({message:"Could not save notification preferences."})}};

exports.verifyTwoFactorLogin=async(req,res)=>{
  res.set("Cache-Control","no-store");
  const challenge=String(req.body?.challenge||""),code=String(req.body?.code||"").trim();
  if(challenge.length>2000||!code||code.length>64)return res.status(401).json({message:"Invalid or expired verification request."});
  try{
    const decoded=jwt.verify(challenge,process.env.JWT_SECRET,{algorithms:["HS256"]});
    if(decoded.purpose!=="totp-login")return res.status(401).json({message:"Invalid verification request."});
    const user=await User.findById(decoded.id).select("+totpSecretEncrypted +totpRecoveryCodeHashes +totpLastUsedStep");
    if(!user||!user.isActive||!user.totpEnabled||(user.role==="user"&&user.emailVerified===false)||Number(decoded.sv)!==Number(user.sessionVersion||0))return res.status(401).json({message:"Your verification session has expired. Sign in again."});
    if(!await twoFactor.consumeCode(user,code)){
      if(user.role!=="user")AuditLog.create({admin:user._id,action:"auth.2fa_failed",entity:"security",summary:"Incorrect authenticator or recovery code at login.",ipAddress:String(req.ip||"").slice(0,100),userAgent:String(req.get("user-agent")||"").slice(0,300)}).catch(()=>{});
      return res.status(401).json({message:"Code incorrect, expired or already used."});
    }
    if(user.role!=="user")AuditLog.create({admin:user._id,action:"auth.2fa_login",entity:"security",summary:"Administrator completed two-factor login.",ipAddress:String(req.ip||"").slice(0,100),userAgent:String(req.get("user-agent")||"").slice(0,300)}).catch(()=>{});
    return res.json({success:true,token:token(user),user:safe(user)});
  }catch(error){return res.status(401).json({message:"Verification session expired. Sign in again."});}
};

const googleAuth=require("../services/googleIdentity");
const GoogleAuthChallenge=require("../models/GoogleAuthChallenge");
const mongoose=require("mongoose");
const googleHash=s=>crypto.createHash("sha256").update(s).digest("hex");
const googleRandom=()=>crypto.randomBytes(32).toString("hex");
const googleValidSecret=s=>typeof s==="string"&&/^[a-f0-9]{64}$/.test(s);
async function googleSession(u,res,status=200){
 if(!u||u.role!=="user"||!u.isActive||u.emailVerified===false||u.mustChangePassword)return res.status(403).json({message:"Use your existing account sign-in method."});
 try{u.referralCode=await referralService.ensureReferralCode(u)}catch{}
 try{u.wayneId=await wayneIdService.ensureWayneId(u)}catch{}
 if(u.totpEnabled)return res.json({success:true,requiresTwoFactor:true,challenge:jwt.sign({id:u._id,sv:Number(u.sessionVersion||0),purpose:"totp-login"},process.env.JWT_SECRET,{expiresIn:"5m"})});
 return res.status(status).json({success:true,token:token(u),user:safe(u)});
}
exports.googleConfig=(req,res)=>{res.set("Cache-Control","no-store");res.json({enabled:!!googleAuth.clientId(),clientId:googleAuth.clientId()})};
exports.googleChallenge=async(req,res)=>{
 res.set("Cache-Control","no-store");if(!googleAuth.clientId())return res.status(503).json({message:"Google sign-in is not configured."});
 try{const secret=googleRandom(),nonce=googleRandom();await GoogleAuthChallenge.create({_id:googleHash(secret),kind:"challenge",nonce,expiresAt:new Date(Date.now()+10*60*1000)});res.json({challenge:secret,nonce})}catch{res.status(503).json({message:"Google sign-in is temporarily unavailable."})}
};
exports.googleLogin=async(req,res)=>{
 res.set("Cache-Control","no-store");if(!googleAuth.clientId())return res.status(503).json({message:"Google sign-in is not configured."});
 const secret=req.body?.challenge;if(!googleValidSecret(secret))return res.status(401).json({message:"Restart Google sign-in."});
 try{
 const filter={_id:googleHash(secret),kind:"challenge",expiresAt:{$gt:new Date()}};
 const challenge=await GoogleAuthChallenge.findOne(filter);if(!challenge)return res.status(401).json({message:"Google sign-in expired. Please reload and try again."});
 let identity;try{identity=await googleAuth.verifyGoogle(req.body?.credential,challenge.nonce)}catch{return res.status(401).json({message:"Google identity could not be verified. Please reload and try again."})}
 if(!await GoogleAuthChallenge.findOneAndDelete(filter))return res.status(401).json({message:"Google sign-in has already been used. Please reload."});
 const linked=await User.findOne({googleSubject:identity.sub});if(linked)return googleSession(linked,res);
 if(await User.exists({email:identity.email}))return res.status(409).json({message:"An account already uses this email. Sign in with your existing password. Google linking is not enabled for existing accounts."});
 if(!identity.authoritative)return res.status(400).json({message:"Use a Gmail or Google Workspace address, or register with email verification instead."});
 const signup=googleRandom();await GoogleAuthChallenge.create({_id:googleHash(signup),kind:"signup",identity:{sub:identity.sub,email:identity.email,firstName:identity.firstName,lastName:identity.lastName},expiresAt:new Date(Date.now()+10*60*1000)});
 res.json({success:true,requiresProfile:true,signup,profile:{email:identity.email,firstName:identity.firstName,lastName:identity.lastName}});
 }catch{res.status(503).json({message:"Could not complete Google sign-in. Please reload and try again."})}
};
exports.googleRegister=async(req,res)=>{
 res.set("Cache-Control","no-store");if(!googleAuth.clientId())return res.status(503).json({message:"Google sign-in is not configured."});
 const secret=req.body?.signup;if(!googleValidSecret(secret))return res.status(401).json({message:"Restart Google sign-in."});
 const username=String(req.body?.username||"").trim().toLowerCase(),phone=String(req.body?.phone||"").trim(),firstName=String(req.body?.firstName||"").trim(),lastName=String(req.body?.lastName||"").trim(),enteredCode=String(req.body?.referralCode||"").trim().toUpperCase();
 if(!/^[a-z0-9_]{3,24}$/.test(username)||!firstName||firstName.length>60||!lastName||lastName.length>60||phone.length>30||phone.replace(/\D/g,"").length<7||enteredCode.length>20)return res.status(400).json({message:"Enter a valid username, full name and phone number."});
 let session;
 try{
 const filter={_id:googleHash(secret),kind:"signup",expiresAt:{$gt:new Date()}};
 const hash=await bcrypt.hash(googleRandom(),12);
 session=await mongoose.startSession();let created;
 await session.withTransaction(async()=>{
 const ticket=await GoogleAuthChallenge.findOne(filter).session(session);if(!ticket)throw Object.assign(Error("Google sign-up expired. Please reload."),{status:401});
 const identity=ticket.identity;
 if(await User.exists({$or:[{email:identity.email},{googleSubject:identity.sub}]}).session(session))throw Object.assign(Error("Account already registered. Sign in instead."),{status:409});
 if(await User.exists({username}).session(session))throw Object.assign(Error("Username already taken."),{status:409});
 const referrer=enteredCode?await User.findOne({referralCode:enteredCode,isActive:true}).session(session):null;
 if(enteredCode&&!referrer)throw Object.assign(Error("That referral code is not valid."),{status:400});
 if(referrer&&String(referrer.phone).replace(/\D/g,"")===phone.replace(/\D/g,""))throw Object.assign(Error("A referral cannot use the same phone number."),{status:400});
 [created]=await User.create([{username,firstName,lastName,email:identity.email,phone,password:hash,googleSubject:identity.sub,role:"user",emailVerified:true,emailVerifiedAt:new Date(),referredBy:referrer?referrer._id:null}],{session});
 if(referrer)await Referral.create([{referrer:referrer._id,referredUser:created._id,code:enteredCode}],{session});
 const consumed=await GoogleAuthChallenge.deleteOne(filter,{session});if(consumed.deletedCount!==1)throw Object.assign(Error("Google sign-up expired."),{status:401});
 });
 return googleSession(created,res,201);
 }catch(e){if(e?.code===11000)return res.status(409).json({message:"Username or account already registered."});return res.status(e.status||503).json({message:e.status?e.message:"Could not create your Google account. Please try again."})}finally{if(session)await session.endSession()}
};
