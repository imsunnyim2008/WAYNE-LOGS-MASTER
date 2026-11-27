"use strict";
const express=require("express"),mongoose=require("mongoose"),bcrypt=require("bcryptjs"),jwt=require("jsonwebtoken");
const {protect}=require("../middleware/authMiddleware");
const User=require("../models/User"),notifications=require("../services/notificationService");
const r=express.Router();
const employeeSchema=new mongoose.Schema({
 email:{type:String,required:true,unique:true},passwordHash:{type:String,required:true,select:false},
 status:{type:String,enum:["pending","approved","suspended"],default:"pending"},version:{type:Number,default:0},
 reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},reviewedAt:Date
},{timestamps:true,strict:"throw"});
const assetSchema=new mongoose.Schema({
 employee:{type:mongoose.Schema.Types.ObjectId,ref:"PortalEmployee",required:true,index:true},
 assetId:{type:String,required:true},contactEmail:{type:String,required:true},
 status:{type:String,enum:["pending","approved","rejected"],default:"pending"},
 reviewedBy:{type:mongoose.Schema.Types.ObjectId,ref:"User"},reviewedAt:Date
},{timestamps:true,strict:"throw"});
assetSchema.index({employee:1,assetId:1},{unique:true});
const Employee=mongoose.model("PortalEmployee",employeeSchema),Asset=mongoose.model("PortalAsset",assetSchema);
const email=v=>typeof v==="string"&&v.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())?v.trim().toLowerCase():null;
const exact=(b,keys)=>b&&typeof b==="object"&&!Array.isArray(b)&&Object.keys(b).length===keys.length&&keys.every(k=>Object.hasOwn(b,k));
const passwordOk=p=>typeof p==="string"&&p.length>=12&&Buffer.byteLength(p)<=72;
const validAsset=b=>exact(b,["contactEmail","assetId","authorized"])&&email(b.contactEmail)&&typeof b.assetId==="string"&&/^\d{5,30}$/.test(b.assetId)&&b.authorized===true;
const safe=e=>({_id:e._id,email:e.email,status:e.status,createdAt:e.createdAt});
const wrap=fn=>(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);
const admin=(req,res,next)=>req.user?.role==="admin"?next():res.status(403).json({message:"Administrator access required."});
const key=()=>require("node:crypto").createHmac("sha256",process.env.JWT_SECRET).update("employee-portal-v1").digest();
const token=e=>jwt.sign({purpose:"employee_portal",sv:e.version},key(),{subject:String(e._id),audience:"wayne-employee",algorithm:"HS256",expiresIn:"2h"});
const employeeOnly=wrap(async(req,res,next)=>{
 let p;try{p=jwt.verify(String(req.headers.authorization||"").replace(/^Bearer /,""),key(),{algorithms:["HS256"],audience:"wayne-employee"});}catch{return res.status(401).json({message:"Please sign in again."})}
 if(p.purpose!=="employee_portal"||!mongoose.isValidObjectId(p.sub))return res.status(401).json({message:"Invalid employee session."});
 const e=await Employee.findById(p.sub);
 if(!e||e.status!=="approved"||e.version!==p.sv)return res.status(403).json({message:"Employee access is not active."});
 req.employee=e;next();
});
async function notify(title,message,id){try{const admins=await User.find({role:"admin",isActive:true}).select("_id").lean();await Promise.all(admins.map(a=>notifications.create({user:a._id,type:"announcement",title,message,link:"employee-admin.html",key:id})));}catch{/* Review list remains authoritative. */}}
r.post("/register",wrap(async(req,res)=>{
 const b=req.body;if(!exact(b,["email","password"])||!email(b.email)||!passwordOk(b.password))return res.status(400).json({message:"Enter a valid work email and a new employee password of at least 12 characters."});
 try{const e=await Employee.create({email:email(b.email),passwordHash:await bcrypt.hash(b.password,12)});await notify("Employee registration","A new employee is awaiting review.","employee-registration:"+e._id);}catch(err){if(err.code!==11000)throw err}
 res.status(202).json({message:"Registration received. An administrator must approve access."});
}));
r.post("/login",wrap(async(req,res)=>{
 const b=req.body;if(!exact(b,["email","password"])||!email(b.email)||!passwordOk(b.password))return res.status(401).json({message:"Invalid employee credentials."});
 const e=await Employee.findOne({email:email(b.email)}).select("+passwordHash");
 if(!e||!await bcrypt.compare(b.password,e.passwordHash))return res.status(401).json({message:"Invalid employee credentials."});
 if(e.status!=="approved")return res.status(403).json({message:"Employee access is not approved or is suspended."});
 res.json({token:token(e),employee:safe(e)});
}));
r.get("/me",employeeOnly,(req,res)=>res.json({employee:safe(req.employee)}));
r.get("/submissions",employeeOnly,wrap(async(req,res)=>res.json({submissions:await Asset.find({employee:req.employee._id}).select("assetId contactEmail status createdAt").sort({createdAt:-1}).limit(100).lean()})));
r.post("/submissions",employeeOnly,wrap(async(req,res)=>{
 if(!validAsset(req.body))return res.status(400).json({message:"Submit only an authorized company Meta business asset ID and its business contact email. Never submit passwords or access tokens."});
 try{const a=await Asset.create({employee:req.employee._id,assetId:req.body.assetId,contactEmail:email(req.body.contactEmail)});await notify("Business asset submission","An employee submitted an authorized business asset for review.","employee-asset:"+a._id);res.status(201).json({submission:{_id:a._id,status:a.status}});}catch(err){if(err.code===11000)return res.status(409).json({message:"You already submitted this asset."});throw err}
}));
r.get("/admin/employees",protect,admin,wrap(async(req,res)=>res.json({employees:await Employee.find().select("email status createdAt reviewedAt").sort({createdAt:-1}).limit(250).lean()})));
r.patch("/admin/employees/:id",protect,admin,wrap(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!exact(req.body,["status"])||!["approved","suspended"].includes(req.body.status))return res.status(400).json({message:"Invalid status."});
 const e=await Employee.findByIdAndUpdate(req.params.id,{$set:{status:req.body.status,reviewedBy:req.user._id,reviewedAt:new Date()},$inc:{version:1}},{new:true});
 if(!e)return res.status(404).json({message:"Employee not found."});res.json({employee:safe(e)});
}));
r.get("/admin/submissions",protect,admin,wrap(async(req,res)=>res.json({submissions:await Asset.find().populate("employee","email status").sort({createdAt:-1}).limit(250).lean()})));
r.patch("/admin/submissions/:id",protect,admin,wrap(async(req,res)=>{
 if(!mongoose.isValidObjectId(req.params.id)||!exact(req.body,["status"])||!["approved","rejected"].includes(req.body.status))return res.status(400).json({message:"Invalid review."});
 const a=await Asset.findOneAndUpdate({_id:req.params.id,status:"pending"},{$set:{status:req.body.status,reviewedBy:req.user._id,reviewedAt:new Date()}},{new:true});
 if(!a)return res.status(409).json({message:"Submission already reviewed or unavailable."});res.json({submission:a});
}));
module.exports=r;
module.exports._test={validAsset,passwordOk,exact,key,token};
