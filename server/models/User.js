const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  firstName:{type:String,required:true,trim:true},
  lastName:{type:String,required:true,trim:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  phone:{type:String,required:true,trim:true},
  password:{type:String,required:true,minlength:6},
  role:{type:String,enum:["user","admin"],default:"user"},
  isActive:{type:Boolean,default:true}
},{timestamps:true});
module.exports = mongoose.model("User",schema);
