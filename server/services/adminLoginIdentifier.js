"use strict";

// ADMIN_PASS is a public login identifier, NEVER a password or an API secret.
// It may only resolve to the existing owner administrator account and must
// still pass the same bcrypt, rate-limits, active-account and 2FA checks.
const ADMIN_ID="admin_pass";
const normalize=value=>String(value||"").trim().toLowerCase();
function isAdminAlias(value){return normalize(value)===ADMIN_ID}
async function resolveLoginUser(User,identifier,password,ownerEmail){
  const normalized=normalize(identifier);
  if(!isAdminAlias(normalized))return User.findOne({email:normalized});
  // Reject trivial PINs even if an old admin account has a weak password.
  // Admin ID sign-in requires a strong existing account password.
  if(typeof password!=="string"||password.length<12)return null;
  const configuredEmail=normalize(ownerEmail);
  if(configuredEmail){
    const configured=await User.findOne({email:configuredEmail,role:"admin",isActive:true});
    if(configured)return configured;
  }
  // Without a configured owner email, enable the alias ONLY when there is
  // exactly one active administrator. No guessing between admin accounts.
  const matches=await User.find({role:"admin",isActive:true})
    .sort({createdAt:1}).limit(2);
  return Array.isArray(matches)&&matches.length===1?matches[0]:null;
}
module.exports={isAdminAlias,resolveLoginUser};
