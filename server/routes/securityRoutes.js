const r=require("express").Router(),c=require("../controllers/securityController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/admin/overview",protect,adminOnly,c.overview);
const shield=require("../controllers/shieldController");
r.get("/admin/2fa/status",protect,adminOnly,shield.status);
r.get("/admin/vault",protect,adminOnly,c.vault);
r.post("/admin/2fa/setup",protect,adminOnly,shield.setup);
r.post("/admin/2fa/enable",protect,adminOnly,shield.enable);
r.post("/admin/2fa/disable",protect,adminOnly,shield.disable);
module.exports=r;
