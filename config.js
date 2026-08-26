// WAYNE LOGS shared customer configuration
window.WAYNE_API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";

// Lightweight shared dialogs used by customer/admin pages.
(function installWayneDialogs(){
  const style=document.createElement("style");
  style.textContent=`
  .wayne-dialog-layer{position:fixed;inset:0;z-index:200000;display:grid;place-items:center;padding:18px;background:rgba(5,17,35,.48);-webkit-backdrop-filter:blur(12px);backdrop-filter:blur(12px)}
  .wayne-dialog{width:min(360px,calc(100vw - 36px));overflow:hidden;border:1px solid #cfe2ef;border-radius:24px;background:#fff;color:#102844;box-shadow:0 26px 70px rgba(3,35,65,.28);text-align:center}
  .wayne-dialog-copy{padding:22px}.wayne-dialog-icon{display:grid;place-items:center;width:44px;height:44px;margin:0 auto 12px;border-radius:14px;background:#eaf7fd;color:#0784c4;font-size:20px;font-weight:950}
  .wayne-dialog.success .wayne-dialog-icon{background:#e8faf3;color:#07875a}.wayne-dialog.error .wayne-dialog-icon{background:#fff0f3;color:#d33855}
  .wayne-dialog h2{margin:0 0 8px;font-size:19px}.wayne-dialog p{margin:0;color:#647b94;font-size:13.5px;line-height:1.5;white-space:pre-wrap}
  .wayne-dialog-actions{display:grid;grid-template-columns:repeat(var(--wayne-actions,1),1fr);gap:8px;padding:10px;border-top:1px solid #dce8f1}
  .wayne-dialog-actions button{min-height:45px;border:1px solid #d5e4ef;border-radius:14px;background:#f6fbfe;color:#153451;font-weight:850;cursor:pointer}
  .wayne-dialog-actions .primary{border:0;background:linear-gradient(135deg,#086ed8,#09a8df);color:#fff}

  /* The old five-button bottom dock is removed everywhere. */
  .wayne-customer-dock,.wayne-account-backdrop{display:none!important}
  @media(max-width:760px){body{padding-bottom:0!important}}

  /* Wallet cleanup requested by owner. */
  body .dash-wrap>.platforms{display:none!important}
  .wayne-wallet-back{display:inline-flex;align-items:center;gap:8px;margin:18px 0 2px;padding:10px 14px;border:1px solid #cfe0ec;border-radius:13px;background:#fff;color:#0b78b6;text-decoration:none;font-weight:900;box-shadow:0 7px 18px rgba(23,70,108,.06)}
  .wayne-wallet-back svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
  `;
  document.head.appendChild(style);

  const openDialog=({message,type="info",title,confirm=false,confirmText="Continue",cancelText="Cancel"})=>new Promise(resolve=>{
    const layer=document.createElement("div");
    layer.className="wayne-dialog-layer";
    const dialog=document.createElement("section");
    dialog.className="wayne-dialog "+type;
    const icon=type==="error"?"!":type==="success"?"✓":"i";
    dialog.innerHTML=`<div class="wayne-dialog-copy"><div class="wayne-dialog-icon">${icon}</div><h2></h2><p></p></div><div class="wayne-dialog-actions" style="--wayne-actions:${confirm?2:1}"></div>`;
    dialog.querySelector("h2").textContent=title||(confirm?"Confirm action":type==="error"?"Action failed":type==="success"?"Successful":"Notice");
    dialog.querySelector("p").textContent=String(message||"");
    const actions=dialog.querySelector(".wayne-dialog-actions");
    const finish=value=>{layer.remove();resolve(value)};
    if(confirm){const cancel=document.createElement("button");cancel.textContent=cancelText;cancel.type="button";cancel.onclick=()=>finish(false);actions.appendChild(cancel)}
    const okay=document.createElement("button");okay.textContent=confirm?confirmText:"OK";okay.type="button";okay.className="primary";okay.onclick=()=>finish(true);actions.appendChild(okay);
    layer.onclick=e=>{if(e.target===layer&&!confirm)finish(true)};
    layer.appendChild(dialog);document.body.appendChild(layer);okay.focus();
  });
  window.waynePopup=(message,type="success",title)=>openDialog({message,type,title});
  window.wayneConfirm=(message,options={})=>openDialog({message,type:"info",title:options.title||"Confirm action",confirm:true,confirmText:options.confirmText||"Continue",cancelText:options.cancelText||"Cancel"});
  window.wayneRefreshFormReadiness=()=>{};
})();

// Remove any old dock that may have been injected from a cached script and add a real wallet Back button.
(function installWayneNavigationCleanup(){
  const cleanup=()=>{
    document.querySelectorAll(".wayne-customer-dock,.wayne-account-backdrop").forEach(el=>el.remove());
    if(/\/dashboard\.html$/i.test(location.pathname)){
      document.querySelectorAll(".dash-wrap > .platforms").forEach(el=>el.remove());
      const wrap=document.querySelector(".dash-wrap");
      if(wrap&&!document.querySelector(".wayne-wallet-back")){
        const back=document.createElement("a");
        back.className="wayne-wallet-back";
        back.href="index.html";
        back.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg><span>Back to Shop</span>';
        wrap.insertBefore(back,wrap.firstChild);
      }
    }
  };
  const start=()=>{cleanup();new MutationObserver(cleanup).observe(document.body,{childList:true,subtree:true})};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();

// Keep the premium theme available on pages that do not explicitly load it.
if(!document.querySelector('link[href^="premium-pages.css"]')){
  const theme=document.createElement("link");theme.rel="stylesheet";theme.href="premium-pages.css?v=20260825-optimized2";document.head.appendChild(theme);
}

// Public announcement + Telegram support button.
async function loadWaynePublicSettings(){
  if(location.pathname.toLowerCase().endsWith("/admin.html"))return;
  try{
    const response=await fetch(window.WAYNE_API_URL+"/api/settings/public");
    const data=await response.json();
    if(!response.ok||!data.settings)return;
    const settings=data.settings;
    const style=document.createElement("style");
    style.textContent=`.wayne-telegram{position:fixed;right:18px;bottom:18px;width:55px;height:55px;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#229ed9,#087fbd);color:#fff;text-decoration:none;box-shadow:0 14px 35px rgba(16,126,183,.3);z-index:9998;font-size:24px;border:3px solid rgba(255,255,255,.9)}.wayne-announcement-backdrop{position:fixed;inset:0;background:rgba(5,18,40,.66);backdrop-filter:blur(5px);display:grid;place-items:center;padding:20px;z-index:9999}.wayne-announcement{width:min(520px,100%);background:#fff;color:#10233d;border-radius:24px;padding:27px;box-shadow:0 30px 90px rgba(0,0,0,.3);position:relative}.wayne-announcement-badge{display:inline-block;background:#e7f6fd;color:#087fbd;border-radius:999px;padding:7px 11px;font-size:12px;font-weight:900}.wayne-announcement h2{margin:16px 0 8px;font-size:28px}.wayne-announcement p{color:#61758d;white-space:pre-wrap;line-height:1.6}.wayne-announcement-close{position:absolute;right:16px;top:16px;border:0;background:#edf3f8;color:#28445e;width:38px;height:38px;border-radius:12px;font-size:22px;cursor:pointer}.wayne-announcement-actions{display:flex;gap:10px;margin-top:22px}.wayne-announcement-actions button,.wayne-announcement-actions a{flex:1;text-align:center;border:0;border-radius:13px;padding:13px;font-weight:900;text-decoration:none;cursor:pointer}.wayne-announcement-ok{background:#eef4f8;color:#28445e}.wayne-announcement-chat{background:linear-gradient(135deg,#229ed9,#087fbd);color:#fff}`;
    document.head.appendChild(style);
    if(settings.telegramUrl&&!document.querySelector(".wayne-telegram")){
      const telegram=document.createElement("a");telegram.className="wayne-telegram";telegram.href=settings.telegramUrl;telegram.target="_blank";telegram.rel="noopener noreferrer";telegram.setAttribute("aria-label","Contact us on Telegram");telegram.textContent="➤";document.body.appendChild(telegram);
    }
    const seenKey="wayneAnnouncementSeen:"+String(settings.version||0);
    if(!settings.announcementEnabled||!settings.announcementMessage||sessionStorage.getItem(seenKey))return;
    const backdrop=document.createElement("div");backdrop.className="wayne-announcement-backdrop";
    const card=document.createElement("section");card.className="wayne-announcement";
    const close=document.createElement("button");close.className="wayne-announcement-close";close.textContent="×";
    const badge=document.createElement("span");badge.className="wayne-announcement-badge";badge.textContent="ANNOUNCEMENT";
    const title=document.createElement("h2");title.textContent=settings.announcementTitle||"WAYNE LOGS";
    const message=document.createElement("p");message.textContent=settings.announcementMessage;
    const actions=document.createElement("div");actions.className="wayne-announcement-actions";
    const okay=document.createElement("button");okay.className="wayne-announcement-ok";okay.textContent="Got it";
    const dismiss=()=>{sessionStorage.setItem(seenKey,"1");backdrop.remove()};close.onclick=dismiss;okay.onclick=dismiss;backdrop.onclick=e=>{if(e.target===backdrop)dismiss()};actions.appendChild(okay);
    if(settings.telegramUrl){const chat=document.createElement("a");chat.className="wayne-announcement-chat";chat.href=settings.telegramUrl;chat.target="_blank";chat.rel="noopener noreferrer";chat.textContent="Chat on Telegram";actions.appendChild(chat)}
    card.append(close,badge,title,message,actions);backdrop.appendChild(card);document.body.appendChild(backdrop);
  }catch{}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadWaynePublicSettings);else loadWaynePublicSettings();

// Notification shortcut for signed-in customer pages.
async function loadWayneNotificationBell(){
  const token=localStorage.getItem("wayneToken");
  if(!token||location.pathname.toLowerCase().endsWith("/admin.html")||location.pathname.toLowerCase().endsWith("/notifications.html"))return;
  try{
    const response=await fetch(window.WAYNE_API_URL+"/api/notifications/my",{headers:{Authorization:"Bearer "+token}});
    const data=await response.json();if(!response.ok)return;
    const host=document.querySelector(".simple-actions,.dash-nav,.nav-actions");if(!host)return;
    if(host.querySelector('a[href="notifications.html"]'))return;
    const link=document.createElement("a");link.href="notifications.html";link.className=host.classList.contains("simple-actions")?"simple-btn secondary notification-bell":"ghost-btn notification-bell";link.title="Notifications";link.textContent="Notifications";
    if(data.unread){const badge=document.createElement("span");badge.className="notification-badge";badge.textContent=data.unread>99?"99+":data.unread;link.appendChild(badge)}
    host.insertBefore(link,host.lastElementChild);
    const style=document.createElement("style");style.textContent='.notification-bell{position:relative;text-decoration:none;display:inline-flex!important;align-items:center;justify-content:center}.notification-badge{position:absolute;right:-5px;top:-7px;min-width:20px;height:20px;padding:0 5px;border-radius:999px;background:#ef3f62;color:#fff;display:grid;place-items:center;font-size:10px;font-weight:950}';document.head.appendChild(style);
  }catch{}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",loadWayneNotificationBell);else loadWayneNotificationBell();
