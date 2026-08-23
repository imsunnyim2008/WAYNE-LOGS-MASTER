require("dotenv").config();
const mongoose=require("mongoose");
const bcrypt=require("bcryptjs");
const User=require("./models/User");

async function reset(){
  const email=String(process.env.ADMIN_EMAIL||"").trim().toLowerCase();
  const password=String(process.env.ADMIN_RESET_PASSWORD||"");
  if(!process.env.MONGO_URI)throw new Error("MONGO_URI is missing.");
  if(!email)throw new Error("ADMIN_EMAIL is missing.");
  if(password.length<12)throw new Error("ADMIN_RESET_PASSWORD must contain at least 12 characters.");
  await mongoose.connect(process.env.MONGO_URI);
  const user=await User.findOne({email});
  if(!user)throw new Error("No account matches ADMIN_EMAIL.");
  user.password=await bcrypt.hash(password,12);
  user.role="admin";
  user.isActive=true;
  await user.save();
  console.log("Admin password reset completed for",email);
  await mongoose.disconnect();
}

reset().catch(async error=>{
  console.error("Admin password reset failed:",error.message);
  try{await mongoose.disconnect()}catch{}
  process.exit(1);
});
