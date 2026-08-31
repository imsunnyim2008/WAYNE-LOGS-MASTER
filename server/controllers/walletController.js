const crypto=require("crypto"),mongoose=require("mongoose"),bcrypt=require("bcryptjs");
const User=require("../models/User"),WalletTransaction=require("../models/WalletTransaction"),SiteSetting=require("../models/SiteSetting"),provider=require("../services/paymentProvider");
const notifications=require("../services/notificationService");
const wayneIdService=require("../services/wayneIdService");
const MIN_KOBO=Number(process.env.WALLET_MIN_TOPUP_KOBO||10000),MAX_KOBO=Number(process.env.WALLET_MAX_TOPUP_KOBO||500000000);
const creditAttempts=new Map();
const normalizeWayneId=value=>{const raw=String(value||"").trim().toUpperCase().replace(/\s+/g,"");return /^[A-F0-9]{10}$/.test(raw)?"WL-"+raw:raw};
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
exports.summary=async(req,res)=>{try{const user=await User.findById(req.user._id).select("walletBalanceKobo wayneId");if(!user)return res.status(404).json({message:"Account not found."});try{user.wayneId=await wayneIdService.ensureWayneId(user)}catch(error){console.error("WAYNE ID wallet error:",error)}res.json({success:true,wallet:{balanceKobo:user.walletBalanceKobo||0,wayneId:user.wayneId||"",currency:"NGN",withdrawalsEnabled:false,providers:{manualBank:true,kora:!!process.env.KORA_SECRET_KEY}}})}catch(error){res.status(500).json({message:"Could not load the wallet."})}};
exports.history=async(req,res)=>{try{const transactions=await WalletTransaction.find({user:req.user._id}).sort({createdAt:-1}).limit(250).lean();const safeTransactions=transactions.map(transaction=>{if(transaction.provider==="admin_credit")return{...transaction,description:"Wallet credit from WAYNE LOGS Admin",reviewNote:undefined,reviewedBy:undefined};return transaction});res.json({success:true,transactions:safeTransactions})}catch(error){res.status(500).json({message:"Could not load wallet transactions."})}};
exports.lookupTransferRecipient=async(req,res)=>{try{
  const wayneId=normalizeWayneId(req.params.wayneId);
  if(!/^WL-[A-F0-9]{10}$/.test(wayneId))return res.status(400).json({message:"Enter a valid WAYNE ID."});
  const recipient=await User.findOne({wayneId,isActive:true,role:"user"}).select("firstName lastName wayneId");
  if(!recipient)return res.status(404).json({message:"No active customer was found with that WAYNE ID."});
  if(String(recipient._id)===String(req.user._id))return res.status(400).json({message:"You cannot transfer credit to your own wallet."});
  const lastInitial=recipient.lastName?recipient.lastName.charAt(0).toUpperCase()+".":"";
  res.json({success:true,recipient:{wayneId:recipient.wayneId,name:[recipient.firstName,lastInitial].filter(Boolean).join(" ")}});
}catch(error){res.status(500).json({message:"Could not check that WAYNE ID."})}};
exports.transfer=async(req,res)=>{
  const wayneId=normalizeWayneId(req.body.wayneId);
  const amountKobo=Math.round(Number(req.body.amount)*100);
  const note=String(req.body.note||"").trim().slice(0,100);
  const requestId=String(req.body.requestId||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80);
  if(!/^WL-[A-F0-9]{10}$/.test(wayneId))return res.status(400).json({message:"Enter a valid WAYNE ID."});
  if(!Number.isSafeInteger(amountKobo)||amountKobo<10000||amountKobo>100000000)return res.status(400).json({message:"Enter an amount between ₦100 and ₦1,000,000."});
  if(requestId.length<12)return res.status(400).json({message:"Invalid transfer request. Refresh and try again."});
  const baseReference="TRF-"+requestId,session=await mongoose.startSession();let sender,recipient,outgoing;
  try{
    await session.withTransaction(async()=>{
      outgoing=await WalletTransaction.findOne({reference:baseReference+"-OUT"}).session(session);
      if(outgoing){sender=await User.findById(req.user._id).session(session);recipient=await User.findById(outgoing.counterparty).session(session);return}
      recipient=await User.findOne({wayneId,isActive:true,role:"user"}).session(session);
      if(!recipient)throw Object.assign(new Error("No active customer was found with that WAYNE ID."),{status:404});
      if(String(recipient._id)===String(req.user._id))throw Object.assign(new Error("You cannot transfer credit to your own wallet."),{status:400});
      sender=await User.findOneAndUpdate({_id:req.user._id,isActive:true,walletBalanceKobo:{$gte:amountKobo}},{$inc:{walletBalanceKobo:-amountKobo}},{new:true,session});
      if(!sender)throw Object.assign(new Error("Your wallet balance is not enough for this transfer."),{status:409});
      recipient=await User.findOneAndUpdate({_id:recipient._id,isActive:true},{$inc:{walletBalanceKobo:amountKobo}},{new:true,session});
      if(!recipient)throw Object.assign(new Error("The recipient account is unavailable."),{status:409});
      const description=note?`Credit transfer: ${note}`:"Customer credit transfer";
      [outgoing]=await WalletTransaction.create([{user:sender._id,type:"transfer_out",status:"completed",amountKobo,currency:"NGN",reference:baseReference+"-OUT",provider:"wayne_transfer",description,balanceAfterKobo:sender.walletBalanceKobo,verifiedAt:new Date(),counterparty:recipient._id}],{session});
      await WalletTransaction.create([{user:recipient._id,type:"transfer_in",status:"completed",amountKobo,currency:"NGN",reference:baseReference+"-IN",provider:"wayne_transfer",description,balanceAfterKobo:recipient.walletBalanceKobo,verifiedAt:new Date(),counterparty:sender._id}],{session});
    });
    await Promise.all([
      notifications.create({user:sender._id,type:"wallet",title:"Credit sent",message:`₦${(amountKobo/100).toLocaleString("en-NG")} was sent to ${recipient.wayneId}.`,link:"dashboard.html",key:`transfer:${baseReference}:out`}).catch(()=>{}),
      notifications.create({user:recipient._id,type:"wallet",title:"Credit received",message:`₦${(amountKobo/100).toLocaleString("en-NG")} was added to your wallet.`,link:"dashboard.html",key:`transfer:${baseReference}:in`}).catch(()=>{})
    ]);
    res.json({success:true,message:"Credit transferred successfully.",balanceKobo:sender.walletBalanceKobo,recipient:{wayneId:recipient.wayneId,firstName:recipient.firstName}});
  }catch(error){
    if(error?.code===11000)return res.status(409).json({message:"This transfer was already processed."});
    res.status(error.status||500).json({message:error.status?error.message:"The transfer could not be completed. No credit was moved."});
  }finally{await session.endSession()}
};
exports.initialize=async(req,res)=>{try{
  const settings=await SiteSetting.findOne({key:"main"});
  const minKobo=Number(settings?.minimumTopupKobo||MIN_KOBO),maxKobo=Number(settings?.maximumTopupKobo||MAX_KOBO);
  const amountKobo=Math.round(Number(req.body.amount)*100);
  if(!Number.isSafeInteger(amountKobo)||amountKobo<minKobo||amountKobo>maxKobo)return res.status(400).json({message:`Enter an amount between ₦${minKobo/100} and ₦${maxKobo/100}.`});
  const selected=String(req.body.paymentMethod||"manual_bank").trim().toLowerCase();
  if(!["manual_bank","kora","korapay"].includes(selected))return res.status(400).json({message:"Choose Kora Pay or Manual Bank Transfer."});
  const method=selected==="korapay"?"kora":selected;
  if(method==="manual_bank"&&settings?.manualBankEnabled===false)return res.status(503).json({message:"Manual bank funding is temporarily unavailable."});
  if(method==="kora"&&settings?.onlinePaymentEnabled!==true)return res.status(503).json({message:"Online wallet funding is temporarily unavailable."});
  const reference="WLT-"+Date.now()+"-"+crypto.randomBytes(8).toString("hex"),front=(process.env.FRONTEND_URL||"http://127.0.0.1:5500").replace(/\/$/,"");
  const transaction=await WalletTransaction.create({user:req.user._id,type:"deposit",amountKobo,reference,provider:method,description:method==="kora"?"Kora wallet top-up":"Manual bank wallet top-up"});
  if(method==="manual_bank"){
    const bank={name:settings?.bankName||process.env.WALLET_BANK_NAME||"",accountName:settings?.bankAccountName||process.env.WALLET_BANK_ACCOUNT_NAME||"",accountNumber:settings?.bankAccountNumber||process.env.WALLET_BANK_ACCOUNT_NUMBER||""};
    if(!bank.name||!bank.accountName||!bank.accountNumber){transaction.status="failed";await transaction.save();return res.status(503).json({message:"Bank-transfer top-ups are not configured yet."})}
    return res.status(201).json({success:true,mode:"manual_bank",reference,amountKobo,bank});
  }
  try{const initialized=await provider.initializeTopup({providerName:method,email:req.user.email,firstName:req.user.firstName,lastName:req.user.lastName,phone:req.user.phone,amountKobo,reference,userId:req.user._id,callbackUrl:`${front}/dashboard.html?topup=callback&reference=${encodeURIComponent(reference)}`,webhookUrl:`${String(process.env.BACKEND_URL||"").replace(/\/$/,"")}/api/wallet/webhooks/${method}`});transaction.providerReference=initialized.providerReference||reference;await transaction.save();res.status(201).json({success:true,mode:"online",provider:method,reference,authorizationUrl:initialized.authorizationUrl})}
  catch(error){transaction.status="failed";await transaction.save();throw error}
}catch(error){res.status(503).json({message:error.message||"Could not start wallet top-up."})}};
exports.submitManual=async(req,res)=>{try{
  const customerReference=String(req.body.customerReference||"").trim().toUpperCase().replace(/\s+/g," ").slice(0,100);
  if(customerReference.length<4)return res.status(400).json({message:"Enter the transfer reference from your bank."});
  const receipt=req.body.receipt&&typeof req.body.receipt==="object"?req.body.receipt:{};
  const receiptFileName=String(receipt.fileName||"").replace(/[\\/<>:"|?*\x00-\x1F]/g,"_").trim().slice(0,180);
  const receiptMimeType=String(receipt.mimeType||"").trim().toLowerCase(),allowedMimeTypes=new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
  if(!receiptFileName||!allowedMimeTypes.has(receiptMimeType)||typeof receipt.data!=="string")return res.status(400).json({message:"Upload a JPG, PNG, WEBP image or PDF payment receipt."});
  const match=receipt.data.match(/^data:([^;,]+);base64,([A-Za-z0-9+/]+={0,2})$/);
  if(!match||match[1].toLowerCase()!==receiptMimeType)return res.status(400).json({message:"The payment receipt file is invalid. Upload it again."});
  const receiptBuffer=Buffer.from(match[2],"base64");
  if(!receiptBuffer.length||receiptBuffer.length>3*1024*1024)return res.status(413).json({message:"The payment receipt must be no larger than 3 MB."});
  const current=await WalletTransaction.findOne({reference:req.params.reference,user:req.user._id,type:"deposit",provider:"manual_bank",status:"pending"});
  if(!current)return res.status(409).json({message:"This top-up cannot be submitted again."});
  const duplicate=await WalletTransaction.findOne({_id:{$ne:current._id},provider:"manual_bank",customerReference,status:{$in:["submitted","completed"]}}).select("_id");
  if(duplicate)return res.status(409).json({message:"This bank reference was already submitted. Enter the unique reference for this transfer."});
  const transaction=await WalletTransaction.findOneAndUpdate({_id:current._id,status:"pending"},{$set:{status:"submitted",customerReference,submittedAt:new Date(),receiptFileName,receiptMimeType,receiptData:receipt.data}},{new:true});
  if(!transaction)return res.status(409).json({message:"This top-up cannot be submitted again."});
  res.json({success:true,transaction});
}catch(error){res.status(500).json({message:"Could not submit transfer details."})}};
exports.verify=async(req,res)=>{try{const transaction=await WalletTransaction.findOne({reference:req.body.reference,user:req.user._id,type:"deposit"});if(!transaction)return res.status(404).json({message:"Top-up not found."});if(transaction.status==="completed")return res.json({success:true,transaction});if(transaction.provider!=="kora")return res.status(400).json({message:"This payment requires manual review."});const result=await provider.verifyTopup(transaction.providerReference||transaction.reference,transaction.provider);res.json({success:true,transaction:await credit(transaction.reference,result)})}catch(error){res.status(400).json({message:"Top-up has not been verified. Your wallet was not credited."})}};
exports.webhook=async(req,res)=>{try{const name=String(req.params.provider||"").toLowerCase();if(!Buffer.isBuffer(req.body)||!provider.verifyWebhook(name,req.body,req.headers))return res.sendStatus(401);const event=provider.parseWebhook(name,req.body);if(!event||!event.successful)return res.sendStatus(200);const transaction=await WalletTransaction.findOne({$or:[{reference:event.reference},{providerReference:event.reference}],type:"deposit"});if(transaction)await credit(transaction.reference,event);res.sendStatus(200)}catch(error){res.sendStatus(500)}};
exports.adminAll=async(req,res)=>{try{const transactions=await WalletTransaction.find().populate("user","firstName lastName email walletBalanceKobo").populate("order","productName totalAmount").sort({createdAt:-1}).limit(1000);res.json({success:true,transactions})}catch(error){res.status(500).json({message:"Could not load wallet transactions."})}};
exports.adminReceipt=async(req,res)=>{try{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid payment ID."});
  const transaction=await WalletTransaction.findOne({_id:req.params.id,type:"deposit",provider:"manual_bank"}).select("+receiptData receiptFileName receiptMimeType");
  if(!transaction||!transaction.receiptData)return res.status(404).json({message:"No payment receipt is attached to this transfer."});
  res.json({success:true,receipt:{fileName:transaction.receiptFileName,mimeType:transaction.receiptMimeType,data:transaction.receiptData}});
}catch(error){res.status(500).json({message:"Could not open the payment receipt."})}};
exports.adminReview=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid top-up ID."});
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
exports.adminTransferPinStatus=async(req,res)=>{try{const admin=await User.findById(req.user._id).select("transferPinSetAt");res.json({success:true,configured:!!admin?.transferPinSetAt,setAt:admin?.transferPinSetAt||null})}catch(error){res.status(500).json({message:"Could not check transfer PIN status."})}};
exports.setAdminTransferPin=async(req,res)=>{
  const adminPassword=String(req.body.adminPassword||""),pin=String(req.body.pin||""),confirmPin=String(req.body.confirmPin||"");
  if(!/^\d{4}$/.test(pin))return res.status(400).json({message:"Your transfer PIN must contain exactly 4 numbers."});
  if(pin!==confirmPin)return res.status(400).json({message:"The two transfer PIN entries do not match."});
  const admin=await User.findById(req.user._id).select("+password +transferPin");
  if(!admin||!(await bcrypt.compare(adminPassword,admin.password)))return res.status(403).json({message:"Your admin password is incorrect. The transfer PIN was not changed."});
  admin.transferPin=await bcrypt.hash(pin,12);admin.transferPinSetAt=new Date();await admin.save();
  res.json({success:true,message:"Your 4-digit transfer PIN is ready."});
};
exports.adminCredit=async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),amountKobo=Math.round(Number(req.body.amount)*100),reason=String(req.body.reason||"").trim().slice(0,200),requestId=String(req.body.requestId||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80),transferPin=String(req.body.transferPin||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter the customer's registered email address."});
  if(!Number.isSafeInteger(amountKobo)||amountKobo<100||amountKobo>500000000)return res.status(400).json({message:"Enter a credit between ₦1 and ₦5,000,000."});
  if(reason.length<4)return res.status(400).json({message:"Enter a clear reason for this credit."});
  if(requestId.length<8)return res.status(400).json({message:"Invalid credit request."});
  if(!/^\d{4}$/.test(transferPin))return res.status(400).json({message:"Enter your 4-digit transfer PIN."});
  const attemptKey=String(req.user._id),now=Date.now(),attempt=creditAttempts.get(attemptKey);
  if(attempt&&attempt.until>now&&attempt.count>=5)return res.status(429).json({message:"Too many incorrect PIN attempts. Wallet credits are locked for 15 minutes."});
  const admin=await User.findById(req.user._id).select("+transferPin");
  if(!admin?.transferPin)return res.status(409).json({message:"Create your 4-digit transfer PIN before crediting a wallet."});
  if(!(await bcrypt.compare(transferPin,admin.transferPin))){const active=attempt&&attempt.until>now?attempt:{count:0,until:now+15*60*1000};active.count++;creditAttempts.set(attemptKey,active);return res.status(403).json({message:"Your transfer PIN is incorrect. Credit was not added."})}
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
  });if(transaction)await notifications.create({user:transaction.user,type:"wallet",title:"Wallet credit received",message:`₦${(transaction.amountKobo/100).toLocaleString("en-NG")} was added to your wallet by WAYNE LOGS Admin.`,link:"dashboard.html",key:`wallet:${transaction.reference}`}).catch(()=>{});res.json({success:true,transaction})}
  catch(error){res.status(error.status||500).json({message:error.status?error.message:"Could not credit the wallet."})}
  finally{await session.endSession()}
};
exports.adminClear=async(req,res)=>{
  const email=String(req.body.email||"").trim().toLowerCase(),reason=String(req.body.reason||"").trim().slice(0,200),requestId=String(req.body.requestId||"").replace(/[^A-Za-z0-9_-]/g,"").slice(0,80),adminPassword=String(req.body.adminPassword||"");
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({message:"Enter the customer's registered email address."});
  if(reason.length<4)return res.status(400).json({message:"Enter a clear reason for removing the balance."});
  if(requestId.length<8)return res.status(400).json({message:"Invalid clear-balance request."});
  const attemptKey="clear:"+String(req.user._id),now=Date.now(),attempt=creditAttempts.get(attemptKey);
  if(attempt&&attempt.until>now&&attempt.count>=5)return res.status(429).json({message:"Too many incorrect password attempts. Balance clearing is locked for 15 minutes."});
  const admin=await User.findById(req.user._id).select("+password");
  if(!admin||!(await bcrypt.compare(adminPassword,admin.password))){const active=attempt&&attempt.until>now?attempt:{count:0,until:now+15*60*1000};active.count++;creditAttempts.set(attemptKey,active);return res.status(403).json({message:"Your admin password is incorrect. The balance was not changed."})}
  creditAttempts.delete(attemptKey);
  const reference="CLR-"+requestId;let transaction;const session=await mongoose.startSession();
  try{await session.withTransaction(async()=>{
    transaction=await WalletTransaction.findOne({reference}).session(session);if(transaction)return;
    const user=await User.findOne({email,isActive:true,role:"user"}).session(session);
    if(!user)throw Object.assign(new Error("Active customer not found."),{status:404});
    const removed=Number(user.walletBalanceKobo||0);
    if(removed<1)throw Object.assign(new Error("This customer's wallet is already ₦0."),{status:409});
    user.walletBalanceKobo=0;await user.save({session});
    [transaction]=await WalletTransaction.create([{user:user._id,type:"adjustment",status:"completed",amountKobo:removed,currency:"NGN",reference,provider:"admin_clear",description:"Balance cleared: "+reason,balanceAfterKobo:0,verifiedAt:new Date(),reviewedBy:req.user._id,reviewNote:reason}],{session});
  });
  if(transaction)await notifications.create({user:transaction.user,type:"wallet",title:"Wallet balance adjusted",message:`Your wallet balance was set to ₦0. Reason: ${reason}`,link:"dashboard.html",key:`wallet:${transaction.reference}`}).catch(()=>{});
  res.json({success:true,transaction,removedKobo:transaction?.amountKobo||0});
  }catch(error){res.status(error.status||500).json({message:error.status?error.message:"Could not clear the wallet balance."})}
  finally{await session.endSession()}
};

