const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  type:{type:String,enum:["deposit","purchase"],required:true,index:true},
  status:{type:String,enum:["pending","completed","failed"],default:"pending",index:true},
  amountKobo:{type:Number,required:true,min:1}, currency:{type:String,default:"NGN"},
  reference:{type:String,required:true,unique:true,index:true}, provider:{type:String,default:"wallet"},
  providerReference:{type:String,default:""}, order:{type:mongoose.Schema.Types.ObjectId,ref:"Order",default:null},
  description:{type:String,default:""}, balanceAfterKobo:{type:Number,default:null}, verifiedAt:{type:Date,default:null}
},{timestamps:true});
module.exports=mongoose.model("WalletTransaction",schema);
