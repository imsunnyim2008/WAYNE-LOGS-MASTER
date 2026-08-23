const mongoose=require("mongoose");
const schema=new mongoose.Schema({user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,index:true},type:{type:String,enum:["purchase","wallet","support","announcement"],required:true},title:{type:String,required:true,trim:true,maxlength:120},message:{type:String,required:true,trim:true,maxlength:500},link:{type:String,default:"notifications.html",maxlength:300},key:{type:String,default:null,maxlength:200},readAt:{type:Date,default:null}},{timestamps:true});
schema.index({user:1,createdAt:-1});schema.index({user:1,key:1},{unique:true,partialFilterExpression:{key:{$type:"string"}}});
module.exports=mongoose.model("Notification",schema);
