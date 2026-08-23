const mongoose=require("mongoose");
const replySchema=new mongoose.Schema({sender:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},role:{type:String,enum:["customer","admin"],required:true},message:{type:String,required:true,trim:true,maxlength:2000}},{timestamps:true,_id:true});
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},
  order:{type:mongoose.Schema.Types.ObjectId,ref:"Order",default:null},
  subject:{type:String,required:true,trim:true,maxlength:120},
  message:{type:String,required:true,trim:true,maxlength:2000},
  status:{type:String,enum:["open","in_progress","resolved"],default:"open",index:true},
  replies:{type:[replySchema],default:[]},
  lastReplyAt:{type:Date,default:Date.now}
},{timestamps:true});
schema.index({user:1,createdAt:-1});schema.index({status:1,lastReplyAt:-1});
module.exports=mongoose.model("SupportTicket",schema);
