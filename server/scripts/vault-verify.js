
"use strict";
const fs=require("fs"),crypto=require("crypto"),zlib=require("zlib"),{EJSON}=require("mongodb");
function main(){
 const file=process.argv[2],hex=process.env.VAULT_BACKUP_KEY||"";
 if(!file||!(/^[a-f0-9]{64}$/i.test(hex)))throw Error("Provide encrypted archive path and VAULT_BACKUP_KEY.");
 const b=fs.readFileSync(file);
 if(b.length<40||b.subarray(0,8).toString("ascii")!=="WLVLT001")throw Error("Wrong vault archive format.");
 const d=crypto.createDecipheriv("aes-256-gcm",Buffer.from(hex,"hex"),b.subarray(8,20));
 d.setAuthTag(b.subarray(b.length-16));
 const plaintext=zlib.gunzipSync(Buffer.concat([d.update(b.subarray(20,b.length-16)),d.final()]),{maxOutputLength:512*1024*1024}).toString("utf8");
 const lines=plaintext.trim().split(String.fromCharCode(10));const header=JSON.parse(lines[0]);
 if(header.type!=="wayne-vault"||header.version!==1)throw Error("Invalid archive manifest.");
 let total=0,ended=0;const counts={};
 for(const line of lines.slice(1,-1)){
  const item=JSON.parse(line);
  if(typeof item.doc==="string"&&item.collection){EJSON.parse(item.doc,{relaxed:false});counts[item.collection]=(counts[item.collection]||0)+1;total++;}
  else if(item.type==="collection-end"&&(counts[item.collection]||0)===item.count)ended++;
  else throw Error("Invalid archive record or count mismatch.");
 }
 const footer=JSON.parse(lines.at(-1));
 if(footer.type!=="end"||footer.count!==total||footer.collections!==ended)throw Error("Incomplete archive manifest.");
 console.log("Verified AES-256-GCM encrypted WAYNE VAULT backup:",total,"documents,",ended,"collections.");
}
try{main()}catch(e){console.error("Backup verification failed:",e.message);process.exitCode=1}
