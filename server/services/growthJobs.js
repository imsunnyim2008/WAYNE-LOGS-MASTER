const {Interest,GrowthConfig}=require("../models/Growth");
const Product=require("../models/Product"),Order=require("../models/Order"),WalletTransaction=require("../models/WalletTransaction"),User=require("../models/User");
const notifications=require("./notificationService");
let running=false;
async function run(){
 if(running)return;running=true;
 try{
 const ready=await Product.find({status:"active",stock:{$gt:0}}).select("_id name").lean();
 const names=new Map(ready.map(p=>[String(p._id),p.name]));
 const rows=await Interest.find({kind:"restock",product:{$in:ready.map(p=>p._id)}}).sort({createdAt:1}).limit(100).lean();
 for(const row of rows){try{const u=await User.findOne({_id:row.user,isActive:true}).select("_id");if(u)await notifications.create({user:row.user,type:"announcement",title:"Back in stock",message:names.get(String(row.product))+" is available again.",link:"index.html#shop",key:"restock:"+row.watchKey});await Interest.deleteOne({_id:row._id,watchKey:row.watchKey})}catch{}}
 await require("./marketingCampaign").runCampaign().catch(()=>console.error("Marketing campaign job failed."));
 if(!process.env.WAYNE_TELEGRAM_BOT_TOKEN||!process.env.WAYNE_TELEGRAM_CHAT_ID)return;
 const bucket=String(Math.floor(Date.now()/300000)),config=await GrowthConfig.findOneAndUpdate({key:"main",telegramEnabled:true,lastDigestBucket:{$ne:bucket}},{$set:{lastDigestBucket:bucket}},{new:true});
 if(!config)return;
 const since=new Date(Date.now()-300000),[paid,deposits,low]=await Promise.all([Order.countDocuments({paymentStatus:"paid",updatedAt:{$gte:since}}),WalletTransaction.countDocuments({type:"deposit",status:"completed",provider:"paystack",verifiedAt:{$gte:since}}),Product.countDocuments({status:"active",stock:{$lte:5}})]);
 if(!paid&&!deposits&&!low)return;
 const token=process.env.WAYNE_TELEGRAM_BOT_TOKEN;
 if(!/^\d+:[A-Za-z0-9_-]+$/.test(token))return;
 const response=await fetch("https://api.telegram.org/bot"+token+"/sendMessage",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({chat_id:process.env.WAYNE_TELEGRAM_CHAT_ID,text:"WAYNE LOGS 5-minute summary\nRecent paid orders: "+paid+"\nConfirmed Paystack deposits: "+deposits+"\nLow stock products: "+low}),signal:AbortSignal.timeout(8000)});
 if(!response.ok)console.error("Telegram digest delivery failed.");
 }finally{running=false}
}
module.exports={run};
