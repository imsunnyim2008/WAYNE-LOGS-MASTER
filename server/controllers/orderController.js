const crypto=require("crypto");
const bcrypt=require("bcryptjs");
const mongoose=require("mongoose");
const Order=require("../models/Order");
const Product=require("../models/Product");
const User=require("../models/User");
const WalletTransaction=require("../models/WalletTransaction");
const InventoryItem=require("../models/InventoryItem");
const inventoryCrypto=require("../services/inventoryCrypto");
const emailService=require("../services/emailService");
const notifications=require("../services/notificationService");
const referralService=require("../services/referralService");
const BASE="https://api.paystack.co";
const refundAttempts=new Map();

async function ps(path,opts={}){
  if(!process.env.PAYSTACK_SECRET_KEY){
    const e=new Error("Payment is not configured yet. Add PAYSTACK_SECRET_KEY in Render.");
    e.code="CONFIG";
    throw e;
  }
  const r=await fetch(BASE+path,{
    ...opts,
    signal:opts.signal||AbortSignal.timeout(Math.max(5000,Number(process.env.PAYMENT_PROVIDER_TIMEOUT_MS||15000))),
    headers:{
      Authorization:"Bearer "+process.env.PAYSTACK_SECRET_KEY,
      "Content-Type":"application/json",
      ...(opts.headers||{})
    }
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok||d.status!==true){
    const e=new Error(d.message||"Paystack rejected the payment request.");
    e.code="PAYSTACK";
    throw e;
  }
  return d;
}

function meta(v){
  if(!v)return{};
  if(typeof v==="object")return v;
  try{return JSON.parse(v)}catch{return{}}
}

async function sendPurchaseEmails(orderId){
  if(!emailService.isConfigured())return;
  const claimed=await Order.findOneAndUpdate({_id:orderId,paymentStatus:"paid",receiptEmailSentAt:null},{$set:{receiptEmailSentAt:new Date()}},{new:true}).populate("user","firstName lastName email");
  if(claimed?.user){try{await emailService.sendPurchaseReceipt({user:claimed.user,order:claimed})}catch(e){await Order.updateOne({_id:claimed._id},{$set:{receiptEmailSentAt:null}});console.error("Receipt email failed:",e.message)}}
  const threshold=Number(process.env.LOW_STOCK_THRESHOLD||5);
  const product=await Product.findOneAndUpdate({_id:claimed?.product,stock:{$lte:threshold},lowStockAlertSentAt:null},{$set:{lowStockAlertSentAt:new Date()}},{new:true});
  if(product){try{await emailService.sendLowStockAlert({product,threshold})}catch(e){await Product.updateOne({_id:product._id},{$set:{lowStockAlertSentAt:null}});console.error("Low-stock email failed:",e.message)}}
}

async function repairPaidInventoryOrder(orderId,userId){
  const session=await mongoose.startSession();let repaired=null;
  try{await session.withTransaction(async()=>{
    const order=await Order.findOne({_id:orderId,user:userId,paymentStatus:"paid"}).select("+deliveryContent +inventoryItem").session(session);
    if(!order)return;
    if(order.inventoryItem&&order.deliveryContent){repaired=order;return}
    let item=null;
    if(order.inventoryItem)item=await InventoryItem.findOne({_id:order.inventoryItem,order:order._id,soldTo:userId,status:"sold"}).select("+encryptedContent").session(session);
    else item=await InventoryItem.findOneAndUpdate({product:order.product,status:"available"},{$set:{status:"sold",soldTo:userId,order:order._id,soldAt:new Date()}},{new:true,sort:{createdAt:1},session}).select("+encryptedContent");
    if(!item){repaired=order;return}
    order.inventoryItem=item._id;order.deliveryContent=inventoryCrypto.decrypt(item.encryptedContent);order.status="completed";order.deliveredAt=order.deliveredAt||new Date();await order.save({session});repaired=order;
  });return repaired}finally{await session.endSession()}
}

async function finalize(orderId,ref){
  const session=await mongoose.startSession();
  let out;
  try{
    await session.withTransaction(async()=>{
      const o=await Order.findById(orderId).select("+deliveryContent").session(session);
      if(!o)throw new Error("ORDER_NOT_FOUND");
      if(o.paymentStatus==="paid"){out=o;return}

      const p=await Product.findById(o.product).select("+privateDelivery").session(session);

      // Payment is already real at this point, so always mark it paid first.
      o.paymentStatus="paid";
      o.paymentReference=ref;
      o.paymentMethod="paystack";
      o.activePurchaseKey=undefined;

      if(p && p.status==="active" && Number(p.stock)>=Number(o.quantity)){
        p.stock=Number(p.stock)-Number(o.quantity);
        await p.save({session});

        if(p.deliveryType==="instant"){
          o.deliveryContent=p.privateDelivery||"";
          o.status="completed";
          o.deliveredAt=new Date();
        }else{
          o.status="processing";
        }
      }else{
        // Never leave a genuinely paid customer showing as unpaid.
        // Admin can manually fulfill or refund if stock changed before payment completed.
        o.status="processing";
      }

      await o.save({session});
      out=o;
    });
    if(out?._id)await sendPurchaseEmails(out._id).catch(e=>console.error("Purchase email task failed:",e.message));
    return out;
  }finally{
    await session.endSession();
  }
}

exports.create=async(req,res)=>{
  try{
    const {productId}=req.body,requestId=String(req.body.requestId||"").trim();
    if(!mongoose.isValidObjectId(productId))return res.status(400).json({message:"Invalid product."});
    if(!/^[A-Za-z0-9_-]{16,100}$/.test(requestId))return res.status(400).json({message:"This checkout request is invalid. Refresh the store and try again."});
    const replay=await Order.findOne({user:req.user._id,purchaseRequestId:requestId});
    if(replay)return res.json({success:true,order:replay,replayed:true});

    const p=await Product.findById(productId);
    if(!p||p.status!=="active"||Number(p.stock)<1)return res.status(400).json({message:"This product is currently unavailable."});

    // Reuse an existing unpaid order for the same item so repeated payment attempts
    // do not create a pile of duplicate pending orders.
    const activePurchaseKey=`${req.user._id}:${p._id}`;
    let o=await Order.findOne({
      user:req.user._id,
      product:p._id,
      paymentStatus:"pending",
      status:"pending"
    }).sort({createdAt:-1}).select("+purchaseRequestId +activePurchaseKey");

    if(!o){
      o=await Order.create({
        user:req.user._id,
        product:p._id,
        productName:p.name,
        productIcon:p.icon,
        platform:p.platform,
        quantity:1,
        unitPrice:p.price,
        totalAmount:p.price,
        currency:p.currency||"NGN",
        purchaseRequestId:requestId,
        activePurchaseKey
      });
    }else{let changed=false;if(!o.purchaseRequestId){o.purchaseRequestId=requestId;changed=true}if(!o.activePurchaseKey){o.activePurchaseKey=activePurchaseKey;changed=true}if(changed)await o.save()}

    res.status(201).json({success:true,order:o});
  }catch(e){
    if(e?.code===11000){const existing=await Order.findOne({user:req.user._id,$or:[{purchaseRequestId:String(req.body.requestId||"")},{activePurchaseKey:`${req.user._id}:${req.body.productId}`} ]});if(existing)return res.json({success:true,order:existing,replayed:true})}
    res.status(500).json({message:"Could not create order."});
  }
};

exports.initialize=async(req,res)=>{
  try{
    const o=await Order.findOne({_id:req.params.id,user:req.user._id});
    if(!o)return res.status(404).json({message:"Order not found."});
    if(o.paymentStatus==="paid")return res.status(400).json({message:"This order is already paid."});

    const product=await Product.findById(o.product);
    if(!product||product.status!=="active"||Number(product.stock)<1){
      return res.status(400).json({message:"This product is currently unavailable."});
    }

    const reference="WL"+o._id+Date.now();
    const front=(process.env.FRONTEND_URL||"http://127.0.0.1:5500").replace(/\/$/,"");
    const callback=front+"/orders.html?order="+o._id+"&payment=callback";

    const d=await ps("/transaction/initialize",{
      method:"POST",
      body:JSON.stringify({
        email:req.user.email,
        amount:String(Math.round(o.totalAmount*100)),
        currency:o.currency||"NGN",
        reference,
        callback_url:callback,
        metadata:JSON.stringify({
          orderId:String(o._id),
          userId:String(req.user._id),
          product:o.productName
        })
      })
    });

    o.paymentReference=d.data.reference;
    await o.save();

    res.json({
      success:true,
      authorizationUrl:d.data.authorization_url,
      reference:d.data.reference
    });
  }catch(e){
    const status=e.code==="CONFIG"?503:500;
    res.status(status).json({
      message:(e.code==="CONFIG"||e.code==="PAYSTACK")?e.message:"Could not initialize payment."
    });
  }
};

exports.verify=async(req,res)=>{
  try{
    const o=await Order.findOne({_id:req.params.id,user:req.user._id});
    if(!o)return res.status(404).json({message:"Order not found."});
    if(o.paymentStatus==="paid")return res.json({success:true,order:o});

    const reference=req.body.reference;
    if(!reference||o.paymentReference!==reference){
      return res.status(400).json({message:"Payment reference mismatch."});
    }

    const d=await ps("/transaction/verify/"+encodeURIComponent(reference),{method:"GET"});
    const t=d.data,m=meta(t.metadata);

    if(
      t.status!=="success"||
      String(m.orderId)!==String(o._id)||
      Number(t.amount)!==Math.round(o.totalAmount*100)||
      String(t.currency).toUpperCase()!==String(o.currency||"NGN").toUpperCase()
    ){
      return res.status(400).json({message:"Payment could not be verified."});
    }

    const final=await finalize(o._id,reference);
    res.json({success:true,order:final});
  }catch(e){
    const status=e.code==="CONFIG"?503:500;
    res.status(status).json({
      message:(e.code==="CONFIG"||e.code==="PAYSTACK")?e.message:"Could not verify payment."
    });
  }
};

exports.mine=async(req,res)=>{
  try{
    const orders=await Order.find({user:req.user._id}).select("+deliveryContent +inventoryItem").sort({createdAt:-1}).limit(250);
    const out=[];
    for(const o of orders){
      // Repair an older paid inventory order if it was created as manual delivery.
      // The inventory record is still restricted to this exact customer and order.
      let current=o;
      if(o.paymentStatus==="paid"&&(!o.deliveryContent||o.status!=="completed"))current=await repairPaidInventoryOrder(o._id,req.user._id)||o;
      const row=current.toObject();
      if(current.paymentStatus!=="paid"||current.status!=="completed")delete row.deliveryContent;
      delete row.inventoryItem;
      out.push(row);
    }
    res.json({success:true,orders:out});
  }catch(e){
    res.status(500).json({message:"Could not load orders."});
  }
};

exports.payWithWallet=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid order ID."});
  const session=await mongoose.startSession();
  try{
    let result;
    await session.withTransaction(async()=>{
      const order=await Order.findOne({_id:req.params.id,user:req.user._id}).select("+deliveryContent +inventoryItem").session(session);
      if(!order)throw Object.assign(new Error("Order not found."),{status:404});
      if(order.paymentStatus==="paid"){result=order;return}
      const amountKobo=Math.round(Number(order.totalAmount)*100);
      const product=await Product.findOneAndUpdate({_id:order.product,status:"active",stock:{$gte:order.quantity}},{$inc:{stock:-order.quantity}},{new:true,session}).select("+privateDelivery");
      if(!product)throw Object.assign(new Error("This product is currently unavailable."),{status:409});
      let uniqueDelivery="";
      const item=await InventoryItem.findOneAndUpdate({product:product._id,status:"available"},{$set:{status:"sold",soldTo:req.user._id,order:order._id,soldAt:new Date()}},{new:true,sort:{createdAt:1},session}).select("+encryptedContent");
      if(item){
        uniqueDelivery=inventoryCrypto.decrypt(item.encryptedContent);
        order.inventoryItem=item._id;
      }else if(product.inventoryManaged)throw Object.assign(new Error("This product has no unused delivery records left."),{status:409});
      const user=await User.findOneAndUpdate({_id:req.user._id,walletBalanceKobo:{$gte:amountKobo}},{$inc:{walletBalanceKobo:-amountKobo}},{new:true,session});
      if(!user)throw Object.assign(new Error("Insufficient wallet balance. Add money first."),{status:409});
      const reference="BUY-"+order._id;
      await WalletTransaction.create([{user:user._id,type:"purchase",status:"completed",amountKobo,currency:order.currency||"NGN",reference,provider:"wallet",order:order._id,description:"Purchase: "+order.productName,balanceAfterKobo:user.walletBalanceKobo,verifiedAt:new Date()}],{session});
      order.paymentStatus="paid";order.paymentMethod="wallet";order.paymentReference=reference;order.activePurchaseKey=undefined;
      if(uniqueDelivery||product.deliveryType==="instant"){order.deliveryContent=uniqueDelivery||(product.privateDelivery||"");order.status="completed";order.deliveredAt=new Date()}else{order.status="processing"}
      await order.save({session});result=order;
    });
    await sendPurchaseEmails(result._id).catch(e=>console.error("Purchase email task failed:",e.message));
    await notifications.create({user:result.user,type:"purchase",title:"Purchase completed",message:`Your order for ${result.productName} is ready.`,link:"orders.html",key:`purchase:${result._id}`}).catch(()=>{});
    await referralService.rewardForPurchase({userId:result.user,orderId:result._id,totalAmount:result.totalAmount}).catch(e=>console.error("Referral reward task failed:",e.message));
    res.json({success:true,order:result});
  }catch(error){
    if(error?.code===11000){const order=await Order.findOne({_id:req.params.id,user:req.user._id});return res.json({success:true,order})}
    res.status(error.status||500).json({message:error.status?error.message:"Could not complete wallet purchase."});
  }finally{await session.endSession()}
};

exports.adminAll=async(req,res)=>{
  try{
    const orders=await Order.find().populate("user","firstName lastName email phone").sort({createdAt:-1}).limit(1000);
    res.json({success:true,orders});
  }catch(e){
    res.status(500).json({message:"Could not load orders."});
  }
};

exports.adminStatus=async(req,res)=>{
  try{
    if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid order ID."});
    const o=await Order.findById(req.params.id);
    if(!o)return res.status(404).json({message:"Order not found."});
    const s=req.body.status;
    if(s==="refunded")return res.status(400).json({message:"Use the protected Refund Centre to refund a paid wallet order."});
    if(!["pending","processing","completed","cancelled","refunded"].includes(s)){
      return res.status(400).json({message:"Invalid status."});
    }
    if(s==="completed"&&o.paymentStatus!=="paid"){
      return res.status(400).json({message:"Unpaid order cannot be completed."});
    }
    if(s==="cancelled")o.activePurchaseKey=undefined;
    o.status=s;
    await o.save();
    res.json({success:true,order:o});
  }catch(e){
    res.status(500).json({message:"Could not update order."});
  }
};

exports.adminRefund=async(req,res)=>{
  if(!mongoose.isValidObjectId(req.params.id))return res.status(400).json({message:"Invalid order ID."});
  const reason=String(req.body.reason||"").trim().slice(0,250),adminPassword=String(req.body.adminPassword||"");
  if(reason.length<4)return res.status(400).json({message:"Enter a clear reason for this refund."});
  const attemptKey=String(req.user._id),now=Date.now(),attempt=refundAttempts.get(attemptKey);
  if(attempt&&attempt.until>now&&attempt.count>=5)return res.status(429).json({message:"Too many incorrect password attempts. Refunds are locked for 15 minutes."});
  const admin=await User.findById(req.user._id).select("+password");
  if(!admin||!(await bcrypt.compare(adminPassword,admin.password))){const active=attempt&&attempt.until>now?attempt:{count:0,until:now+15*60*1000};active.count++;refundAttempts.set(attemptKey,active);return res.status(403).json({message:"Your admin password is incorrect. Nothing was refunded."})}
  refundAttempts.delete(attemptKey);
  const session=await mongoose.startSession();let result;
  try{await session.withTransaction(async()=>{
    const order=await Order.findOne({_id:req.params.id,paymentStatus:"paid",paymentMethod:"wallet"}).session(session);
    if(!order)throw Object.assign(new Error("Only a paid wallet order can be refunded here."),{status:409});
    const reference=`RFD-${order._id}`,existing=await WalletTransaction.findOne({reference}).session(session);
    if(existing)throw Object.assign(new Error("This order has already been refunded."),{status:409});
    const amountKobo=Math.round(Number(order.totalAmount)*100),user=await User.findByIdAndUpdate(order.user,{$inc:{walletBalanceKobo:amountKobo}},{new:true,session});
    if(!user)throw Object.assign(new Error("Customer account was not found."),{status:404});
    const [transaction]=await WalletTransaction.create([{user:user._id,type:"adjustment",status:"completed",amountKobo,currency:order.currency||"NGN",reference,provider:"order_refund",order:order._id,description:`Order refund: ${reason}`,balanceAfterKobo:user.walletBalanceKobo,verifiedAt:new Date(),reviewedBy:req.user._id,reviewNote:reason}],{session});
    order.paymentStatus="refunded";order.status="refunded";await order.save({session});result={order,transaction,user};
  });
  await notifications.create({user:result.user._id,type:"wallet",title:"Order refunded",message:`₦${(result.transaction.amountKobo/100).toLocaleString("en-NG")} was returned to your wallet for ${result.order.productName}.`,link:"orders.html",key:`refund:${result.order._id}`}).catch(()=>{});
  res.json({success:true,order:result.order,transaction:result.transaction,balanceKobo:result.user.walletBalanceKobo});
  }catch(error){res.status(error.status||500).json({message:error.status?error.message:"Could not refund this order."})}
  finally{await session.endSession()}
};

exports.webhook=async(req,res)=>{
  try{
    const secret=process.env.PAYSTACK_SECRET_KEY;
    const sig=req.headers["x-paystack-signature"];
    if(!secret||!sig||!Buffer.isBuffer(req.body))return res.sendStatus(400);

    const calc=crypto.createHmac("sha512",secret).update(req.body).digest("hex");
    if(calc.length!==String(sig).length||!crypto.timingSafeEqual(Buffer.from(calc),Buffer.from(String(sig)))){
      return res.sendStatus(401);
    }

    const event=JSON.parse(req.body.toString("utf8"));
    if(event.event!=="charge.success")return res.sendStatus(200);

    const t=event.data,m=meta(t.metadata);
    if(!m.orderId||!mongoose.isValidObjectId(m.orderId))return res.sendStatus(200);

    const o=await Order.findById(m.orderId);
    if(!o||o.paymentStatus==="paid")return res.sendStatus(200);

    if(
      o.paymentReference!==t.reference||
      Number(t.amount)!==Math.round(o.totalAmount*100)||
      String(t.currency).toUpperCase()!==String(o.currency||"NGN").toUpperCase()
    ){
      return res.sendStatus(200);
    }

    await finalize(o._id,t.reference);
    res.sendStatus(200);
  }catch(e){
    res.sendStatus(500);
  }
};

