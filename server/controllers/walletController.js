const crypto=require("crypto"),mongoose=require("mongoose");
const User=require("../models/User"),WalletTransaction=require("../models/WalletTransaction"),provider=require("../services/paymentProvider");
const MIN_KOBO=Number(process.env.WALLET_MIN_TOPUP_KOBO||10000),MAX_KOBO=Number(process.env.WALLET_MAX_TOPUP_KOBO||500000000);
async function credit(reference,v){
  const session=await mongoose.startSession(); let transaction;
  try{await session.withTransaction(async()=>{
    transaction=await WalletTransaction.findOne({reference}).session(session);
    if(!transaction)throw new Error("TOPUP_NOT_FOUND"); if(transaction.status==="completed")return;
    if(!v.successful||v.amountKobo!==transaction.amountKobo||String(v.currency).toUpperCase()!==transaction.currency)throw new Error("TOPUP_MISMATCH");
    const user=await User.findByIdAndUpdate(transaction.user,{$inc:{walletBalanceKobo:transaction.amountKobo}},{new:true,session});
    if(!user)throw new Error("USER_NOT_FOUND");
    transaction.status="completed";transaction.providerReference=v.reference;transaction.balanceAfterKobo=user.walletBalanceKobo;transaction.verifiedAt=new Date();await transaction.save({session});
  });return transaction}finally{await session.endSession()}
}
exports.summary=async(req,res)=>{const user=await User.findById(req.user._id).select("walletBalanceKobo");res.json({success:true,wallet:{balanceKobo:user.walletBalanceKobo||0,currency:"NGN",withdrawalsEnabled:false,provider:provider.name()}})};
exports.history=async(req,res)=>{const transactions=await WalletTransaction.find({user:req.user._id}).sort({createdAt:-1}).limit(200);res.json({success:true,transactions})};
exports.initialize=async(req,res)=>{try{
  const amountKobo=Math.round(Number(req.body.amount)*100);
  if(!Number.isSafeInteger(amountKobo)||amountKobo<MIN_KOBO||amountKobo>MAX_KOBO)return res.status(400).json({message:`Enter an amount between ₦${MIN_KOBO/100} and ₦${MAX_KOBO/100}.`});
  const reference="WLT-"+Date.now()+"-"+crypto.randomBytes(8).toString("hex"),front=(process.env.FRONTEND_URL||"http://127.0.0.1:5500").replace(/\/$/,"");
  const transaction=await WalletTransaction.create({user:req.user._id,type:"deposit",amountKobo,reference,provider:provider.name(),description:"Wallet top-up"});
  try{const initialized=await provider.initializeTopup({email:req.user.email,amountKobo,reference,userId:req.user._id,callbackUrl:`${front}/wallet.html?topup=callback&reference=${encodeURIComponent(reference)}`});transaction.providerReference=initialized.providerReference||reference;await transaction.save();res.status(201).json({success:true,reference,authorizationUrl:initialized.authorizationUrl})}
  catch(error){transaction.status="failed";await transaction.save();throw error}
}catch(error){res.status(503).json({message:error.message||"Could not start wallet top-up."})}};
exports.verify=async(req,res)=>{try{const transaction=await WalletTransaction.findOne({reference:req.body.reference,user:req.user._id,type:"deposit"});if(!transaction)return res.status(404).json({message:"Top-up not found."});if(transaction.status==="completed")return res.json({success:true,transaction});const result=await provider.verifyTopup(transaction.providerReference||transaction.reference);res.json({success:true,transaction:await credit(transaction.reference,result)})}catch(error){res.status(400).json({message:"Top-up has not been verified. Your wallet was not credited."})}};
exports.webhook=async(req,res)=>{try{const name=String(req.params.provider||"").toLowerCase();if(!Buffer.isBuffer(req.body)||!provider.verifyWebhook(name,req.body,req.headers))return res.sendStatus(401);const event=provider.parseWebhook(name,req.body);if(!event||!event.successful)return res.sendStatus(200);const transaction=await WalletTransaction.findOne({$or:[{reference:event.reference},{providerReference:event.reference}],type:"deposit"});if(transaction)await credit(transaction.reference,event);res.sendStatus(200)}catch(error){res.sendStatus(500)}};
exports.adminAll=async(req,res)=>{const transactions=await WalletTransaction.find().populate("user","firstName lastName email walletBalanceKobo").populate("order","productName totalAmount").sort({createdAt:-1}).limit(500);res.json({success:true,transactions})};
