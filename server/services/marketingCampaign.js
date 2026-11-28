const {Campaign}=require("../models/Growth"),User=require("../models/User"),jwt=require("jsonwebtoken"),mail=require("./emailService");
async function runCampaign(){
 if(!mail.isConfigured())return;
 const now=new Date(),c=await Campaign.findOneAndUpdate({activeKey:"active",status:{$in:["queued","running"]},$or:[{leaseUntil:null},{leaseUntil:{$lt:now}}]},{$set:{status:"running",leaseUntil:new Date(Date.now()+4*60*1000)}},{new:true});
 if(!c)return;
 try{
 for(let i=0;i<5;i++){
 const fresh=await Campaign.findOne({_id:c._id,status:"running"});if(!fresh)return;
 const u=await User.findOne({role:"user",isActive:true,emailVerified:true,emailVerifiedAt:{$ne:null},emailMarketingOptIn:true,...(fresh.cursor?{_id:{$gt:fresh.cursor}}:{})}).sort({_id:1}).select("email").lean();
 if(!u){await Campaign.updateOne({_id:c._id,status:"running"},{$set:{status:"finished"},$unset:{activeKey:"",leaseUntil:""}});return}
 // Advance cursor before external send: never resend an uncertain delivery automatically.
 const claimed=await Campaign.updateOne({_id:c._id,status:"running",cursor:fresh.cursor},{$set:{cursor:u._id},$inc:{processed:1}});
 if(!claimed.modifiedCount)return;
 const optedIn=await User.exists({_id:u._id,emailMarketingOptIn:true,isActive:true,emailVerified:true});if(!optedIn)continue;
 try{const token=jwt.sign({id:String(u._id),purpose:"marketing-optout"},process.env.JWT_SECRET,{expiresIn:"365d"});await mail.sendMarketing({to:u.email,subject:fresh.subject,message:fresh.message,unsubscribeUrl:"https://waynelogs.com/unsubscribe.html#token="+token});await Campaign.updateOne({_id:c._id},{$inc:{sent:1}})}catch{await Campaign.updateOne({_id:c._id},{$inc:{failed:1}})}
 }
 }finally{await Campaign.updateOne({_id:c._id,status:"running",leaseUntil:c.leaseUntil},{$set:{leaseUntil:null}})}
}
module.exports={runCampaign};
