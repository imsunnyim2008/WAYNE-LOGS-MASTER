const AuditLog=require("../models/AuditLog");
exports.list=async(req,res)=>{try{
  const search=String(req.query.search||"").trim().slice(0,100),entity=String(req.query.entity||"").trim().slice(0,50),limit=Math.min(200,Math.max(20,Number(req.query.limit)||100)),query={};
  if(entity)query.entity=entity;if(search){const safe=search.replace(/[.*+?^${}()|[\]\\]/g,"\\$&");query.$or=[{action:{$regex:safe,$options:"i"}},{target:{$regex:safe,$options:"i"}},{summary:{$regex:safe,$options:"i"}}]}
  const logs=await AuditLog.find(query).populate("admin","firstName lastName email").sort({createdAt:-1}).limit(limit);
  res.json({success:true,logs});
}catch(e){res.status(500).json({message:"Could not load the audit log."})}};
