const Notification=require("../models/Notification");
exports.create=async({user,type,title,message,link,key})=>{if(!user)return;const data={user,type,title:String(title).slice(0,120),message:String(message).slice(0,500),link:link||"notifications.html"};if(key){data.key=key;return Notification.updateOne({user,key},{$setOnInsert:data},{upsert:true})}return Notification.create(data)};
