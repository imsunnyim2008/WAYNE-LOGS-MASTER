const r=require("express").Router(),c=require("../controllers/referralController"),{protect}=require("../middleware/authMiddleware");
r.get("/me",protect,c.mine);
module.exports=r;
