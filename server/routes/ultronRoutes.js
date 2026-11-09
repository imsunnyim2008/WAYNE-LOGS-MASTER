"use strict";
const router=require("express").Router();
const Product=require("../models/Product");
const {answer}=require("../services/ultronStoreService");
router.post("/ask",async(req,res)=>{
 res.set("Cache-Control","no-store");
 const raw=req.body?.message;
 if(typeof raw!=="string"||raw.trim().length<2||raw.length>280)return res.status(400).json({message:"Enter a question between 2 and 280 characters."});
 try{
  const message=raw.trim().replace(/\s+/g," ");
  const query=answer(message);
  if(query.category==="products"){
    const products=await Product.find({status:"active"}).select("name platform stock price currency deliveryType").sort({createdAt:-1}).limit(60).lean();
    const tokens=message.toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(x=>x.length>=3&&!["what","have","your","show","find","price","sell","buy","product","products","available","stock"].includes(x));
    const relevant=tokens.length?products.filter(x=>tokens.some(t=>String(x.name+" "+x.platform).toLowerCase().includes(t))):products;
    if(!relevant.length)return res.json({success:true,mode:"store-help",answer:"I couldn't find a matching active product. Browse the marketplace for the latest listings, or contact support for help.",link:{label:"Browse products",href:"index.html#shop"}});
    const rows=relevant.slice(0,5).map(x=>x.name+" — ₦"+Number(x.price||0).toLocaleString("en-NG")+" ("+(Number(x.stock)>0?"available":"out of stock")+")");
    return res.json({success:true,mode:"store-help",answer:"Here are current public listings:\n"+rows.join("\n"),link:{label:"Explore marketplace",href:"index.html#shop"}});
  }
  return res.json({success:true,mode:"store-help",answer:query.text,link:query.link||null});
 }catch(e){
  console.error("ULTRON store-help request failed:",e?.name||"unknown");
  return res.status(503).json({message:"Store help is temporarily unavailable. Please try again or open Support."});
 }
});
module.exports=router;
