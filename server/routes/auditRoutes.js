const r=require("express").Router(),c=require("../controllers/auditController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/",protect,adminOnly,c.list);
module.exports=r;
