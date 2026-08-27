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
const permissionFor=req=>{const p=req.originalUrl.toLowerCase();if(p.includes("/products"))return"products";if(p.includes("/orders"))return"orders";if(p.includes("/wallet"))return"payments";if(p.includes("/support")||p.includes("/notifications"))return"communications";if(p.includes("/settings")||p.includes("/admin-config/store"))return"settings";if(p.includes("/audit")||p.includes("/security"))return"security";return"customers"};
exports.adminOnly=(req,res,next)=>{if(req.user?.role==="admin")return next();if(req.user?.role==="staff"&&req.originalUrl.split("?")[0]==="/api/auth/admin")return next();if(req.user?.role==="staff"&&(req.user.staffPermissions||[]).includes(permissionFor(req)))return next();return res.status(403).json({success:false,message:"You do not have permission for this admin area."})};
