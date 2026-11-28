const r=require("express").Router(),c=require("../controllers/settingController"),{protect,adminOnly}=require("../middleware/authMiddleware");
r.get("/public",c.publicGet);
r.get("/admin",protect,adminOnly,c.adminGet);
r.put("/admin",protect,adminOnly,c.adminUpdate);
r.get("/banners",c.publicBanners);
r.get("/admin/banners",protect,adminOnly,c.adminBanners);
r.put("/admin/banners",protect,adminOnly,c.saveBanners);
module.exports=r;
