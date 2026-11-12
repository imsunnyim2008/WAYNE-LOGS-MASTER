"use strict";
const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true,unique:true,index:true},
  provider:{type:String,enum:["paystack"],default:"paystack"},
  status:{type:String,enum:["pending","active","failed"],default:"pending"},
  customerEmail:{type:String,required:true,lowercase:true,trim:true},
  customerCode:{type:String,default:""},
  accountNumber:{type:String,unique:true,sparse:true,default:undefined},
  accountName:{type:String,default:""},
  bankName:{type:String,default:""},
  bankSlug:{type:String,default:""},
  externalId:{type:String,default:""},
  lastRequestedAt:{type:Date,default:Date.now},
  assignedAt:{type:Date,default:null}
},{timestamps:true});
schema.index({customerEmail:1,status:1});
module.exports=mongoose.model("VirtualBankAccount",schema);
