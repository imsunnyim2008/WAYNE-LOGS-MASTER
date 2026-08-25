const r=require("express").Router(),c=require("../controllers/securityController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/admin/overview",protect,adminOnly,c.overview);
module.exports=r;
