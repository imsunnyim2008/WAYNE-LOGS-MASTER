
"use strict";
const fs=require("fs"),path=require("path"),crypto=require("crypto");
const {Readable,Transform}=require("stream");
const {pipeline}=require("stream/promises");
const {createGzip}=require("zlib");
const mongoose=require("mongoose"),{EJSON}=require("mongodb");
const collections=["users","products","inventoryitems","orders","wallettransactions","notifications","referrals","supporttickets","sitesettings","auditlogs"];
async function main(){
 const uri=process.env.VAULT_MONGO_URI||process.env.MONGO_URI;
 const hex=process.env.VAULT_BACKUP_KEY||"";
 if(!uri||!(/^[a-f0-9]{64}$/i.test(hex)))throw Error("VAULT_MONGO_URI and 64-character VAULT_BACKUP_KEY must be configured.");
 const file=path.resolve(process.env.VAULT_BACKUP_PATH||path.join("backups","wayne-logs-"+new Date().toISOString().replace(/[:.]/g,"-")+".vault"));
 const nonce=crypto.randomBytes(12),key=Buffer.from(hex,"hex");
 const cipher=crypto.createCipheriv("aes-256-gcm",key,nonce);
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 await mongoose.connect(uri,{serverSelectionTimeoutMS:15000,maxPoolSize:3});
 let count=0;
 async function* records(){
  yield JSON.stringify({type:"wayne-vault",version:1,createdAt:new Date().toISOString(),format:"bson-ejson"})+String.fromCharCode(10);
  for(const name of collections){
   let n=0;
   for await(const doc of mongoose.connection.db.collection(name).find({}, {batchSize:100})){
    yield JSON.stringify({collection:name,doc:EJSON.stringify(doc,{relaxed:false})})+String.fromCharCode(10);n++;count++;
   }
   yield JSON.stringify({type:"collection-end",collection:name,count:n})+String.fromCharCode(10);
  }
  yield JSON.stringify({type:"end",count,collections:collections.length})+String.fromCharCode(10);
 }
 let created=false;
 try{
  fs.writeFileSync(file,Buffer.concat([Buffer.from("WLVLT001","ascii"),nonce]),{flag:"wx",mode:0o600});created=true;
  const trailer=new Transform({transform(chunk,enc,cb){cb(null,chunk)},flush(cb){this.push(cipher.getAuthTag());cb();}});
  await pipeline(Readable.from(records()),createGzip({level:6}),cipher,trailer,fs.createWriteStream(file,{flags:"a",mode:0o600}));
  console.log("Encrypted backup created:",file,"documents:",count);
 }catch(e){if(created)fs.rmSync(file,{force:true});throw e}
 finally{await mongoose.disconnect().catch(()=>{});}
}
main().catch(e=>{console.error("Encrypted backup failed:",e.message);process.exitCode=1});
