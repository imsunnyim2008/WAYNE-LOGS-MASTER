const mongoose=require("mongoose");
const bannerSchema=new mongoose.Schema({title:{type:String,required:true,maxlength:64},description:{type:String,required:true,maxlength:180},buttonLabel:{type:String,required:true,maxlength:24},productId:{type:String,default:"",match:/^(?:[a-f0-9]{24})?$/i},theme:{type:String,enum:["blue","navy","teal","purple"],default:"blue"},enabled:{type:Boolean,default:true},startsAt:{type:Date,default:null},endsAt:{type:Date,default:null}},{_id:false});
const schema=new mongoose.Schema({
  homepageBanners:{type:[bannerSchema],default:undefined,validate:v=>!v||v.length<=8},
  key:{type:String,default:"main",unique:true},
  announcementEnabled:{type:Boolean,default:false},
  announcementTitle:{type:String,default:"Welcome to WAYNE LOGS",maxlength:100},
  announcementMessage:{type:String,default:"",maxlength:600},
  telegramUrl:{type:String,default:"",maxlength:150},
  storeOpen:{type:Boolean,default:true},purchasesEnabled:{type:Boolean,default:true},currency:{type:String,default:"NGN",enum:["NGN"]},lowStockThreshold:{type:Number,default:3,min:0,max:1000},deliveryInstructions:{type:String,default:"Delivered after successful wallet payment.",maxlength:500},
  manualBankEnabled:{type:Boolean,default:true},onlinePaymentEnabled:{type:Boolean,default:false},minimumTopupKobo:{type:Number,default:10000,min:100},maximumTopupKobo:{type:Number,default:500000000,min:100},bankName:{type:String,default:"",maxlength:100},bankAccountName:{type:String,default:"",maxlength:120},bankAccountNumber:{type:String,default:"",maxlength:30}
},{timestamps:true});
module.exports=mongoose.model("SiteSetting",schema);
