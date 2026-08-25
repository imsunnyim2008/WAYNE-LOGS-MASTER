const crypto=require("crypto");
const User=require("../models/User");

function createId(){
  return "WL-"+crypto.randomBytes(5).toString("hex").toUpperCase();
}

exports.ensureWayneId=async user=>{
  if(user.wayneId)return user.wayneId;
  for(let attempt=0;attempt<8;attempt++){
    const wayneId=createId();
    try{
      const updated=await User.findOneAndUpdate(
        {_id:user._id,$or:[{wayneId:{$exists:false}},{wayneId:null},{wayneId:""}]},
        {$set:{wayneId}},
        {new:true}
      ).select("wayneId");
      if(updated?.wayneId)return updated.wayneId;
      const existing=await User.findById(user._id).select("wayneId");
      if(existing?.wayneId)return existing.wayneId;
    }catch(error){
      if(error?.code!==11000)throw error;
    }
  }
  throw new Error("Could not create a WAYNE ID.");
};
