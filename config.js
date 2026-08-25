// WAYNE LOGS API configuration.
// For local Live Server it uses localhost:5000.
// For production it expects a Render service named: wayne-logs-master-api
window.WAYNE_API_URL = ["localhost","127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";

// One premium feedback system for customer and admin actions.
(function installWayneActionFeedback(){
  const style=document.createElement("style");
  style.textContent=`.wayne-dialog-layer{position:fixed;inset:0;z-index:200000;display:grid;place-items:center;padding:18px;background:radial-gradient(circle at 50% 42%,rgba(35,133,231,.12),transparent 45%),rgba(5,17,35,.46);-webkit-backdrop-filter:blur(14px) saturate(125%);backdrop-filter:blur(14px) saturate(125%);animation:wayneDialogFade .18s ease}.wayne-dialog{position:relative;width:min(360px,calc(100vw - 36px));overflow:hidden;border:1px solid rgba(255,255,255,.72);border-radius:27px;background:linear-gradient(145deg,rgba(255,255,255,.88),rgba(229,244,255,.72));-webkit-backdrop-filter:blur(32px) saturate(180%);backdrop-filter:blur(32px) saturate(180%);color:#0d223d;text-align:center;box-shadow:inset 0 1px 0 rgba(255,255,255,.95),inset 0 -1px 0 rgba(136,196,238,.2),0 22px 65px rgba(2,31,65,.28),0 3px 12px rgba(12,93,160,.14);animation:wayneDialogIn .3s cubic-bezier(.16,1,.3,1)}.wayne-dialog:before{content:"";position:absolute;inset:0 0 auto;height:54%;pointer-events:none;background:linear-gradient(155deg,rgba(255,255,255,.72),rgba(255,255,255,0) 62%)}.wayne-dialog-copy{position:relative;padding:22px 22px 19px}.wayne-dialog-icon{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 12px;border:1px solid rgba(255,255,255,.92);border-radius:15px;background:linear-gradient(145deg,rgba(239,249,255,.96),rgba(176,222,255,.62));color:#087fc4;font-size:21px;font-weight:950;box-shadow:inset 0 1px 0 #fff,0 8px 22px rgba(16,124,202,.14)}.wayne-dialog.success .wayne-dialog-icon{background:linear-gradient(145deg,#effff8,#c9f3df);color:#09805a}.wayne-dialog.error .wayne-dialog-icon{background:linear-gradient(145deg,#fff5f7,#ffd6de);color:#d23c59}.wayne-dialog h2{margin:0 0 7px;font-size:19px;line-height:1.24;letter-spacing:-.025em}.wayne-dialog p{margin:0 auto;max-width:290px;color:#566d85;font-size:13.5px;line-height:1.45;white-space:pre-wrap}.wayne-dialog-actions{position:relative;display:grid;grid-template-columns:repeat(var(--wayne-actions,1),1fr);gap:1px;padding:1px 8px 8px;border-top:1px solid rgba(125,171,207,.3);background:rgba(255,255,255,.2)}.wayne-dialog-actions button{min-width:0;min-height:47px;padding:8px 10px;border:0;border-radius:16px;background:rgba(255,255,255,.5);color:#087fc4;font-size:14px;font-weight:850;cursor:pointer;transition:transform .16s ease,filter .16s ease,background .16s ease}.wayne-dialog-actions button:hover{background:rgba(255,255,255,.84);transform:translateY(-1px)}.wayne-dialog-actions button:active{transform:scale(.97)}.wayne-dialog-actions .wayne-dialog-primary{color:#fff;background:linear-gradient(135deg,rgba(21,105,218,.96),rgba(0,164,222,.94));box-shadow:inset 0 1px 0 rgba(255,255,255,.3),0 7px 18px rgba(11,125,205,.22)}.wayne-dialog-actions .wayne-dialog-primary:hover{background:linear-gradient(135deg,#105fc0,#078dc8)}.wayne-dialog-actions .wayne-dialog-danger{color:#fff;background:linear-gradient(135deg,#ee3155,#bd0c32)}@keyframes wayneDialogFade{from{opacity:0}to{opacity:1}}@keyframes wayneDialogIn{from{opacity:0;transform:scale(.86) translateY(14px);filter:blur(5px)}to{opacity:1;transform:none;filter:none}}@media(max-width:520px){.wayne-dialog{width:min(338px,calc(100vw - 34px));border-radius:25px}.wayne-dialog-copy{padding:20px 18px 17px}.wayne-dialog-icon{width:42px;height:42px;margin-bottom:10px}.wayne-dialog h2{font-size:18px}.wayne-dialog p{font-size:13px}.wayne-dialog-actions button{min-height:46px;font-size:13.5px}}@media(prefers-reduced-motion:reduce){.wayne-dialog-layer,.wayne-dialog{animation:none}.wayne-dialog-actions button{transition:none}}`;
  document.head.appendChild(style);
  let lastShown=0,queue=Promise.resolve();
  function openDialog({message,type="info",title,confirm=false,confirmText="Continue",cancelText="Cancel",danger=false}){
    return new Promise(resolve=>{
      const layer=document.createElement("div"),dialog=document.createElement("section"),copy=document.createElement("div"),icon=document.createElement("span"),heading=document.createElement("h2"),body=document.createElement("p"),actions=document.createElement("div"),primary=document.createElement("button");
      layer.className="wayne-dialog-layer";dialog.className="wayne-dialog "+type;copy.className="wayne-dialog-copy";icon.className="wayne-dialog-icon";actions.className="wayne-dialog-actions";actions.style.setProperty("--wayne-actions",confirm?2:1);icon.textContent=type==="error"?"!":type==="success"?"✓":"i";heading.textContent=title||(confirm?"Final confirmation":type==="error"?"Action failed":type==="success"?"Successful":"Notice");body.textContent=String(message||"");primary.className=danger?"wayne-dialog-danger":"wayne-dialog-primary";primary.textContent=confirm?confirmText:"OK";primary.type="button";
      const finish=value=>{layer.remove();document.removeEventListener("keydown",onKey);resolve(value)},onKey=event=>{if(event.key==="Escape")finish(false);if(event.key==="Enter")finish(true)};document.addEventListener("keydown",onKey);
      copy.append(icon,heading,body);if(confirm){const cancel=document.createElement("button");cancel.type="button";cancel.textContent=cancelText;cancel.onclick=()=>finish(false);actions.append(cancel)}primary.onclick=()=>finish(true);actions.append(primary);dialog.append(copy,actions);layer.append(dialog);document.body.appendChild(layer);primary.focus();
    });
  }
  function enqueue(options){const result=queue.then(()=>openDialog(options));queue=result.catch(()=>{});return result}
  function show(message,type="success",title){const text=String(message||"").trim();if(!text)return Promise.resolve();lastShown=Date.now();return enqueue({message:text,type,title})}
  window.waynePopup=show;
  window.wayneConfirm=(message,options={})=>enqueue({message:String(message||"Do you want to continue?"),type:"info",title:options.title||"Final confirmation",confirm:true,confirmText:options.confirmText||"Continue",cancelText:options.cancelText||"Cancel",danger:options.danger===true});
  window.alert=message=>{if(String(message)==="Action cancelled.")return;show(message,/failed|error|incorrect|cannot|could not|invalid|rejected/i.test(String(message))?"error":"success")};
  function confirmationFor(url,method){if(!["POST","PUT","PATCH","DELETE"].includes(method))return null;if(/\/api\/auth\/(?:login|register)|\/notifications\/(?:read-all|[^/]+\/read)/i.test(url)||(/\/api\/orders\/?(?:\?.*)?$/i.test(url)&&method==="POST"))return null;if(/\/wallet\/admin\/clear/i.test(url))return{title:"Clear entire balance?",message:"This will permanently set the selected customer's wallet balance to ₦0.",confirmText:"Yes, clear it",danger:true};if(/\/wallet\/admin\/credit/i.test(url))return{title:"Credit customer wallet?",message:"Confirm that the customer, amount and reason are correct.",confirmText:"Yes, credit wallet"};if(/\/transactions\/[^/]+\/review/i.test(url))return{title:"Submit payment decision?",message:"Confirm your approval or rejection before changing the customer's wallet.",confirmText:"Yes, continue"};if(/\/orders\/admin\/[^/]+\/refund/i.test(url))return{title:"Refund this order?",message:"The full payment will be returned to the customer's wallet. This cannot be repeated.",confirmText:"Yes, refund",danger:true};if(/\/orders\/[^/]+\/wallet\/pay/i.test(url))return{title:"Complete wallet purchase?",message:"Your wallet will be charged and one inventory item will be assigned to this order.",confirmText:"Pay now"};if(/\/wallet\/topups\/initialize/i.test(url))return{title:"Start wallet funding?",message:"Confirm the amount and payment method before continuing.",confirmText:"Continue"};if(/\/wallet\/topups\/[^/]+\/submit/i.test(url))return{title:"Submit transfer details?",message:"Confirm that you have completed the bank transfer and entered the correct reference.",confirmText:"Yes, submit"};if(/\/products(?:\/|$)/i.test(url))return{title:method==="DELETE"?"Delete this product?":"Save product changes?",message:method==="DELETE"?"This product and its remaining inventory will be removed.":"Confirm that the product and inventory information is correct.",confirmText:method==="DELETE"?"Yes, delete":"Save",danger:method==="DELETE"};if(/\/broadcast/i.test(url))return{title:"Notify every customer?",message:"This message will be published immediately to all active customers.",confirmText:"Publish now"};if(/password-assistance\/reset/i.test(url))return{title:"Create temporary password?",message:"The customer will be logged out everywhere and must change the one-use password after login.",confirmText:"Generate password",danger:true};if(/\/settings\/admin/i.test(url))return{title:"Save customer settings?",message:"Confirm the announcement and Telegram information before publishing the changes.",confirmText:"Save settings"};if(/\/support/i.test(url))return{title:"Send this support action?",message:"Confirm that your message and selected status are correct.",confirmText:"Send"};if(/\/orders\/admin\/[^/]+\/status/i.test(url))return{title:"Change order status?",message:"Confirm this order-status change.",confirmText:"Change status"};return{title:"Continue with this action?",message:"Please confirm before the website saves this change.",confirmText:"Continue"}}
  document.addEventListener("click",async event=>{const button=event.target.closest("button");if(!button||button.dataset.wayneLogoutApproved==="1"||!/^(?:logout|log out)$/i.test(button.textContent.trim()))return;event.preventDefault();event.stopImmediatePropagation();const approved=await window.wayneConfirm("Do you want to securely log out of WAYNE LOGS?",{title:"Log out now?",confirmText:"Log out"});if(approved){button.dataset.wayneLogoutApproved="1";button.click();delete button.dataset.wayneLogoutApproved}},true);
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,options={}){
    const method=String(options.method||(input&&input.method)||"GET").toUpperCase(),url=String(typeof input==="string"?input:input?.url||""),confirmation=confirmationFor(url,method);
    if(confirmation){const approved=await window.wayneConfirm(confirmation.message,confirmation);if(!approved){show("The action was cancelled. Nothing was changed.","info","Cancelled");const error=new Error("Action cancelled.");error.wayneCancelled=true;throw error}}
    const started=Date.now();let response;
    try{response=await originalFetch(input,options)}finally{setTimeout(()=>window.wayneRefreshFormReadiness?.(),400)}
    if(!["POST","PUT","PATCH","DELETE"].includes(method))return response;
    response.clone().json().then(data=>setTimeout(()=>{if(lastShown>started)return;let message=data?.message||"Action completed successfully.";if(response.ok){if(url.includes("/admin/credit"))message="Customer wallet credited successfully.";else if(url.includes("/admin/clear"))message="Customer balance cleared successfully.";else if(url.includes("/review"))message="Manual payment review completed successfully.";else if(url.includes("/wallet/pay"))message="Purchase completed successfully.";else if(url.includes("/refund"))message="Refund completed successfully.";else if(url.includes("/support"))message="Support action completed successfully.";else if(url.includes("/broadcast"))message="Notification published successfully.";else if(url.includes("/settings"))message="Settings saved successfully.";show(message,"success")}else show(message,"error")},220)).catch(()=>{});return response;
  };
})();

// Make form-action readiness visually consistent without affecting navigation buttons.
(function installWayneFormReadiness(){
  const install=()=>document.querySelectorAll("form:not(#adminClearForm)").forEach(form=>{
    if(form.dataset.wayneReadiness==="1")return;form.dataset.wayneReadiness="1";
    const buttons=[...form.querySelectorAll('button[type="submit"],input[type="submit"],button:not([type])')];if(!buttons.length)return;
    const update=()=>{const ready=form.checkValidity();buttons.forEach(button=>{if(button.dataset.wayneBusy==="1")return;button.disabled=!ready;button.classList.toggle("wayne-form-ready",ready)})};
    form._wayneUpdateReadiness=update;form.addEventListener("input",update);form.addEventListener("change",update);form.addEventListener("reset",()=>setTimeout(update));update();
  });
  window.wayneRefreshFormReadiness=()=>document.querySelectorAll("form").forEach(form=>form._wayneUpdateReadiness?.());
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",install);else install();
})();

// Keep every customer and admin page on the same premium visual system.
if (!document.querySelector('link[href="premium-pages.css"]')) {
  const premiumTheme = document.createElement("link");
  premiumTheme.rel = "stylesheet";
  premiumTheme.href = "premium-pages.css?v=20260825-liquidglass1";
  document.head.appendChild(premiumTheme);
}

// Public announcement popup and Telegram contact button.
// Content comes from the protected Admin Settings page; customer pages only read it.
async function loadWaynePublicSettings() {
  if (location.pathname.toLowerCase().endsWith("/admin.html")) return;
  try {
    const response = await fetch(window.WAYNE_API_URL + "/api/settings/public");
    const data = await response.json();
    if (!response.ok || !data.settings) return;
    const settings = data.settings;
    const style = document.createElement("style");
    style.textContent = `.wayne-telegram{position:fixed;right:22px;bottom:22px;width:62px;height:62px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#229ed9,#087fbd);color:#fff;text-decoration:none;box-shadow:0 14px 35px rgba(16,126,183,.35);z-index:9998;font-size:28px;border:4px solid rgba(255,255,255,.85)}.wayne-telegram:hover{transform:translateY(-2px)}.wayne-announcement-backdrop{position:fixed;inset:0;background:rgba(5,18,40,.66);backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px;z-index:9999}.wayne-announcement{width:min(520px,100%);background:#fff;color:#10233d;border-radius:25px;padding:30px;box-shadow:0 30px 90px rgba(0,0,0,.3);position:relative}.wayne-announcement-badge{display:inline-block;background:#e7f6fd;color:#087fbd;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900}.wayne-announcement h2{margin:16px 0 8px;font-size:30px}.wayne-announcement p{color:#61758d;white-space:pre-wrap;line-height:1.65}.wayne-announcement-close{position:absolute;right:16px;top:16px;border:0;background:#edf3f8;color:#28445e;width:38px;height:38px;border-radius:12px;font-size:22px;cursor:pointer}.wayne-announcement-actions{display:flex;gap:10px;margin-top:22px}.wayne-announcement-actions button,.wayne-announcement-actions a{flex:1;text-align:center;border:0;border-radius:13px;padding:13px;font-weight:900;text-decoration:none;cursor:pointer}.wayne-announcement-ok{background:#eef4f8;color:#28445e}.wayne-announcement-chat{background:linear-gradient(135deg,#229ed9,#087fbd);color:#fff}@media(max-width:600px){.wayne-telegram{width:55px;height:55px;right:15px;bottom:15px}.wayne-announcement{padding:25px 20px}.wayne-announcement h2{font-size:25px}}`;
    document.head.appendChild(style);

    if (settings.telegramUrl) {
      const telegram = document.createElement("a");
      telegram.className = "wayne-telegram";
      telegram.href = settings.telegramUrl;
      telegram.target = "_blank";
      telegram.rel = "noopener noreferrer";
      telegram.setAttribute("aria-label", "Contact us on Telegram");
      telegram.title = "Contact us on Telegram";
      telegram.textContent = "➤";
      document.body.appendChild(telegram);
    }

    const seenKey = "wayneAnnouncementSeen:" + String(settings.version || 0);
    if (!settings.announcementEnabled || !settings.announcementMessage || sessionStorage.getItem(seenKey)) return;
    const backdrop = document.createElement("div"), card = document.createElement("section"), close = document.createElement("button"), badge = document.createElement("span"), title = document.createElement("h2"), message = document.createElement("p"), actions = document.createElement("div"), okay = document.createElement("button");
    backdrop.className = "wayne-announcement-backdrop"; card.className = "wayne-announcement"; close.className = "wayne-announcement-close"; badge.className = "wayne-announcement-badge"; actions.className = "wayne-announcement-actions"; okay.className = "wayne-announcement-ok";
    close.textContent = "×"; close.setAttribute("aria-label", "Close announcement"); badge.textContent = "ANNOUNCEMENT"; title.textContent = settings.announcementTitle || "WAYNE LOGS"; message.textContent = settings.announcementMessage; okay.textContent = "Got it";
    const dismiss = () => { sessionStorage.setItem(seenKey, "1"); backdrop.remove(); };
    close.onclick = dismiss; okay.onclick = dismiss; backdrop.onclick = event => { if (event.target === backdrop) dismiss(); };
    actions.appendChild(okay);
    if (settings.telegramUrl) { const chat = document.createElement("a"); chat.className = "wayne-announcement-chat"; chat.href = settings.telegramUrl; chat.target = "_blank"; chat.rel = "noopener noreferrer"; chat.textContent = "Chat on Telegram"; actions.appendChild(chat); }
    card.append(close, badge, title, message, actions); backdrop.appendChild(card); document.body.appendChild(backdrop);
  } catch (error) {}
}
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", loadWaynePublicSettings); else loadWaynePublicSettings();

async function loadWayneNotificationBell(){
  const token=localStorage.getItem("wayneToken");if(!token||location.pathname.toLowerCase().endsWith("/admin.html")||location.pathname.toLowerCase().endsWith("/notifications.html"))return;
  try{const r=await fetch(window.WAYNE_API_URL+"/api/notifications/my",{headers:{Authorization:"Bearer "+token}}),d=await r.json();if(!r.ok)return;const host=document.querySelector(".simple-actions,.dash-nav,.nav-actions");if(!host)return;const a=document.createElement("a");a.href="notifications.html";a.className=host.classList.contains("simple-actions")?"simple-btn secondary notification-bell":"ghost-btn notification-bell";a.setAttribute("aria-label",`${d.unread||0} unread notifications`);a.innerHTML=`🔔${d.unread?`<span class="notification-badge">${d.unread>99?"99+":d.unread}</span>`:""}`;host.insertBefore(a,host.lastElementChild);const s=document.createElement("style");s.textContent='.notification-bell{position:relative;text-decoration:none;display:inline-flex!important;align-items:center;justify-content:center}.notification-badge{position:absolute;right:-5px;top:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef3f62;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:950}';document.head.appendChild(s)}catch(e){}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadWayneNotificationBell);else loadWayneNotificationBell();
