const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  firstName:{type:String,required:true,trim:true},
  lastName:{type:String,required:true,trim:true},
  email:{type:String,required:true,unique:true,lowercase:true,trim:true},
  phone:{type:String,required:true,trim:true},
  password:{type:String,required:true,minlength:6},
  role:{type:String,enum:["user","admin","staff"],default:"user"},
  staffPermissions:[{type:String,enum:["products","orders","payments","customers","communications","settings","security"]}],
  adminNotes:[{text:{type:String,maxlength:500},admin:{type:mongoose.Schema.Types.ObjectId,ref:"User"},createdAt:{type:Date,default:Date.now}}],
  isActive:{type:Boolean,default:true},
  walletBalanceKobo:{type:Number,default:0,min:0},
  transferPin:{type:String,select:false,default:null},
  transferPinSetAt:{type:Date,default:null},
  wayneId:{type:String,unique:true,sparse:true,uppercase:true,trim:true,index:true},
  referralCode:{type:String,unique:true,sparse:true,uppercase:true,trim:true,index:true},
  referredBy:{type:mongoose.Schema.Types.ObjectId,ref:"User",default:null,immutable:true},
  sessionVersion:{type:Number,default:0,min:0},
  totpEnabled:{type:Boolean,default:false},
  totpSecretEncrypted:{type:String,select:false},
  totpPendingEncrypted:{type:String,select:false},
  totpPendingExpiresAt:{type:Date,select:false},
  totpRecoveryCodeHashes:{type:[String],select:false,default:[]},
  totpLastUsedStep:{type:Number,default:-1,select:false},
  mustChangePassword:{type:Boolean,default:false},
  temporaryPasswordUsedAt:{type:Date,default:null},
  passwordResetTokenHash:{type:String,select:false},
  passwordResetExpiresAt:{type:Date,select:false},
  passwordResetRequestedAt:{type:Date,select:false},
  notificationPreferences:{
    orderUpdates:{type:Boolean,default:true},walletAlerts:{type:Boolean,default:true},productAnnouncements:{type:Boolean,default:true},promotions:{type:Boolean,default:false}
  }
},{timestamps:true});
module.exports = mongoose.model("User",schema);
