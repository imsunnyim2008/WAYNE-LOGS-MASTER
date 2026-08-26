const crypto=require("crypto");
function keyFrom(secret){if(!secret)throw new Error("Inventory encryption is not configured.");return crypto.createHash("sha256").update(secret).digest()}
function key(){return keyFrom(process.env.INVENTORY_ENCRYPTION_KEY||process.env.JWT_SECRET)}
function decryptWith(value,encryptionKey){const[iv,tag,data]=String(value).split(".");if(!iv||!tag||!data)throw new Error("Encrypted inventory record is invalid.");const decipher=crypto.createDecipheriv("aes-256-gcm",encryptionKey,Buffer.from(iv,"base64"));decipher.setAuthTag(Buffer.from(tag,"base64"));return Buffer.concat([decipher.update(Buffer.from(data,"base64")),decipher.final()]).toString("utf8")}
exports.fingerprint=value=>crypto.createHash("sha256").update(String(value).trim()).digest("hex");
exports.encrypt=value=>{const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv("aes-256-gcm",key(),iv);const data=Buffer.concat([cipher.update(String(value),"utf8"),cipher.final()]);return [iv.toString("base64"),cipher.getAuthTag().toString("base64"),data.toString("base64")].join(".")};
exports.decrypt=value=>{try{return decryptWith(value,key())}catch(error){const dedicated=process.env.INVENTORY_ENCRYPTION_KEY,legacy=process.env.JWT_SECRET;if(dedicated&&legacy&&dedicated!==legacy)return decryptWith(value,keyFrom(legacy));throw error}};

