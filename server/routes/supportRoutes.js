const r=require("express").Router();
const c=require("../controllers/supportController");
const{protect,adminOnly}=require("../middleware/authMiddleware");
r.post("/",protect,c.create);r.get("/my",protect,c.mine);r.post("/:id/replies",protect,c.customerReply);
r.get("/admin/all",protect,adminOnly,c.adminAll);r.post("/admin/:id/replies",protect,adminOnly,c.adminReply);r.patch("/admin/:id/status",protect,adminOnly,c.adminStatus);
module.exports=r;
