const crypto=require("crypto");
const mongoose=require("mongoose");
const Order=require("../models/Order");
const Product=require("../models/Product");
const BASE="https://api.paystack.co";
async function ps(path,opts={}){
  if(!process.env.PAYSTACK_SECRET_KEY) throw new Error("PAYSTACK_KEY_MISSING");
  const r=await fetch(BASE+path,{...opts,headers:{Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY,"Content-Type":"application/json",...(opts.headers||{})}});
  const d=await r.json();
  if(!r.ok||d.status!==true){const e=new Error(d.message||"Paystack request failed.");e.code="PAYSTACK";throw e;}
  return d;
}
function meta(v){if(!v)return{};if(typeof v==="object")return v;try{return JSON.parse(v);}catch(e){return{};}}
async function finalize(orderId,ref){
  const session=await mongoose.startSession();let out;
  try{
    await session.withTransaction(async()=>{
      const o=await Order.findById(orderId).select("+deliveryContent").session(session);
      if(!o)throw new Error("ORDER_NOT_FOUND");
      if(o.paymentStatus==="paid"){out=o;return;}
      const p=await Product.findOneAndUpdate({_id:o.product,status:"active",stock:{$gte:o.quantity}},{$inc:{stock:-o.quantity}},{new:true,session}).select("+privateDelivery");
      if(!p)throw new Error("OUT_OF_STOCK");
      o.paymentStatus="paid";o.paymentReference=ref;o.paymentMethod="paystack";
      if(p.deliveryType==="instant"){o.deliveryContent=p.privateDelivery||"";o.status="completed";o.deliveredAt=new Date();}else{o.status="processing";}
      await o.save({session});out=o;
    });
    return out;
  }finally{await session.endSession();}
}
exports.create=async(req,res)=>{
  try{
    const{productId}=req.body;
    if(!mongoose.isValidObjectId(productId))return res.status(400).json({message:"Invalid product."});
    const p=await Product.findById(productId);
    if(!p||p.status!=="active"||p.stock<1)return res.status(400).json({message:"Product unavailable."});
    const o=await Order.create({user:req.user._id,product:p._id,productName:p.name,productIcon:p.icon,platform:p.platform,quantity:1,unitPrice:p.price,totalAmount:p.price,currency:p.currency||"NGN"});
    res.status(201).json({success:true,order:o});
  }catch(e){res.status(500).json({message:"Could not create order."});}
};
exports.initialize=async(req,res)=>{
  try{
    const o=await Order.findOne({_id:req.params.id,user:req.user._id});if(!o)return res.status(404).json({message:"Order not found."});
    if(o.paymentStatus==="paid")return res.status(400).json({message:"Order already paid."});
    const reference="WL"+o._id+Date.now();
    const front=(process.env.FRONTEND_URL||"http://127.0.0.1:5500").replace(/\/$/,"");
    const callback=front+"/orders.html?order="+o._id+"&payment=callback";
    const d=await ps("/transaction/initialize",{method:"POST",body:JSON.stringify({email:req.user.email,amount:String(Math.round(o.totalAmount*100)),currency:o.currency||"NGN",reference,callback_url:callback,metadata:JSON.stringify({orderId:String(o._id),userId:String(req.user._id)})})});
    o.paymentReference=d.data.reference;await o.save();
    res.json({success:true,authorizationUrl:d.data.authorization_url,reference:d.data.reference});
  }catch(e){res.status(500).json({message:e.code==="PAYSTACK"?e.message:"Could not initialize payment."});}
};
exports.verify=async(req,res)=>{
  try{
    const o=await Order.findOne({_id:req.params.id,user:req.user._id});if(!o)return res.status(404).json({message:"Order not found."});
    if(o.paymentStatus==="paid")return res.json({success:true,order:o});
    const reference=req.body.reference;if(!reference||o.paymentReference!==reference)return res.status(400).json({message:"Payment reference mismatch."});
    const d=await ps("/transaction/verify/"+encodeURIComponent(reference),{method:"GET"});const t=d.data,m=meta(t.metadata);
    if(t.status!=="success"||String(m.orderId)!==String(o._id)||Number(t.amount)!==Math.round(o.totalAmount*100)||String(t.currency).toUpperCase()!==String(o.currency||"NGN").toUpperCase())return res.status(400).json({message:"Payment verification failed."});
    const final=await finalize(o._id,reference);res.json({success:true,order:final});
  }catch(e){res.status(500).json({message:e.code==="PAYSTACK"?e.message:"Could not verify payment."});}
};
exports.mine=async(req,res)=>{
  try{
    const orders=await Order.find({user:req.user._id}).sort({createdAt:-1});const out=[];
    for(const o of orders){const row=o.toObject();if(o.paymentStatus==="paid"&&o.status==="completed"){const full=await Order.findById(o._id).select("+deliveryContent");row.deliveryContent=full.deliveryContent;}out.push(row);}
    res.json({success:true,orders:out});
  }catch(e){res.status(500).json({message:"Could not load orders."});}
};
exports.adminAll=async(req,res)=>{try{const orders=await Order.find().populate("user","firstName lastName email phone").sort({createdAt:-1});res.json({success:true,orders});}catch(e){res.status(500).json({message:"Could not load orders."});}};
exports.adminStatus=async(req,res)=>{try{const o=await Order.findById(req.params.id);if(!o)return res.status(404).json({message:"Order not found."});const s=req.body.status;if(!["pending","processing","completed","cancelled","refunded"].includes(s))return res.status(400).json({message:"Invalid status."});if(s==="completed"&&o.paymentStatus!=="paid")return res.status(400).json({message:"Unpaid order cannot be completed."});o.status=s;await o.save();res.json({success:true,order:o});}catch(e){res.status(500).json({message:"Could not update order."});}};
exports.webhook=async(req,res)=>{
  try{
    const secret=process.env.PAYSTACK_SECRET_KEY,sig=req.headers["x-paystack-signature"];
    if(!secret||!sig||!Buffer.isBuffer(req.body))return res.sendStatus(400);
    const calc=crypto.createHmac("sha512",secret).update(req.body).digest("hex");
    if(calc.length!==String(sig).length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(String(sig))))return res.sendStatus(401);
    const event=JSON.parse(req.body.toString("utf8"));if(event.event!=="charge.success")return res.sendStatus(200);
    const t=event.data,m=meta(t.metadata);if(!m.orderId||!mongoose.isValidObjectId(m.orderId))return res.sendStatus(200);
    const o=await Order.findById(m.orderId);if(!o||o.paymentStatus==="paid")return res.sendStatus(200);
    if(o.paymentReference!==t.reference||Number(t.amount)!==Math.round(o.totalAmount*100)||String(t.currency).toUpperCase()!==String(o.currency||"NGN").toUpperCase())return res.sendStatus(200);
    await finalize(o._id,t.reference);res.sendStatus(200);
  }catch(e){res.sendStatus(500);}
};
