const crypto=require("crypto");
const AuditLog=require("../models/AuditLog");
const clean=(v,n=180)=>String(v||"").trim().slice(0,n);
function details(req){
  const method=req.method,path=req.originalUrl.split("?")[0],b=req.body||{},parts=path.split("/").filter(Boolean),tail=parts.at(-1),id=clean(["review","restock","status","replies","refund"].includes(tail)?parts.at(-2):tail);
  if(path.includes("/wallet/admin/transactions/")&&path.endsWith("/review"))return{action:b.decision==="approve"?"payment.approved":"payment.rejected",entity:"wallet",target:id,summary:`Manual payment ${b.decision==="approve"?"approved":"rejected"}.`,metadata:{decision:clean(b.decision,20),note:clean(b.note,200)}};
  if(path.endsWith("/wallet/admin/credit"))return{action:"wallet.credited",entity:"wallet",target:clean(b.email),summary:`Customer wallet credited with ₦${Number(b.amount||0).toLocaleString("en-NG")}.`,metadata:{email:clean(b.email),amount:Number(b.amount||0),reason:clean(b.reason,200)}};
  if(path.endsWith("/wallet/admin/clear"))return{action:"wallet.cleared",entity:"wallet",target:clean(b.email),summary:"Customer wallet balance cleared.",metadata:{email:clean(b.email),reason:clean(b.reason,200)}};
  if(path.includes("/products/admin/inventory/")&&path.endsWith("/restock"))return{action:"inventory.restocked",entity:"inventory",target:id,summary:`Inventory records submitted for restocking.`,metadata:{submitted:Array.isArray(b.inventoryItems)?b.inventoryItems.length:0}};
  if(path==="/api/products"&&method==="POST")return{action:"product.created",entity:"product",target:clean(b.name),summary:`Product created: ${clean(b.name)}.`,metadata:{platform:clean(b.platform),price:Number(b.price||0),inventoryCount:Array.isArray(b.inventoryItems)?b.inventoryItems.length:0}};
  if(/^\/api\/products\/[^/]+$/.test(path)&&method==="PUT")return{action:"product.updated",entity:"product",target:id,summary:`Product updated: ${clean(b.name)||id}.`,metadata:{platform:clean(b.platform),price:Number(b.price||0),inventoryCount:Array.isArray(b.inventoryItems)?b.inventoryItems.length:0}};
  if(/^\/api\/products\/[^/]+$/.test(path)&&method==="DELETE")return{action:"product.deleted",entity:"product",target:id,summary:"Product and its inventory deleted.",metadata:{}};
  if(path.includes("/orders/admin/")&&path.endsWith("/status"))return{action:"order.status_changed",entity:"order",target:id,summary:`Order status changed to ${clean(b.status,30)}.`,metadata:{status:clean(b.status,30)}};
  if(path.includes("/orders/admin/")&&path.endsWith("/refund"))return{action:"order.refunded",entity:"order",target:id,summary:"Paid wallet order refunded to the customer's wallet.",metadata:{reason:clean(b.reason,250)}};
  if(path==="/api/settings/admin")return{action:"settings.updated",entity:"settings",target:"main",summary:"Announcement or Telegram settings updated.",metadata:{announcementEnabled:b.announcementEnabled===true}};
  if(path.includes("/support/admin/")&&path.endsWith("/replies"))return{action:"support.replied",entity:"support",target:id,summary:"Administrator replied to a support ticket.",metadata:{resolved:b.resolve===true}};
  if(path.includes("/support/admin/")&&path.endsWith("/status"))return{action:"support.status_changed",entity:"support",target:id,summary:`Support status changed to ${clean(b.status,30)}.`,metadata:{status:clean(b.status,30)}};
  if(path.endsWith("/notifications/admin/broadcast"))return{action:"notification.broadcast",entity:"notification",target:"all-customers",summary:`Customer notification published: ${clean(b.title,120)}.`,metadata:{title:clean(b.title,120),link:clean(b.link,250)}};
  if(path.endsWith("/auth/admin/password-assistance/reset"))return{action:"password.temporary_issued",entity:"security",target:clean(b.email),summary:"One-use temporary customer password issued.",metadata:{email:clean(b.email)}};
  return null;
}
module.exports=(req,res,next)=>{
  if(!["POST","PUT","PATCH","DELETE"].includes(req.method))return next();
  const started=Date.now(),requestId=clean(req.headers["x-request-id"]||crypto.randomUUID(),100);
  res.on("finish",()=>{if(res.statusCode>=400||req.user?.role!=="admin")return;const event=details(req);if(!event)return;AuditLog.create({...event,admin:req.user._id,ipAddress:clean(req.headers["x-forwarded-for"]?.split(",")[0]||req.ip,100),userAgent:clean(req.headers["user-agent"],300),requestId,metadata:{...event.metadata,statusCode:res.statusCode,durationMs:Date.now()-started}}).catch(error=>console.error("Audit log write failed:",error.message))});
  next();
};
