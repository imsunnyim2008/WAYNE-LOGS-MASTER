const express=require("express");
const cors=require("cors");
const dotenv=require("dotenv");
const morgan=require("morgan");
const mongoose=require("mongoose");
const crypto=require("crypto");
dotenv.config();
const requiredConfig=["MONGO_URI","JWT_SECRET"];
const missingConfig=requiredConfig.filter(key=>!String(process.env[key]||"").trim());
if(missingConfig.length)throw new Error(`Missing required environment variable${missingConfig.length===1?"":"s"}: ${missingConfig.join(", ")}`);
if(String(process.env.JWT_SECRET).length<32)console.warn("WARNING: JWT_SECRET should contain at least 32 random characters.");
if(!process.env.INVENTORY_ENCRYPTION_KEY)console.warn("WARNING: INVENTORY_ENCRYPTION_KEY is not set; inventory encryption currently depends on JWT_SECRET remaining unchanged.");
const app=express();
const authRoutes=require("./routes/authRoutes");
const ultronRoutes=require("./routes/ultronRoutes");
const ultronAiRoutes=require("./routes/ultronAiRoutes");
const productRoutes=require("./routes/productRoutes");
const orderRoutes=require("./routes/orderRoutes");
const walletRoutes=require("./routes/walletRoutes");
const paymentLink=require("./controllers/paymentLinkController");
const settingRoutes=require("./routes/settingRoutes");
const supportRoutes=require("./routes/supportRoutes");
const notificationRoutes=require("./routes/notificationRoutes");
const referralRoutes=require("./routes/referralRoutes");
const auditRoutes=require("./routes/auditRoutes");
const securityRoutes=require("./routes/securityRoutes");
const adminConfigRoutes=require("./routes/adminConfigRoutes");
const auditMiddleware=require("./middleware/auditMiddleware");
const emailService=require("./services/emailService");
const maintenance=require("./services/maintenanceService");
const{webhook:walletWebhook}=require("./controllers/walletController");
const{webhook:virtualAccountWebhook}=require("./controllers/virtualAccountController");
app.disable("x-powered-by");
app.set("trust proxy",1);
const runtime={startedAt:new Date(),requests:0};
app.use((req,res,next)=>{runtime.requests+=1;const requestId=String(req.headers["x-request-id"]||crypto.randomUUID()).slice(0,100);req.requestId=requestId;res.setHeader("X-Request-ID",requestId);res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("X-Frame-Options","DENY");res.setHeader("Referrer-Policy","no-referrer");res.setHeader("Permissions-Policy","camera=(), microphone=(), geolocation=(), payment=()");res.setHeader("X-Permitted-Cross-Domain-Policies","none");res.setHeader("Cross-Origin-Resource-Policy","same-site");if(process.env.NODE_ENV==="production")res.setHeader("Strict-Transport-Security","max-age=31536000; includeSubDomains");if(req.path.startsWith("/api/")){res.setHeader("Cache-Control","no-store");res.setHeader("Content-Security-Policy","default-src 'none'; base-uri 'none'; frame-ancestors 'none'");}next()});
const allowedOrigins=new Set([process.env.FRONTEND_URL,"https://waynelogs.com","https://www.waynelogs.com","http://localhost:5500","http://127.0.0.1:5500"].concat(String(process.env.ALLOWED_ORIGINS||"").split(",")).map(v=>String(v||"").trim().replace(/\/$/,"")).filter(Boolean));
app.use(cors({origin(origin,callback){if(!origin||allowedOrigins.has(String(origin).replace(/\/$/,"")))return callback(null,true);return callback(new Error("Origin not allowed"))},credentials:false,methods:["GET","POST","PUT","PATCH","DELETE","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]}));
app.use(morgan("dev"));
app.use("/api",(req,res,next)=>{
  if(req.path==="/health"||req.path==="/test")return next();
  if(mongoose.connection.readyState!==1){
    res.setHeader("Retry-After","15");
    return res.status(503).json({message:"The store is temporarily unavailable while its database reconnects. Please try again shortly.",requestId:req.requestId});
  }
  next();
});
app.post("/api/wallet/webhooks/paystack-dva",express.raw({type:"application/json",limit:"1mb"}),virtualAccountWebhook);
app.post("/api/wallet/webhooks/:provider",express.raw({type:"application/json",limit:"1mb"}),walletWebhook);
app.use(express.json({limit:"6mb"}));
app.use(express.urlencoded({extended:true,limit:"2mb"}));
app.use(auditMiddleware);
function createRateLimiter({windowMs,max,message}){
  const attempts=new Map(),cleanup=setInterval(()=>{const now=Date.now();for(const[key,value]of attempts)if(value.resetAt<=now)attempts.delete(key)},Math.min(windowMs,300000));cleanup.unref?.();
  return(req,res,next)=>{const now=Date.now(),key=String(req.ip||req.socket?.remoteAddress||"unknown"),current=attempts.get(key);if(attempts.size>10000)for(const[id,value]of attempts)if(value.resetAt<=now)attempts.delete(id);if(!current||current.resetAt<=now){attempts.set(key,{count:1,resetAt:now+windowMs});res.setHeader("RateLimit-Limit",String(max));res.setHeader("RateLimit-Remaining",String(max-1));return next()}if(current.count>=max){res.setHeader("Retry-After",Math.max(1,Math.ceil((current.resetAt-now)/1000)));res.setHeader("RateLimit-Remaining","0");return res.status(429).json({message})}current.count+=1;res.setHeader("RateLimit-Limit",String(max));res.setHeader("RateLimit-Remaining",String(Math.max(0,max-current.count)));next()};
}
app.use("/api/auth/login",createRateLimiter({windowMs:15*60*1000,max:20,message:"Too many login attempts. Please wait a few minutes and try again."}));
app.use("/api/auth/2fa/login",createRateLimiter({windowMs:15*60*1000,max:10,message:"Too many verification attempts. Try again in 15 minutes."}));
app.use("/api/security/admin/2fa",createRateLimiter({windowMs:15*60*1000,max:12,message:"Too many security setup requests. Try again later."}));
app.use("/api/auth/forgot-password",createRateLimiter({windowMs:15*60*1000,max:5,message:"Too many recovery requests. Please try again in 15 minutes."}));
app.use("/api/auth/reset-password",createRateLimiter({windowMs:15*60*1000,max:10,message:"Too many reset attempts. Please try again in 15 minutes."}));
app.use("/api/auth/verify-email",createRateLimiter({windowMs:15*60*1000,max:12,message:"Too many email verification attempts. Try again later."}));
app.use("/api/auth/resend-verification",createRateLimiter({windowMs:15*60*1000,max:5,message:"Too many verification email requests. Try again later."}));
app.use("/api/auth/register",createRateLimiter({windowMs:60*60*1000,max:10,message:"Too many account-creation attempts. Please try again later."}));
app.use("/api/wallet/transfers",createRateLimiter({windowMs:10*60*1000,max:20,message:"Too many wallet-transfer attempts. Please wait and try again."}));
app.use("/api/wallet/topups",createRateLimiter({windowMs:10*60*1000,max:30,message:"Too many top-up attempts. Please wait and try again."}));
app.get("/api/payment-link/bank",createRateLimiter({windowMs:60*1000,max:60,message:"Too many payment-link requests. Please try again shortly."}),paymentLink.instructions);
app.use("/api/wallet/virtual-account",createRateLimiter({windowMs:60*60*1000,max:12,message:"Too many bank account requests. Please try later."}));
app.use("/api/orders",createRateLimiter({windowMs:60*1000,max:90,message:"Too many order requests. Please wait one minute and try again."}));
app.use("/api/auth/password",createRateLimiter({windowMs:15*60*1000,max:12,message:"Too many password changes attempted. Try again later."}));
app.use("/api/auth/change-password",createRateLimiter({windowMs:15*60*1000,max:12,message:"Too many password changes attempted. Try again later."}));
app.use("/api/auth/admin/password-assistance/reset",createRateLimiter({windowMs:15*60*1000,max:10,message:"Too many password reset attempts. Try again later."}));
app.use("/api/wallet/admin/transfer-pin",createRateLimiter({windowMs:15*60*1000,max:15,message:"Too many transfer PIN operations. Try again later."}));
app.use("/api/wallet/admin/credit",createRateLimiter({windowMs:15*60*1000,max:20,message:"Too many wallet credit attempts. Try again later."}));
app.use("/api/wallet/admin/clear",createRateLimiter({windowMs:15*60*1000,max:10,message:"Too many wallet balance operations. Try again later."}));
app.use("/api/ultron/ask",createRateLimiter({windowMs:15*60*1000,max:24,message:"Too many store-help messages. Please try again later."}));
app.use("/api/ultron/ai/chat",createRateLimiter({windowMs:15*60*1000,max:18,message:"Too many AI chat messages. Try again later."}));
app.use("/api/ultron/ai/customer-help",createRateLimiter({windowMs:15*60*1000,max:60,message:"Too many account-help lookups. Please try later."}));
app.use("/api/ultron/ai",ultronAiRoutes);
app.use("/api/ultron",ultronRoutes);
app.use("/api/auth",authRoutes);
app.use("/api/products",productRoutes);
app.use("/api/orders",orderRoutes);
app.use("/api/wallet",walletRoutes);
app.use("/api/settings",settingRoutes);
app.use("/api/support",supportRoutes);
app.use("/api/notifications",notificationRoutes);
app.use("/api/referrals",referralRoutes);
app.use("/api/audit",auditRoutes);
app.use("/api/security",securityRoutes);
app.use("/api/admin-config",adminConfigRoutes);
app.get("/",(req,res)=>res.json({success:true,message:"WAYNE LOGS MASTER API"}));
app.get("/api/test",(req,res)=>res.json({success:true,message:"Backend online"}));
app.get("/health/live",(req,res)=>res.json({status:"ok",service:"wayne-logs-api",uptimeSeconds:Math.floor(process.uptime()),timestamp:new Date().toISOString()}));
app.get("/health/ready",async(req,res)=>{const connected=mongoose.connection.readyState===1;let database=connected;try{if(connected)await mongoose.connection.db.admin().ping();else database=false}catch{database=false}res.status(database?200:503).json({status:database?"ready":"not_ready",database:database?"connected":"unavailable",uptimeSeconds:Math.floor(process.uptime()),timestamp:new Date().toISOString()})});
app.get("/api/health",(req,res)=>res.status(mongoose.connection.readyState===1?200:503).json({success:mongoose.connection.readyState===1,status:mongoose.connection.readyState===1?"ready":"not_ready",startedAt:runtime.startedAt,requests:runtime.requests,version:process.env.RENDER_GIT_COMMIT||process.env.APP_VERSION||"unknown"}));
app.use("/api",(req,res)=>res.status(404).json({message:"API route not found."}));
app.use((error,req,res,next)=>{if(res.headersSent)return next(error);const invalidJson=error instanceof SyntaxError&&error.status===400&&"body" in error,blocked=error?.message==="Origin not allowed",status=invalidJson?400:blocked?403:Number(error?.status||error?.statusCode)||500;if(status>=500)console.error(`[${req.requestId||"no-request-id"}] Request failed:`,error?.message||error);res.status(status).json({message:invalidJson?"The request contains invalid JSON.":blocked?"This website origin is not allowed.":status>=500?"The server could not complete this request.":error.message||"Request failed.",requestId:req.requestId})});
const PORT=process.env.PORT||5000;
let httpServer,maintenanceTimer,retryTimer,shuttingDown=false,connecting=false;
let retryDelayMs=5000;
mongoose.connection.on("disconnected",()=>console.error("MongoDB disconnected"));
mongoose.connection.on("reconnected",()=>console.log("MongoDB reconnected"));
function startMaintenance(){
  if(maintenanceTimer)return;
  maintenance.reconcileInventoryStock().catch(error=>{maintenance.recordError(error);console.error("Initial stock reconciliation failed:",error.message)});
  maintenanceTimer=setInterval(()=>maintenance.reconcileInventoryStock().catch(error=>{maintenance.recordError(error);console.error("Scheduled stock reconciliation failed:",error.message)}),5*60*1000);
  maintenanceTimer.unref?.();
}
async function connectDatabase(){
  if(shuttingDown||connecting||mongoose.connection.readyState===1)return;
  connecting=true;
  try{
    await mongoose.connect(process.env.MONGO_URI,{serverSelectionTimeoutMS:15000,connectTimeoutMS:15000,maxPoolSize:Number(process.env.MONGO_POOL_SIZE||20),minPoolSize:1});
    console.log("MongoDB connected");
    retryDelayMs=5000;
    startMaintenance();
  }catch(error){
    console.error("MongoDB connection failed:",error.message);
    if(!shuttingDown){
      const delay=retryDelayMs;
      retryDelayMs=Math.min(60000,retryDelayMs*2);
      console.warn("Database unavailable; retrying connection in "+(delay/1000)+" seconds.");
      retryTimer=setTimeout(connectDatabase,delay);
      retryTimer.unref?.();
    }
  }finally{connecting=false;}
}
httpServer=app.listen(PORT,"0.0.0.0",()=>console.log("WAYNE LOGS API listening on "+PORT));
console.log("Email password recovery:",emailService.isConfigured()?"mail transport configured":"SMTP not configured");
httpServer.requestTimeout=Number(process.env.REQUEST_TIMEOUT_MS||30000);
httpServer.headersTimeout=Math.max(httpServer.requestTimeout+5000,35000);
httpServer.keepAliveTimeout=5000;
connectDatabase();
async function shutdown(signal){
  if(shuttingDown)return;
  shuttingDown=true;
  console.log(signal+" received; shutting down safely.");
  if(retryTimer)clearTimeout(retryTimer);
  if(maintenanceTimer)clearInterval(maintenanceTimer);
  const force=setTimeout(()=>process.exit(1),10000);
  force.unref?.();
  if(httpServer)await new Promise(resolve=>httpServer.close(resolve));
  await mongoose.connection.close(false).catch(()=>{});
  clearTimeout(force);
  process.exit(0);
}
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
