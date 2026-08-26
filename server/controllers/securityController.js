const mongoose=require("mongoose"),Order=require("../models/Order"),WalletTransaction=require("../models/WalletTransaction"),AuditLog=require("../models/AuditLog"),Product=require("../models/Product"),InventoryItem=require("../models/InventoryItem"),maintenance=require("../services/maintenanceService");
exports.overview=async(req,res)=>{try{
  const now=new Date(),today=new Date(now);today.setHours(0,0,0,0);const week=new Date(now);week.setDate(week.getDate()-7);
  const stale=new Date(now.getTime()-30*60*1000);
  const [failedPayments,refundsToday,cancelledOrders,adminCredits,recentWalletEvents,recentSecurityAudit,paidNotDelivered,manualAwaitingReview,stalePending,inventoryProducts,availableCounts]=await Promise.all([
    WalletTransaction.countDocuments({status:{$in:["failed","rejected"]},createdAt:{$gte:week}}),
    WalletTransaction.countDocuments({provider:"order_refund",status:"completed",createdAt:{$gte:today}}),
    Order.countDocuments({status:"cancelled",createdAt:{$gte:week}}),
    WalletTransaction.countDocuments({provider:"admin_credit",status:"completed",createdAt:{$gte:today}}),
    WalletTransaction.find({$or:[{status:{$in:["failed","rejected"]}},{provider:{$in:["admin_credit","admin_clear","order_refund"]}}]}).populate("user","firstName lastName email").populate("order","productName").sort({createdAt:-1}).limit(30),
    AuditLog.find({entity:"security"}).populate("admin","firstName lastName email").sort({createdAt:-1}).limit(20),
    Order.countDocuments({paymentStatus:"paid",status:{$in:["pending","processing"]},createdAt:{$lte:stale}}),
    WalletTransaction.countDocuments({provider:"manual_bank",status:"submitted"}),
    Order.countDocuments({paymentStatus:"pending",status:"pending",createdAt:{$lte:new Date(now.getTime()-24*60*60*1000)}}),
    Product.find({inventoryManaged:true}).select("_id stock").lean(),
    InventoryItem.aggregate([{$match:{status:"available"}},{$group:{_id:"$product",count:{$sum:1}}}])
  ]);
  const counts=new Map(availableCounts.map(row=>[String(row._id),Number(row.count||0)])),inventoryMismatches=inventoryProducts.filter(product=>Number(product.stock)!==(counts.get(String(product._id))||0)).length;
  res.json({success:true,metrics:{failedPayments,refundsToday,cancelledOrders,adminCredits},stability:{databaseConnected:mongoose.connection.readyState===1,paidNotDelivered,manualAwaitingReview,stalePendingOrders:stalePending,inventoryMismatches,maintenance:maintenance.status()},protections:[{name:"Unique checkout requests",active:true,detail:"Repeated checkout requests reuse the same order."},{name:"Atomic wallet purchases",active:true,detail:"Balance, stock and delivery update together or not at all."},{name:"Automatic stock reconciliation",active:true,detail:"Managed product stock is checked against unused encrypted inventory every five minutes."},{name:"Purchase rate guard",active:true,detail:"Excessive purchase attempts are temporarily blocked."},{name:"Server-side pricing",active:true,detail:"Customers cannot submit or change product prices."},{name:"One-time inventory allocation",active:true,detail:"Each inventory record can be assigned only once."}],events:[...recentWalletEvents.map(item=>({date:item.createdAt,type:item.provider,status:item.status,email:item.user?.email||"",detail:item.order?.productName||item.description||"",amountKobo:item.amountKobo})),...recentSecurityAudit.map(item=>({date:item.createdAt,type:item.action,status:"recorded",email:item.target||"",detail:item.summary||"",amountKobo:0}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,30)});
}catch(error){res.status(500).json({message:"Could not load security information."})}};

