const mongoose = require("mongoose");
const schema = new mongoose.Schema({
  user:{type:mongoose.Schema.Types.ObjectId,ref:"User",required:true},
  product:{type:mongoose.Schema.Types.ObjectId,ref:"Product",required:true},
  productName:{type:String,required:true},
  productIcon:{type:String,default:"★"},
  platform:{type:String,default:""},
  quantity:{type:Number,default:1,min:1},
  unitPrice:{type:Number,required:true,min:0},
  totalAmount:{type:Number,required:true,min:0},
  currency:{type:String,default:"NGN"},
  status:{type:String,enum:["pending","processing","completed","cancelled","refunded"],default:"pending"},
  paymentStatus:{type:String,enum:["pending","paid","failed","refunded"],default:"pending"},
  paymentMethod:{type:String,enum:["wallet","paystack","manual"],default:"wallet"},
  paymentReference:{type:String,default:""},
  purchaseRequestId:{type:String,default:undefined,unique:true,sparse:true,index:true,select:false},
  activePurchaseKey:{type:String,default:undefined,unique:true,sparse:true,index:true,select:false},
  deliveryContent:{type:String,default:"",select:false},
  inventoryItem:{type:mongoose.Schema.Types.ObjectId,ref:"InventoryItem",default:null,select:false},
  receiptEmailSentAt:{type:Date,default:null},
  deliveredAt:{type:Date,default:null}
},{timestamps:true});
module.exports = mongoose.model("Order",schema);
