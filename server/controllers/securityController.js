const Order=require("../models/Order"),WalletTransaction=require("../models/WalletTransaction"),AuditLog=require("../models/AuditLog");
exports.overview=async(req,res)=>{try{
  const now=new Date(),today=new Date(now);today.setHours(0,0,0,0);const week=new Date(now);week.setDate(week.getDate()-7);
  const [failedPayments,refundsToday,cancelledOrders,adminCredits,recentWalletEvents,recentSecurityAudit]=await Promise.all([
    WalletTransaction.countDocuments({status:{$in:["failed","rejected"]},createdAt:{$gte:week}}),
    WalletTransaction.countDocuments({provider:"order_refund",status:"completed",createdAt:{$gte:today}}),
    Order.countDocuments({status:"cancelled",createdAt:{$gte:week}}),
    WalletTransaction.countDocuments({provider:"admin_credit",status:"completed",createdAt:{$gte:today}}),
    WalletTransaction.find({$or:[{status:{$in:["failed","rejected"]}},{provider:{$in:["admin_credit","admin_clear","order_refund"]}}]}).populate("user","firstName lastName email").populate("order","productName").sort({createdAt:-1}).limit(30),
    AuditLog.find({entity:"security"}).populate("admin","firstName lastName email").sort({createdAt:-1}).limit(20)
  ]);
  res.json({success:true,metrics:{failedPayments,refundsToday,cancelledOrders,adminCredits},protections:[{name:"Unique checkout requests",active:true,detail:"Repeated checkout requests reuse the same order."},{name:"Atomic wallet purchases",active:true,detail:"Balance, stock and delivery update together or not at all."},{name:"Purchase rate guard",active:true,detail:"Excessive purchase attempts are temporarily blocked."},{name:"Server-side pricing",active:true,detail:"Customers cannot submit or change product prices."},{name:"One-time inventory allocation",active:true,detail:"Each inventory record can be assigned only once."}],events:[...recentWalletEvents.map(item=>({date:item.createdAt,type:item.provider,status:item.status,email:item.user?.email||"",detail:item.order?.productName||item.description||"",amountKobo:item.amountKobo})),...recentSecurityAudit.map(item=>({date:item.createdAt,type:item.action,status:"recorded",email:item.target||"",detail:item.summary||"",amountKobo:0}))].sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,30)});
}catch(error){res.status(500).json({message:"Could not load security information."})}};
