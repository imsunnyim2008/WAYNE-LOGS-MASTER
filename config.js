// WAYNE LOGS shared customer configuration
window.WAYNE_API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";




// Shared loading indicator for requests, forms and internal navigation.
(function installWayneLoader(){
  const style=document.createElement("style");
  style.textContent=`
  .wayne-loader-layer{position:fixed;inset:0;z-index:250000;display:grid;place-items:center;padding:20px;background:rgba(5,20,38,.38);-webkit-backdrop-filter:blur(7px);backdrop-filter:blur(7px);opacity:0;visibility:hidden;pointer-events:none;transition:opacity .18s ease,visibility .18s ease}
  .wayne-loader-layer.show{opacity:1;visibility:visible;pointer-events:auto}
  .wayne-loader-card{min-width:145px;padding:21px 24px 18px;border:1px solid rgba(255,255,255,.86);border-radius:22px;background:rgba(249,253,255,.96);color:#0f2d53;text-align:center;box-shadow:0 24px 65px rgba(3,35,67,.27)}
  .wayne-loader-spinner{position:relative;width:52px;height:52px;margin:0 auto 12px;border:4px solid #d7edf8;border-top-color:#0788ca;border-right-color:#16a36f;border-radius:50%;animation:wayneLoaderSpin .78s linear infinite}
  .wayne-loader-spinner:after{content:"W";position:absolute;inset:5px;display:grid;place-items:center;border-radius:50%;background:#eef9fe;color:#0b78b6;font-size:13px;font-weight:950;animation:wayneLoaderCounterSpin .78s linear infinite}
  .wayne-loader-card strong{display:block;font-size:14px}.wayne-loader-card small{display:block;margin-top:3px;color:#698098;font-size:11px}
  html.wayne-dark-mode .wayne-loader-card{border-color:#31506c;background:rgba(11,29,47,.97);color:#eef7ff}html.wayne-dark-mode .wayne-loader-card small{color:#9cb1c8}
  @keyframes wayneLoaderSpin{to{transform:rotate(360deg)}}@keyframes wayneLoaderCounterSpin{to{transform:rotate(-360deg)}}
  @media(prefers-reduced-motion:reduce){.wayne-loader-spinner,.wayne-loader-spinner:after{animation-duration:1.6s}}
  `;
  document.head.appendChild(style);
  let layer=null,pending=0,timer=0;
  const ensure=()=>{if(layer||!document.body)return layer;layer=document.createElement("div");layer.className="wayne-loader-layer";layer.setAttribute("role","status");layer.setAttribute("aria-live","polite");layer.innerHTML='<div class="wayne-loader-card"><div class="wayne-loader-spinner" aria-hidden="true"></div><strong>Loading…</strong><small>Please wait a moment</small></div>';document.body.appendChild(layer);return layer};
  const show=(label="Loading…")=>{const node=ensure();if(!node)return;node.querySelector("strong").textContent=label;node.classList.add("show");document.body.setAttribute("aria-busy","true")};
  const hide=()=>{clearTimeout(timer);timer=0;if(layer)layer.classList.remove("show");document.body?.removeAttribute("aria-busy")};
  const begin=(label="Loading…")=>{pending+=1;clearTimeout(timer);timer=setTimeout(()=>{if(pending>0)show(label)},220)};
  const end=()=>{pending=Math.max(0,pending-1);if(pending===0)hide()};
  window.wayneLoading={show:label=>{pending+=1;show(label)},hide:end,begin,end};
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async function(...args){begin("Loading…");try{return await nativeFetch(...args)}finally{end()}};
  const installEvents=()=>{
    ensure();
    document.addEventListener("click",event=>{const link=event.target.closest("a[href]");if(!link||event.defaultPrevented||link.target==="_blank"||link.hasAttribute("download"))return;const href=link.getAttribute("href")||"";if(!href||href.startsWith("#")||href.startsWith("javascript:"))return;try{const url=new URL(link.href,location.href);if(url.origin===location.origin&&url.href!==location.href)show("Opening…")}catch{}},true);
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",installEvents);else installEvents();
  window.addEventListener("pageshow",()=>{pending=0;hide()});
})();

// Shared appearance setting used by every customer page.
(function installWayneAppearance(){
  const style=document.createElement("style");
  style.textContent=`
  html.wayne-dark-mode,html.wayne-dark-mode body{background:#071422!important;color:#eef7ff!important;color-scheme:dark}
  html.wayne-dark-mode body:before{background:radial-gradient(circle at 80% 0,rgba(15,124,181,.15),transparent 28%),radial-gradient(circle at 0 45%,rgba(20,70,130,.14),transparent 24%)!important}
  html.wayne-dark-mode :where(.nav,.simple-header,.dash-header,.market-page-header,.admin-top){background:#0b1d2f!important;border-color:#24405a!important;color:#eef7ff!important}
  html.wayne-dark-mode :where(.panel,.settings-card,.order-card,.notification-card,.simple-product,.profile-details,.profile-identity,.referral-card,.profile-shortcuts,.support-ticket,.history-card,.table-wrap){background:#0d2135!important;border-color:#28445e!important;color:#eef7ff!important;box-shadow:0 12px 30px rgba(0,0,0,.2)!important}
  html.wayne-dark-mode :where(h1,h2,h3,h4,strong,.brand,.market-brand,.market-category-heading){color:#eef7ff!important}
  html.wayne-dark-mode :where(p,small,.settings-card>p,.settings-head p,.pref-row small){color:#9cb1c8!important}
  html.wayne-dark-mode :where(input,select,textarea){background:#10283e!important;border-color:#31506c!important;color:#eef7ff!important;box-shadow:none!important}
  html.wayne-dark-mode :where(.ghost-btn,.market-icon-btn,.market-menu-btn,.wayne-global-back){background:#10283e!important;border-color:#31506c!important;color:#bde8ff!important}
  html.wayne-dark-mode :where(.market-side-panel,.simple-drawer,.simple-modal-card){background:#0b1d2f!important;color:#eef7ff!important}
  html.wayne-dark-mode .market-side-links a{color:#a9bdd1!important}
  html.wayne-dark-mode .market-side-links a.active{background:#123b57!important;color:#78d3ff!important}
  html.wayne-dark-mode .market-side-account{background:#10283e!important;border-color:#31506c!important}
  html.wayne-dark-mode :where(.market-announcement,.market-search-wrap,.market-popular button,.market-product-list){background:#0d2135!important;border-color:#28445e!important;color:#bde8ff!important}
  html.wayne-dark-mode .settings-page{--set-bg:#071422;--set-card:#0d2135;--set-text:#eef7ff;--set-muted:#9cb1c8;--set-line:#28445e;--set-soft:#102f48}
  `;
  document.head.appendChild(style);
  const isDark=value=>value==="dark"||(value==="system"&&matchMedia("(prefers-color-scheme:dark)").matches);
  window.wayneApplyAppearance=value=>{
    const chosen=["light","dark","system"].includes(value)?value:"system";
    localStorage.setItem("wayneAppearance",chosen);
    document.documentElement.classList.toggle("wayne-dark-mode",isDark(chosen));
    document.body?.classList.toggle("settings-dark",isDark(chosen));
    return chosen;
  };
  window.wayneApplyAppearance(localStorage.getItem("wayneAppearance")||"system");
  matchMedia("(prefers-color-scheme:dark)").addEventListener?.("change",()=>{if((localStorage.getItem("wayneAppearance")||"system")==="system")window.wayneApplyAppearance("system")});
})();

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

// Owner-requested navigation: wallet shortcut on home, admin shortcut for admins, and Back on every inner page.
(function installWayneRequestedNavigation(){
  const style=document.createElement("style");
  style.textContent=`
    .wayne-global-back-wrap{width:min(1160px,calc(100% - 28px));margin:14px auto 0;position:relative;z-index:30}
    .wayne-global-back{display:inline-flex;align-items:center;gap:8px;min-height:42px;padding:9px 14px;border:1px solid #cfe0ec;border-radius:13px;background:rgba(255,255,255,.94);color:#0b78b6;text-decoration:none;font-weight:900;box-shadow:0 7px 18px rgba(23,70,108,.07);cursor:pointer}
    .wayne-global-back svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
    #marketWalletBtn,#marketAdminShortcut{text-decoration:none}
    #marketAdminShortcut{color:#0b78b6}
    @media(max-width:760px){.wayne-global-back-wrap{width:calc(100% - 24px);margin-top:8px}.wayne-global-back{width:36px;height:36px;min-height:36px;padding:0;justify-content:center;border-radius:11px}.wayne-global-back svg{width:16px;height:16px}.wayne-global-back span{display:none}}
  `;
  document.head.appendChild(style);

  const walletSvg='<svg class="market-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 14h2"/></svg>';
  const adminSvg='<svg class="market-svg" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4.5 6v5c0 5 3.2 8.4 7.5 10 4.3-1.6 7.5-5 7.5-10V6L12 3Z"/><path d="m9.5 12 1.6 1.6 3.6-4"/></svg>';
  const backSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5M11 18l-6-6 6-6"/></svg>';

  function storedUser(){try{return JSON.parse(localStorage.getItem("wayneUser")||"{}")||{}}catch{return {}}}

  function enhanceHomeHeader(){
    const themeButton=document.getElementById("marketThemeBtn");
    if(themeButton&&!themeButton.dataset.themeReady){
      themeButton.dataset.themeReady="true";
      themeButton.setAttribute("aria-label","Toggle appearance");
      themeButton.setAttribute("title","Toggle appearance");
      themeButton.onclick=()=>{const dark=document.documentElement.classList.contains("wayne-dark-mode");window.wayneApplyAppearance(dark?"light":"dark")};
    }
    const actions=document.querySelector(".market-header-actions");
    if(!actions)return;
    const user=storedUser();
    const isAdmin=Boolean(localStorage.getItem("wayneToken"))&&String(user.role||"").toLowerCase()==="admin";
    let admin=document.getElementById("marketAdminShortcut");
    if(isAdmin&&!admin){
      admin=document.createElement("a");
      admin.id="marketAdminShortcut";
      admin.className="market-icon-btn";
      admin.href="admin.html";
      admin.setAttribute("aria-label","Admin Panel");
      admin.setAttribute("title","Admin Panel");
      admin.innerHTML=adminSvg;
      actions.appendChild(admin);
    }
    if(admin)admin.hidden=!isAdmin;
  }

  const adminSectionHistory=[];
  let adminHistoryNavigating=false;
  function trackAdminSections(){
    if(!location.pathname.toLowerCase().endsWith("/admin.html"))return;
    const active=document.querySelector(".admin-menu [data-section].active")?.dataset.section||"overview";
    if(!adminSectionHistory.length)adminSectionHistory.push(active);
    document.querySelectorAll(".admin-menu [data-section]").forEach(button=>{
      if(button.dataset.backTracked)return;
      button.dataset.backTracked="true";
      button.addEventListener("click",()=>{
        if(adminHistoryNavigating)return;
        const section=button.dataset.section;
        if(section&&adminSectionHistory.at(-1)!==section)adminSectionHistory.push(section);
      });
    });
  }

  function addBackButton(){
    const path=location.pathname.toLowerCase();
    const isHome=path==="/"||path.endsWith("/index.html")||path==="";
    if(isHome)return;
    const walletBack=document.querySelector(".wayne-wallet-back");
    if(walletBack){
      const label=walletBack.querySelector("span");if(label)label.textContent="Back";
      walletBack.onclick=e=>{e.preventDefault();if(history.length>1)history.back();else location.href="index.html"};
      return;
    }
    if(document.querySelector(".wayne-global-back-wrap"))return;
    const wrap=document.createElement("div");wrap.className="wayne-global-back-wrap";
    const back=document.createElement("a");back.className="wayne-global-back";back.href="index.html";back.innerHTML=backSvg+'<span>Back</span>';
    if(path.endsWith("/admin.html")){
      back.href="admin.html";
      back.setAttribute("aria-label","Back to previous admin section");
      back.onclick=e=>{e.preventDefault();if(adminSectionHistory.length>1)adminSectionHistory.pop();const target=adminSectionHistory.at(-1)||"overview";adminHistoryNavigating=true;document.querySelector('.admin-menu [data-section="'+target+'"]')?.click();adminHistoryNavigating=false};
    }else{
      back.onclick=e=>{e.preventDefault();if(history.length>1)history.back();else location.href="index.html"};
    }
    wrap.appendChild(back);
    const header=document.querySelector(".market-page-header,.simple-header,.dash-header,.nav,.admin-top,.auth-card");
    if(header&&header.parentNode)header.parentNode.insertBefore(wrap,header.nextSibling);else document.body.insertBefore(wrap,document.body.firstChild);
  }

  function enforceCleanup(){
    document.querySelectorAll(".wayne-customer-dock,.wayne-account-backdrop").forEach(el=>el.remove());
    if(/\/dashboard\.html$/i.test(location.pathname))document.querySelectorAll(".dash-wrap > .platforms").forEach(el=>el.remove());
  }

  const start=()=>{
    enforceCleanup();enhanceHomeHeader();trackAdminSections();addBackButton();
    new MutationObserver(()=>{enforceCleanup();enhanceHomeHeader();}).observe(document.body,{childList:true,subtree:true});
  };
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",start);else start();
})();
