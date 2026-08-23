// WAYNE LOGS API configuration.
// For local Live Server it uses localhost:5000.
// For production it expects a Render service named: wayne-logs-master-api
window.WAYNE_API_URL = ["localhost","127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";

// One premium feedback system for customer and admin actions.
(function installWayneActionFeedback(){
  const style=document.createElement("style");
  style.textContent=`.wayne-toast-area{position:fixed;right:20px;top:20px;width:min(390px,calc(100vw - 30px));display:grid;gap:12px;z-index:100000;pointer-events:none}.wayne-toast{pointer-events:auto;display:grid;grid-template-columns:44px 1fr 30px;align-items:center;gap:12px;padding:15px;border-radius:18px;background:#fff;color:#10233d;border:1px solid #d9e5ef;box-shadow:0 18px 55px rgba(12,37,64,.2);animation:wayneToastIn .25s ease}.wayne-toast.success{border-left:5px solid #10b981}.wayne-toast.error{border-left:5px solid #ef476f}.wayne-toast.info{border-left:5px solid #168bd2}.wayne-toast-icon{width:42px;height:42px;border-radius:13px;display:grid;place-items:center;background:#edf8f4;font-size:21px}.wayne-toast.error .wayne-toast-icon{background:#fff0f3}.wayne-toast.info .wayne-toast-icon{background:#ebf7ff}.wayne-toast strong{display:block;font-size:14px;margin-bottom:3px}.wayne-toast p{margin:0;color:#61758d;font-size:13px;line-height:1.4}.wayne-toast-close{border:0;background:transparent;color:#73859a;font-size:20px;cursor:pointer;padding:3px}@keyframes wayneToastIn{from{opacity:0;transform:translateY(-12px) scale(.97)}to{opacity:1;transform:none}}@media(max-width:600px){.wayne-toast-area{right:15px;top:15px}.wayne-toast{grid-template-columns:38px 1fr 28px;padding:13px}.wayne-toast-icon{width:38px;height:38px}}`;
  document.head.appendChild(style);
  let lastShown=0;
  function show(message,type="success",title){
    const text=String(message||"").trim();if(!text)return;
    lastShown=Date.now();let area=document.querySelector(".wayne-toast-area");if(!area){area=document.createElement("div");area.className="wayne-toast-area";document.body.appendChild(area)}
    const toast=document.createElement("section"),icon=document.createElement("span"),copy=document.createElement("div"),heading=document.createElement("strong"),body=document.createElement("p"),close=document.createElement("button");
    toast.className="wayne-toast "+type;icon.className="wayne-toast-icon";close.className="wayne-toast-close";icon.textContent=type==="error"?"✕":type==="info"?"ℹ":"✓";heading.textContent=title||(type==="error"?"Action failed":type==="info"?"Notice":"Successful");body.textContent=text;close.textContent="×";close.setAttribute("aria-label","Close message");copy.append(heading,body);toast.append(icon,copy,close);area.prepend(toast);const remove=()=>toast.remove();close.onclick=remove;setTimeout(remove,type==="error"?7000:4500);
  }
  window.waynePopup=show;
  window.alert=message=>show(message,/failed|error|incorrect|cannot|could not|invalid|rejected/i.test(String(message))?"error":"success");
  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,options={}){
    const response=await originalFetch(input,options),method=String(options.method||(input&&input.method)||"GET").toUpperCase();
    if(!["POST","PUT","PATCH","DELETE"].includes(method))return response;
    const started=Date.now();
    response.clone().json().then(data=>setTimeout(()=>{
      if(lastShown>started)return;
      const url=String(typeof input==="string"?input:input?.url||"");let message=data?.message||"Action completed successfully.";
      if(response.ok){if(url.includes("/admin/credit"))message="Customer wallet credited successfully.";else if(url.includes("/admin/clear"))message="Customer balance cleared successfully.";else if(url.includes("/review"))message="Manual payment review completed successfully.";else if(url.includes("pay-with-wallet"))message="Purchase completed successfully.";else if(url.includes("/support"))message="Support action completed successfully.";else if(url.includes("/broadcast"))message="Notification published successfully.";else if(url.includes("/settings"))message="Settings saved successfully.";show(message,"success")}else show(message,"error")
    },250)).catch(()=>{});
    return response;
  };
})();

// Keep every customer and admin page on the same premium visual system.
if (!document.querySelector('link[href="premium-pages.css"]')) {
  const premiumTheme = document.createElement("link");
  premiumTheme.rel = "stylesheet";
  premiumTheme.href = "premium-pages.css?v=20260823-badgefix1";
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
