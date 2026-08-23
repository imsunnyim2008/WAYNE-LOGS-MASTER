const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  referrer:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  referredUser:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,unique:true,index:true},
  code:{type:String,required:true,uppercase:true,trim:true},
  status:{type:String,enum:["pending","rewarded"],default:"pending",index:true},
  qualifyingOrder:{type:mongoose.Schema.Types.ObjectId,ref:"Order",default:null},
  rewardAmountKobo:{type:Number,default:0,min:0},
  rewardedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({referrer:1,createdAt:-1});
module.exports=mongoose.model("Referral",schema);
