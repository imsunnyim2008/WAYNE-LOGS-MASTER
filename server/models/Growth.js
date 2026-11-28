const mongoose=require("mongoose");
const ObjectId=mongoose.Schema.Types.ObjectId;
const interestSchema=new mongoose.Schema({user:{type:ObjectId,required:true,index:true},product:{type:ObjectId,required:true,ref:"Product"},kind:{type:String,enum:["wishlist","restock"],required:true},watchKey:{type:String,required:true}},{timestamps:true});
interestSchema.index({user:1,product:1,kind:1},{unique:true});interestSchema.index({kind:1,createdAt:1});
const reviewSchema=new mongoose.Schema({user:{type:ObjectId,required:true},product:{type:ObjectId,required:true,index:true},order:{type:ObjectId,required:true},rating:{type:Number,required:true,min:1,max:5},comment:{type:String,maxlength:500,default:""},published:{type:Boolean,default:false}},{timestamps:true});
reviewSchema.index({user:1,product:1},{unique:true});
const configSchema=new mongoose.Schema({key:{type:String,unique:true,default:"main"},estimatedExpenseKobo:{type:Number,min:0,default:0},telegramEnabled:{type:Boolean,default:false},lastDigestBucket:{type:String,default:""}},{timestamps:true});
module.exports={Interest:mongoose.model("GrowthInterest",interestSchema),Review:mongoose.model("GrowthReview",reviewSchema),GrowthConfig:mongoose.model("GrowthConfig",configSchema)};
