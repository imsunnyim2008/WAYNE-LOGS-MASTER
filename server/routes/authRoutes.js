const r=require("express").Router();
const c=require("../controllers/authController");
const{protect,adminOnly}=require("../middleware/authMiddleware");
r.post("/register",c.register);
r.post("/login",c.login);
r.get("/me",protect,(req,res)=>res.json({success:true,user:req.user}));
r.get("/admin",protect,adminOnly,(req,res)=>res.json({success:true,user:req.user}));
r.get("/admin/users",protect,adminOnly,c.adminUsers);
module.exports=r;
