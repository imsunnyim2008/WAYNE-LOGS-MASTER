const crypto=require("crypto"),mongoose=require("mongoose"),bcrypt=require("bcryptjs");
const User=require("../models/User"),WalletTransaction=require("../models/WalletTransaction"),provider=require("../services/paymentProvider");
const notifications=require("../services/notificationService");
const MIN_KOBO=Number(process.env.WALLET_MIN_TOPUP_KOBO||10000),MAX_KOBO=Number(process.env.WALLET_MAX_TOPUP_KOBO||500000000);
const creditAttempts=new Map();
async function credit(reference,v){
  const session=await mongoose.startSession(); let transaction;
  try{await session.withTransaction(async()=>{
    transaction=await WalletTransaction.findOne({reference}).session(session);
    if(!transaction)throw new Error("TOPUP_NOT_FOUND"); if(transaction.status==="completed")return;
    if(!v.successful||v.amountKobo!==transaction.amountKobo||String(v.currency).toUpperCase()!==transaction.currency)throw new Error("TOPUP_MISMATCH");
    const user=await User.findByIdAndUpdate(transaction.user,{$inc:{walletBalanceKobo:transaction.amountKobo}},{new:true,session});
    if(!user)throw new Error("USER_NOT_FOUND");
    transaction.status="completed";transaction.providerReference=v.reference;transaction.balanceAfterKobo=user.walletBalanceKobo;transaction.verifiedAt=new Date();await transaction.save({session});
  });if(transaction?.status==="completed")await notifications.create({user:transaction.user,type:"wallet",title:"Wallet funded",message:`₦${(transaction.amountKobo/100).toLocaleString("en-NG")} was added to your wallet.`,link:"dashboard.html",key:`wallet:${transaction.reference}`}).catch(()=>{});return transaction}finally{await session.endSession()}
}
exports.summary=async(req,res)=>{const user=await User.findById(req.user._id).select("walletBalanceKobo");res.json({success:true,wallet:{balanceKobo:user.walletBalanceKobo||0,currency:"NGN",withdrawalsEnabled:false,providers:{manualBank:true,kora:!!process.env.KORA_SECRET_KEY}}})};
exports.history=async(req,res)=>{const transactions=await WalletTransaction.find({user:req.user._id}).sort({createdAt:-1}).limit(200);res.json({success:true,transactions})};
exports.initialize=async(req,res)=>{try{
  const amountKobo=Math.round(Number(req.body.amount)*100);
  if(!Number.isSafeInteger(amountKobo)||amountKobo<MIN_KOBO||amountKobo>MAX_KOBO)return res.status(400).json({message:`Enter an amount between ₦${MIN_KOBO/100} and ₦${MAX_KOBO/100}.`});
  const selected=String(req.body.paymentMethod||"manual_bank").trim().toLowerCase();
  if(!["manual_bank","kora","korapay"].includes(selected))return res.status(400).json({message:"Choose Kora Pay or Manual Bank Transfer."});
  const method=selected==="korapay"?"kora":selected,reference="WLT-"+Date.now()+"-"+crypto.randomBytes(8).toString("hex"),front=(process.env.FRONTEND_URL||"http://127.0.0.1:5500").replace(/\/$/,"");
  const transaction=await WalletTransaction.create({user:req.user._id,type:"deposit",amountKobo,reference,provider:method,description:method==="kora"?"Kora wallet top-up":"Manual bank wallet top-up"});
  if(method==="manual_bank"){
    const bank={name:process.env.WALLET_BANK_NAME||"",accountName:process.env.WALLET_BANK_ACCOUNT_NAME||"",accountNumber:process.env.WALLET_BANK_ACCOUNT_NUMBER||""};
    if(!bank.name||!bank.accountName||!bank.accountNumber){transaction.status="failed";await transaction.save();return res.status(503).json({message:"Bank-transfer top-ups are not configured yet."})}
    return res.status(201).json({success:true,mode:"manual_bank",reference,amountKobo,bank});
  }
  try{const initialized=await provider.initializeTopup({providerName:method,email:req.user.email,firstName:req.user.firstName,lastName:req.user.lastName,phone:req.user.phone,amountKobo,reference,userId:req.user._id,callbackUrl:`${front}/dashboard.html?topup=callback&reference=${encodeURIComponent(reference)}`,webhookUrl:`${String(process.env.BACKEND_URL||"").replace(/\/$/,"")}/api/wallet/webhooks/${method}`});transaction.providerReference=initialized.providerReference||reference;await transaction.save();res.status(201).json({success:true,mode:"online",provider:method,reference,authorizationUrl:initialized.authorizationUrl})}
  catch(error){transaction.status="failed";await transaction.save();throw error}
}catch(error){res.status(503).json({message:error.message||"Could not start wallet top-up."})}};
exports.submitManual=async(req,res)=>{try{
  const customerReference=String(req.body.customerReference||"").trim().slice(0,100);
  if(customerReference.length<4)return res.status(400).json({message:"Enter the transfer reference from your bank."});
  const transaction=await WalletTransaction.findOneAndUpdate({reference:req.params.reference,user:req.user._id,type:"deposit",provider:"manual_bank",status:"pending"},{$set:{status:"submitted",customerReference,submittedAt:new Date()}},{new:true});
  if(!transaction)return res.status(409).json({message:"This top-up cannot be submitted again."});
  res.json({success:true,transaction});
}catch(error){res.status(500).json({message:"Could not submit transfer details."})}};
exports.verify=async(req,res)=>{try{const transaction=await WalletTransaction.findOne({reference:req.body.reference,user:req.user._id,type:"deposit"});if(!transaction)return res.status(404).json({message:"Top-up not found."});if(transaction.status==="completed")return res.json({success:true,transaction});if(transaction.provider!=="kora")return res.status(400).json({message:"This payment requires manual review."});const result=await provider.verifyTopup(transaction.providerReference||transaction.reference,transaction.provider);res.json({success:true,transaction:await credit(transaction.reference,result)})}catch(error){res.status(400).json({message:"Top-up has not been verified. Your wallet was not credited."})}};
exports.webhook=async(req,res)=>{try{const name=String(req.params.provider||"").toLowerCase();if(!Buffer.isBuffer(req.body)||!provider.verifyWebhook(name,req.body,req.headers))return res.sendStatus(401);const event=provider.parseWebhook(name,req.body);if(!event||!event.successful)return res.sendStatus(200);const transaction=await WalletTransaction.findOne({$or:[{reference:event.reference},{providerReference:event.reference}],type:"deposit"});if(transaction)await credit(transaction.reference,event);res.sendStatus(200)}catch(error){res.sendStatus(500)}};
exports.adminAll=async(req,res)=>{const transactions=await WalletTransaction.find().populate("user","firstName lastName email walletBalanceKobo").populate("order","productName totalAmount").sort({createdAt:-1}).limit(500);res.json({success:true,transactions})};
exports.adminReview=async(req,res)=>{
  const decision=req.body.decision;
  if(!["approve","reject"].includes(decision))return res.status(400).json({message:"Invalid decision."});
  const session=await mongoose.startSession();let transaction;
  try{await session.withTransaction(async()=>{
    transaction=await WalletTransaction.findOne({_id:req.params.id,type:"deposit",provider:"manual_bank"}).session(session);
    if(!transaction)throw Object.assign(new Error("Top-up not found."),{status:404});
    if(transaction.status==="completed")return;
    if(transaction.status!=="submitted")throw Object.assign(new Error("Only submitted top-ups can be reviewed."),{status:409});
    if(decision==="reject"){transaction.status="rejected";transaction.reviewedBy=req.user._id;transaction.reviewNote=String(req.body.note||"").slice(0,300);await transaction.save({session});return}
    const user=await User.findByIdAndUpdate(transaction.user,{$inc:{walletBalanceKobo:transaction.amountKobo}},{new:true,session});
    if(!user)throw new Error("USER_NOT_FOUND");
    transaction.status="completed";transaction.balanceAfterKobo=user.walletBalanceKobo;transaction.verifiedAt=new Date();transaction.reviewedBy=req.user._id;transaction.reviewNote="Bank receipt confirmed by admin";await transaction.save({session});
  });if(transaction?.status==="completed")await notifications.create({user:transaction.user,type:"wallet",title:"Wallet funded",message:`₦${(transaction.amountKobo/100).toLocaleString("en-NG")} was added to your wallet.`,link:"dashboard.html",key:`wallet:${transaction.reference}`}).catch(()=>{});res.json({success:true,transaction})}
  catch(error){res.status(error.status||500).json({message:error.status?error.message:"Could not review top-up."})}
  finally{await session.endSession()}
};
exports.adminCredit=async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),amountKobo=Math.round(Number(req.body.amount)*100),reason=String(req.body.reason||"").trim().slice(0,200),requestId=String(req.body.requestId||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80),adminPassword=String(req.body.adminPassword||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter the customer's registered email address."});
  if(!Number.isSafeInteger(amountKobo)||amountKobo<100||amountKobo>500000000)return res.status(400).json({message:"Enter a credit between ₦1 and ₦5,000,000."});
  if(reason.length<4)return res.status(400).json({message:"Enter a clear reason for this credit."});
  if(requestId.length<8)return res.status(400).json({message:"Invalid credit request."});
  const attemptKey=String(req.user._id),now=Date.now(),attempt=creditAttempts.get(attemptKey);
  if(attempt&&attempt.until>now&&attempt.count>=5)return res.status(429).json({message:"Too many incorrect password attempts. Wallet credits are locked for 15 minutes."});
  const admin=await User.findById(req.user._id).select("+password");
  if(!admin||!(await bcrypt.compare(adminPassword,admin.password))){const active=attempt&&attempt.until>now?attempt:{count:0,until:now+15*60*1000};active.count++;creditAttempts.set(attemptKey,active);return res.status(403).json({message:"Your admin password is incorrect. Credit was not added."})}
  creditAttempts.delete(attemptKey);
  const dailyLimit=Number(process.env.ADMIN_DAILY_CREDIT_LIMIT_KOBO||500000000),start=new Date();start.setHours(0,0,0,0);
  const totals=await WalletTransaction.aggregate([{$match:{provider:"admin_credit",status:"completed",createdAt:{$gte:start}}},{$group:{_id:null,total:{$sum:"$amountKobo"}}}]);
  if((totals[0]?.total||0)+amountKobo>dailyLimit)return res.status(429).json({message:`Daily admin credit limit of ₦${(dailyLimit/100).toLocaleString("en-NG")} would be exceeded.`});
  const reference="ADM-"+requestId;let transaction;const session=await mongoose.startSession();
  try{await session.withTransaction(async()=>{
    transaction=await WalletTransaction.findOne({reference}).session(session);
    if(transaction)return;
    const user=await User.findOneAndUpdate({email,isActive:true},{$inc:{walletBalanceKobo:amountKobo}},{new:true,session});
    if(!user)throw Object.assign(new Error("Customer not found."),{status:404});
    [transaction]=await WalletTransaction.create([{user:user._id,type:"deposit",status:"completed",amountKobo,currency:"NGN",reference,provider:"admin_credit",description:reason,balanceAfterKobo:user.walletBalanceKobo,verifiedAt:new Date(),reviewedBy:req.user._id,reviewNote:reason}],{session});
  });if(transaction)await notifications.create({user:transaction.user,type:"wallet",title:"Wallet credit received",message:`₦${(transaction.amountKobo/100).toLocaleString("en-NG")} was added: ${transaction.description}`,link:"dashboard.html",key:`wallet:${transaction.reference}`}).catch(()=>{});res.json({success:true,transaction})}
  catch(error){res.status(error.status||500).json({message:error.status?error.message:"Could not credit the wallet."})}
  finally{await session.endSession()}
};
