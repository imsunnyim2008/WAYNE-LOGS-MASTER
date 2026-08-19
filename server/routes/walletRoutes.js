const r=require("express").Router(),c=require("../controllers/walletController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/",protect,c.summary);r.get("/transactions",protect,c.history);r.post("/topups/initialize",protect,c.initialize);r.post("/topups/verify",protect,c.verify);r.get("/admin/transactions",protect,adminOnly,c.adminAll);module.exports=r;
