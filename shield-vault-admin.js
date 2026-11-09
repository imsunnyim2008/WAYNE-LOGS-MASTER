(function(){
"use strict";
const $=id=>document.getElementById(id);
const area=$("shieldOwnerArea"),status=$("shieldStatus"),msg=$("shieldMessage");
if(!area||!status)return;
let displayedCodes=[];
const origin=window.WAYNE_API_URL||"http://localhost:5000";
function say(message,error=false){msg.textContent=message;msg.style.color=error?"#dc3545":"#119c74"}
async function api(path,options={}){
 const t=localStorage.getItem("wayneToken");
 if(!t)throw Error("Please sign in again.");
 const r=await fetch(origin+path,{...options,headers:{"Content-Type":"application/json",Authorization:"Bearer "+t,...(options.headers||{})}});
 const result=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(result.message||"Request failed.");
 return result;
}
const post=(path,data)=>api(path,{method:"POST",body:JSON.stringify(data)});
function saveSession(tokenValue){if(tokenValue){localStorage.setItem("wayneToken",tokenValue);if(typeof token!=="undefined")token=tokenValue;}}
async function loadShield(){
 try{
  const d=await api("/api/security/admin/2fa/status");
  $("shieldStartForm").hidden=!d.isOwner||d.enabled;
  $("shieldDisableForm").hidden=!d.isOwner||!d.enabled;
  if(!d.isOwner){area.hidden=true;status.textContent="Owner only";}
  else{area.hidden=false;status.textContent=d.enabled?"✅ Enabled":"⚠️ Not enabled";
    if(d.enabled){$("shieldEnrollPanel").hidden=true;$("shieldRecoveryPanel").hidden=true;}
  }
 }catch(error){status.textContent="Unavailable";say(error.message,true);}
}
async function loadVault(){
 const target=$("vaultSummary");if(!target)return;target.textContent="Checking database integrity…";
 try{
  const d=await api("/api/security/admin/vault");
  const rows=[["Customers",d.records?.customers],["Orders",d.records?.orders],["Wallet transactions",d.records?.transactions],["Inventory records",d.records?.inventoryItems],["Products",d.records?.products]];
  const grid=document.createElement("div");grid.className="vault-metrics";
  for(const [label,value]of rows){const item=document.createElement("div");const s=document.createElement("span");s.textContent=label;const b=document.createElement("b");b.textContent=String(value??0);item.append(s,b);grid.append(item)}
  const findings=document.createElement("p");const anomalies=d.anomalies||{};const count=Object.values(anomalies).reduce((sum,n)=>sum+Number(n||0),0);
  findings.className=count?"vault-warning":"vault-good";
  findings.textContent=count?count+" potential data integrity issue(s). Review the records before any correction.":"No anomalies identified by these checks.";
  const backup=document.createElement("p");
  backup.textContent="Encrypted export ready · Automatic backup "+(d.backups?.automatedBackupsConfigured?"configured":"not configured");
  backup.style.fontSize="13px";backup.style.margin="8px 0";
  target.replaceChildren(grid,findings,backup);
 }catch(error){target.textContent=error.message;}
}
$("vaultRefresh").addEventListener("click",loadVault);
$("shieldStartForm").addEventListener("submit",async e=>{
 e.preventDefault();const button=e.target.querySelector("button");button.disabled=true;say("");
 try{
  const d=await post("/api/security/admin/2fa/setup",{password:$("shieldStartPassword").value});
  $("shieldStartPassword").value="";$("shieldSecret").textContent=d.secret;
  $("shieldEnrollPanel").hidden=false;
  $("shieldEnableCode").focus();
  say("Enter this key into your authenticator, then confirm the 6-digit code. Setup expires after 10 minutes.");
 }catch(error){say(error.message,true)}finally{button.disabled=false}
});
$("shieldEnableForm").addEventListener("submit",async e=>{
 e.preventDefault();const b=e.target.querySelector("button");b.disabled=true;
 try{
  const d=await post("/api/security/admin/2fa/enable",{code:$("shieldEnableCode").value});
  saveSession(d.token);displayedCodes=d.recoveryCodes||[];
  $("shieldSecret").textContent="";$("shieldEnableCode").value="";$("shieldEnrollPanel").hidden=true;
  $("shieldRecoveryCodes").textContent=displayedCodes.join("\n");$("shieldRecoveryPanel").hidden=false;
  $("shieldStartForm").hidden=true;$("shieldDisableForm").hidden=false;status.textContent="✅ Enabled";
  say("Two-factor protection enabled. Save all recovery codes offline now. All previous sessions were signed out.");
 }catch(error){say(error.message,true)}finally{b.disabled=false}
});
$("shieldRecoveryCopy").addEventListener("click",async()=>{
 if(!displayedCodes.length)return;
 try{await navigator.clipboard.writeText(displayedCodes.join("\n"));say("Recovery codes copied. Store them somewhere private and offline.")}catch{say("Select and copy your recovery codes manually.",true)}
});
$("shieldDisableForm").addEventListener("submit",async e=>{
 e.preventDefault();
 const okay=typeof window.wayneConfirm==="function"?await window.wayneConfirm("Disable administrator two-factor authentication?",{title:"Security confirmation",confirmText:"Disable 2FA"}):window.confirm("Disable 2FA?");
 if(!okay)return;const b=e.target.querySelector("button");b.disabled=true;
 try{
  const d=await post("/api/security/admin/2fa/disable",{password:$("shieldDisablePassword").value,code:$("shieldDisableCode").value});
  saveSession(d.token);$("shieldDisablePassword").value="";$("shieldDisableCode").value="";
  $("shieldDisableForm").hidden=true;$("shieldStartForm").hidden=false;status.textContent="⚠️ Not enabled";
  say("Two-factor authentication disabled. Your prior sessions were signed out.");
 }catch(error){say(error.message,true)}finally{b.disabled=false}
});
window.loadShieldVault=function(){loadShield();loadVault()};
if(document.getElementById("security-centre")?.classList.contains("active"))window.loadShieldVault();
})();
