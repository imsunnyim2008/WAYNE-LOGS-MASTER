const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  product:{type:mongoose.Schema.Types.ObjectId,ref:"Product",required:true,index:true},
  fingerprint:{type:String,required:true},
  encryptedContent:{type:String,required:true,select:false},
  status:{type:String,enum:["available","sold"],default:"available",index:true},
  soldTo:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null},
  order:{type:mongoose.Schema.Types.ObjectId,ref:"Order",default:null},
  soldAt:{type:Date,default:null}
},{timestamps:true});
schema.index({product:1,fingerprint:1},{unique:true});
schema.index({product:1,status:1,createdAt:1});
module.exports=mongoose.model("InventoryItem",schema);
