const crypto=require("crypto");
const mongoose=require("mongoose");
const User=require("../models/User");
const Referral=require("../models/Referral");
const WalletTransaction=require("../models/WalletTransaction");
const notifications=require("./notificationService");

const cleanName=v=>String(v||"WAYNE").replace(/[^a-z0-9]/gi,"").toUpperCase().slice(0,6)||"WAYNE";
const positiveEnv=(name,fallback)=>{const n=Number(process.env[name]);return Number.isSafeInteger(n)&&n>0?n:fallback};

async function newCode(user){
  for(let i=0;i<12;i++){
    const code=cleanName(user.firstName)+crypto.randomBytes(3).toString("hex").toUpperCase();
    if(!await User.exists({referralCode:code}))return code;
  }
  throw new Error("Could not create referral code.");
}

exports.ensureReferralCode=async user=>{
  if(user.referralCode)return user.referralCode;
  for(let i=0;i<5;i++){
    try{
      const code=await newCode(user);
      const updated=await User.findOneAndUpdate({_id:user._id,$or:[{referralCode:{$exists:false}},{referralCode:null},{referralCode:""}]},{$set:{referralCode:code}},{new:true});
      if(updated?.referralCode)return updated.referralCode;
      const current=await User.findById(user._id).select("referralCode");
      if(current?.referralCode)return current.referralCode;
    }catch(e){if(e?.code!==11000)throw e}
  }
  throw new Error("Could not create referral code.");
};

exports.rewardForPurchase=async({userId,orderId,totalAmount})=>{
  const minimum=positiveEnv("REFERRAL_MIN_PURCHASE_KOBO",100000);
  const reward=positiveEnv("REFERRAL_REWARD_KOBO",100000);
  if(Math.round(Number(totalAmount||0)*100)<minimum)return null;
  const session=await mongoose.startSession();let paid=null;
  try{
    await session.withTransaction(async()=>{
      const referral=await Referral.findOneAndUpdate({referredUser:userId,status:"pending"},{$set:{status:"rewarded",qualifyingOrder:orderId,rewardAmountKobo:reward,rewardedAt:new Date()}},{new:true,session});
      if(!referral)return;
      const referrer=await User.findOneAndUpdate({_id:referral.referrer,isActive:true},{$inc:{walletBalanceKobo:reward}},{new:true,session});
      if(!referrer)throw new Error("Referrer unavailable.");
      await WalletTransaction.create([{user:referrer._id,type:"deposit",status:"completed",amountKobo:reward,currency:"NGN",reference:"REF-"+referral._id,provider:"referral",description:"Referral reward",balanceAfterKobo:referrer.walletBalanceKobo,verifiedAt:new Date()}],{session});
      paid={referralId:referral._id,user:referrer._id,reward};
    });
  }finally{await session.endSession()}
  if(paid)await notifications.create({user:paid.user,type:"referral",title:"Referral reward received",message:`₦${(paid.reward/100).toLocaleString("en-NG")} was added to your wallet.`,link:"dashboard.html",key:`referral:${paid.referralId}`}).catch(()=>{});
  return paid;
};
