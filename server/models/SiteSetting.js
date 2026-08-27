const mongoose=require("mongoose");
const schema=new mongoose.Schema({
  key:{type:String,default:"main",unique:true},
  announcementEnabled:{type:Boolean,default:false},
  announcementTitle:{type:String,default:"Welcome to WAYNE LOGS",maxlength:100},
  announcementMessage:{type:String,default:"",maxlength:600},
  telegramUrl:{type:String,default:"",maxlength:150},
  storeOpen:{type:Boolean,default:true},purchasesEnabled:{type:Boolean,default:true},currency:{type:String,default:"NGN",enum:["NGN"]},lowStockThreshold:{type:Number,default:3,min:0,max:1000},deliveryInstructions:{type:String,default:"Delivered after successful wallet payment.",maxlength:500},
  manualBankEnabled:{type:Boolean,default:true},onlinePaymentEnabled:{type:Boolean,default:false},minimumTopupKobo:{type:Number,default:10000,min:100},maximumTopupKobo:{type:Number,default:500000000,min:100},bankName:{type:String,default:"",maxlength:100},bankAccountName:{type:String,default:"",maxlength:120},bankAccountNumber:{type:String,default:"",maxlength:30}
},{timestamps:true});
module.exports=mongoose.model("SiteSetting",schema);
