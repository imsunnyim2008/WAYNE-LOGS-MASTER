const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  firstName:{type:String,required:true,trim:true},
  lastName:{type:String,required:true,trim:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  phone:{type:String,required:true,trim:true},
  password:{type:String,required:true,minlength:6},
  role:{type:String,enum:["user","admin"],default:"user"},
  isActive:{type:Boolean,default:true},
  walletBalanceKobo:{type:Number,default:0,min:0},
  wayneId:{type:String,unique:true,sparse:true,uppercase:true,trim:true,index:true},
  referralCode:{type:String,unique:true,sparse:true,uppercase:true,trim:true,index:true},
  referredBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null,immutable:true},
  sessionVersion:{type:Number,default:0,min:0},
  mustChangePassword:{type:Boolean,default:false},
  temporaryPasswordUsedAt:{type:Date,default:null},
  notificationPreferences:{
    orderUpdates:{type:Boolean,default:true},walletAlerts:{type:Boolean,default:true},productAnnouncements:{type:Boolean,default:true},promotions:{type:Boolean,default:false}
  }
},{timestamps:true});
module.exports = mongoose.model("User",schema);
