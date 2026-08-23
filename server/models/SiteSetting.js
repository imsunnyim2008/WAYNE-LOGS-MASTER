const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  key:{type:String,default:"main",unique:true},
  announcementEnabled:{type:Boolean,default:false},
  announcementTitle:{type:String,default:"Welcome to WAYNE LOGS",maxlength:100},
  announcementMessage:{type:String,default:"",maxlength:600},
  telegramUrl:{type:String,default:"",maxlength:150}
},{timestamps:true});
module.exports=mongoose.model("SiteSetting",schema);
