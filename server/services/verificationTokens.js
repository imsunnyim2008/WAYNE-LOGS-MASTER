"use strict";
const crypto=require("node:crypto");
const TOKEN_BYTES=32;
const VALID_TOKEN=/^[0-9a-f]{64}$/;
exports.generate=()=>crypto.randomBytes(TOKEN_BYTES).toString("hex");
exports.valid=value=>typeof value==="string"&&VALID_TOKEN.test(value);
exports.hash=token=>crypto.createHash("sha256").update(token).digest("hex");
exports.expiration=(now=new Date())=>new Date(now.getTime()+24*60*60*1000);
