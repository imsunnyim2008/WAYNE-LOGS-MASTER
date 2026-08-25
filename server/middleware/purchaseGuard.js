const windows=new Map();
module.exports=(req,res,next)=>{
  const key=String(req.user?._id||req.ip),now=Date.now(),windowMs=60*1000,limit=12;
  let record=windows.get(key);
  if(!record||record.until<=now)record={count:0,until:now+windowMs};
  record.count++;windows.set(key,record);
  res.setHeader("X-Purchase-Limit",String(limit));
  res.setHeader("X-Purchase-Remaining",String(Math.max(0,limit-record.count)));
  if(record.count>limit)return res.status(429).json({message:"Too many purchase attempts. Please wait one minute before trying again."});
  if(windows.size>5000)for(const[id,value]of windows)if(value.until<=now)windows.delete(id);
  next();
};
