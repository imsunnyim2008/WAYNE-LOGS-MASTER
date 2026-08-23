const Referral=require("../models/Referral");
const referralService=require("../services/referralService");
exports.mine=async(req,res)=>{try{
  const code=await referralService.ensureReferralCode(req.user);
  const [invited,rewarded,earned]=await Promise.all([
    Referral.countDocuments({referrer:req.user._id}),
    Referral.countDocuments({referrer:req.user._id,status:"rewarded"}),
    Referral.aggregate([{$match:{referrer:req.user._id,status:"rewarded"}},{$group:{_id:null,total:{$sum:"$rewardAmountKobo"}}}])
  ]);
  const front=String(process.env.FRONTEND_URL||"https://waynelogs.com").replace(/\/$/,"");
  res.json({success:true,code,link:`${front}/register.html?ref=${encodeURIComponent(code)}`,invited,rewarded,earnedKobo:earned[0]?.total||0,rewardKobo:Number(process.env.REFERRAL_REWARD_KOBO)||100000,minimumPurchaseKobo:Number(process.env.REFERRAL_MIN_PURCHASE_KOBO)||100000});
}catch(e){res.status(500).json({message:"Could not load referral details."})}};
