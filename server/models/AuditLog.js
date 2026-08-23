const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  admin:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  action:{type:String,required:true,index:true,maxlength:80},
  entity:{type:String,required:true,index:true,maxlength:50},
  target:{type:String,default:"",maxlength:180},
  summary:{type:String,required:true,maxlength:500},
  metadata:{type:mongoose.Schema.Types.Mixed,default:{}},
  ipAddress:{type:String,default:"",maxlength:100},
  userAgent:{type:String,default:"",maxlength:300},
  requestId:{type:String,default:"",maxlength:100}
},{timestamps:true});
schema.index({createdAt:-1});schema.index({admin:1,createdAt:-1});
module.exports=mongoose.model("AuditLog",schema);
