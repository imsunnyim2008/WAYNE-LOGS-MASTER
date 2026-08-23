const r=require("express").Router(),c=require("../controllers/notificationController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/my",protect,c.mine);r.patch("/read-all",protect,c.readAll);r.patch("/:id/read",protect,c.readOne);r.post("/admin/broadcast",protect,adminOnly,c.broadcast);module.exports=r;
