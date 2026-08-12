const jwt = require("jsonwebtoken");
const User = require("../models/User");
exports.protect = async (req,res,next) => {
  try{
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer ")) return res.status(401).json({success:false,message:"Please login."});
    const decoded=jwt.verify(h.split(" ")[1],process.env.JWT_SECRET);
    const user=await User.findById(decoded.id).select("-password");
    if(!user||!user.isActive) return res.status(401).json({success:false,message:"Account unavailable."});
    req.user=user; next();
  }catch(e){ return res.status(401).json({success:false,message:"Invalid or expired login token."}); }
};
exports.adminOnly = (req,res,next) => req.user?.role==="admin" ? next() : res.status(403).json({success:false,message:"Admin access only."});
