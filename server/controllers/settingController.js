const SiteSetting=require("../models/SiteSetting");
const defaults={announcementEnabled:false,announcementTitle:"Welcome to WAYNE LOGS",announcementMessage:"",telegramUrl:""};
async function get(){return await SiteSetting.findOne({key:"main"})||defaults}
exports.publicGet=async(req,res)=>{try{const s=await get();res.json({success:true,settings:{announcementEnabled:!!s.announcementEnabled,announcementTitle:s.announcementTitle||"",announcementMessage:s.announcementMessage||"",telegramUrl:s.telegramUrl||"",version:s.updatedAt?new Date(s.updatedAt).getTime():0}})}catch(e){res.status(500).json({message:"Could not load site settings."})}};
exports.adminGet=async(req,res)=>{try{res.json({success:true,settings:await get()})}catch(e){res.status(500).json({message:"Could not load site settings."})}};
exports.adminUpdate=async(req,res)=>{try{
  const title=String(req.body.announcementTitle||"").trim().slice(0,100),message=String(req.body.announcementMessage||"").trim().slice(0,600),telegramUrl=String(req.body.telegramUrl||"").trim().replace(/\/$/,"");
  if(telegramUrl&&!/^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}$/.test(telegramUrl))return res.status(400).json({message:"Use a Telegram link like https://t.me/yourusername"});
  const settings=await SiteSetting.findOneAndUpdate({key:"main"},{$set:{announcementEnabled:req.body.announcementEnabled===true,announcementTitle:title||"Welcome to WAYNE LOGS",announcementMessage:message,telegramUrl}},{new:true,upsert:true,setDefaultsOnInsert:true,runValidators:true});
  res.json({success:true,settings});
}catch(e){res.status(500).json({message:"Could not save site settings."})}};
