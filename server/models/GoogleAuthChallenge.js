const mongoose=require("mongoose");
const schema=new mongoose.Schema({_id:{type:String},kind:{type:String,enum:["challenge","signup"],required:true},nonce:String,identity:{sub:String,email:String,firstName:String,lastName:String},expiresAt:{type:Date,required:true}},{versionKey:false});
schema.index({expiresAt:1},{expireAfterSeconds:0});
module.exports=mongoose.model("GoogleAuthChallenge",schema);
