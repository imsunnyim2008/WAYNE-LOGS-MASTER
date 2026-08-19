const bcrypt=require("bcryptjs");
const jwt=require("jsonwebtoken");
const User=require("../models/User");
const token=u=>jwt.sign({id:u._id,role:u.role},process.env.JWT_SECRET,{expiresIn:"7d"});
const safe=u=>({id:u._id,firstName:u.firstName,lastName:u.lastName,email:u.email,phone:u.phone,role:u.role,isActive:u.isActive,walletBalanceKobo:u.walletBalanceKobo||0});
exports.register=async(req,res)=>{
  try{
    const{firstName,lastName,email,phone,password}=req.body;
    if(!firstName||!lastName||!email||!phone||!password) return res.status(400).json({message:"All fields are required."});
    if(await User.findOne({email:email.toLowerCase()})) return res.status(409).json({message:"Email already registered."});
    const hash=await bcrypt.hash(password,12);
    const role=process.env.ADMIN_EMAIL&&email.toLowerCase()===process.env.ADMIN_EMAIL.toLowerCase()?"admin":"user";
    const u=await User.create({firstName,lastName,email,phone,password:hash,role});
    res.status(201).json({success:true,token:token(u),user:safe(u)});
  }catch(e){res.status(500).json({message:"Could not register."});}
};
exports.login=async(req,res)=>{
  try{
    const{email,password}=req.body;
    const u=await User.findOne({email:(email||"").toLowerCase()});
    if(!u||!(await bcrypt.compare(password||"",u.password))) return res.status(401).json({message:"Invalid email or password."});
    if(!u.isActive) return res.status(403).json({message:"Account disabled."});
    res.json({success:true,token:token(u),user:safe(u)});
  }catch(e){res.status(500).json({message:"Could not login."});}
};
exports.adminUsers=async(req,res)=>{
  try{const users=await User.find().select("-password").sort({createdAt:-1});res.json({success:true,users});}
  catch(e){res.status(500).json({message:"Could not load users."});}
};
