const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  name:{type:String,required:true,trim:true},
  platform:{type:String,required:true,trim:true},
  type:{type:String,enum:["social","vpn"],required:true},
  description:{type:String,default:"",trim:true},
  price:{type:Number,required:true,min:0},
  currency:{type:String,default:"NGN"},
  stock:{type:Number,default:0,min:0},
  icon:{type:String,default:"★"},
  color1:{type:String,default:"#7c5cff"},
  color2:{type:String,default:"#ff5db1"},
  status:{type:String,enum:["active","inactive"],default:"active"},
  deliveryType:{type:String,enum:["manual","instant"],default:"manual"},
  privateDelivery:{type:String,default:"",select:false},
  createdBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"}
},{timestamps:true});
module.exports = mongoose.model("Product",schema);
