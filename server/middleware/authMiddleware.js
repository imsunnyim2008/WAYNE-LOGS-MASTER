const jwt = require("jsonwebtoken");
const User = require("../models/User");
exports.protect = async (req,res,next) => {
  try{
    const h=req.headers.authorization||"";
    if(!h.startsWith("Bearer ")) return res.status(401).json({success:false,message:"Please login."});
    const decoded=jwt.verify(h.split(" ")[1],process.env.JWT_SECRET);
    const user=await User.findById(decoded.id).select("-password");
    if(!user||!user.isActive) return res.status(401).json({success:false,message:"Account unavailable."});
    if(Number(decoded.sv||0)!==Number(user.sessionVersion||0))return res.status(401).json({success:false,message:"Your session has ended. Please login again."});
    if(user.role==="user"&&user.mustChangePassword&&!req.originalUrl.startsWith("/api/auth/change-password"))return res.status(403).json({success:false,code:"PASSWORD_CHANGE_REQUIRED",message:"Create a new private password before continuing."});
    req.user=user; next();
  }catch(e){ return res.status(401).json({success:false,message:"Invalid or expired login token."}); }
};
exports.adminOnly = (req,res,next) => req.user?.role==="admin" ? next() : res.status(403).json({success:false,message:"Admin access only."});
