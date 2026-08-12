const express=require("express");
const cors=require("cors");
const dotenv=require("dotenv");
const morgan=require("morgan");
const mongoose=require("mongoose");
dotenv.config();
const app=express();
const authRoutes=require("./routes/authRoutes");
const productRoutes=require("./routes/productRoutes");
const orderRoutes=require("./routes/orderRoutes");
const{webhook}=require("./controllers/orderController");
app.use(cors({origin:true,credentials:false}));
app.use(morgan("dev"));
app.post("/api/paystack/webhook",express.raw({type:"application/json",limit:"1mb"}),webhook);
app.use(express.json({limit:"2mb"}));
app.use(express.urlencoded({extended:true,limit:"2mb"}));
app.use("/api/auth",authRoutes);
app.use("/api/products",productRoutes);
app.use("/api/orders",orderRoutes);
app.get("/",(req,res)=>res.json({success:true,message:"WAYNE LOGS MASTER API"}));
app.get("/api/test",(req,res)=>res.json({success:true,message:"Backend online"}));
app.use("/api",(req,res)=>res.status(404).json({message:"API route not found."}));
const PORT=process.env.PORT||5000;
mongoose.connect(process.env.MONGO_URI)
  .then(()=>{console.log("MongoDB connected");app.listen(PORT,()=>console.log("WAYNE LOGS API running on "+PORT));})
  .catch(e=>{console.error("MongoDB connection failed:",e.message);process.exit(1);});
