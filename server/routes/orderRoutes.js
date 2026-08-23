const r=require("express").Router();
const c=require("../controllers/orderController");
const{protect,adminOnly}=require("../middleware/authMiddleware");
r.post("/",protect,c.create);
r.get("/my",protect,c.mine);
r.get("/admin/all",protect,adminOnly,c.adminAll);
r.patch("/admin/:id/status",protect,adminOnly,c.adminStatus);
r.post("/:id/wallet/pay",protect,c.payWithWallet);
module.exports=r;
