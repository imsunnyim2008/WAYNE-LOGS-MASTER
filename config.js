// WAYNE LOGS shared customer configuration
window.WAYNE_API_URL = ["localhost", "127.0.0.1"].includes(location.hostname)
  ? "http://localhost:5000"
  : "https://wayne-logs-master-api.onrender.com";




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
  const isDark=value=>value==="dark";
  window.wayneApplyAppearance=value=>{
    const chosen=value==="dark"?"dark":"light";
    localStorage.setItem("wayneAppearance",chosen);
    document.documentElement.classList.toggle("wayne-dark-mode",isDark(chosen));
    document.body?.classList.toggle("settings-dark",isDark(chosen));
    return chosen;
  };
  const savedAppearance=localStorage.getItem("wayneAppearance");
  window.wayneApplyAppearance(savedAppearance==="dark"?"dark":"light");
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


/* WAYNE_GLOBAL_TOASTS_V1 */
(function wayneGlobalToastsInstaller(){
  if(window.__wayneToastsReady)return;
  window.__wayneToastsReady=true;

  const toastStyle=document.createElement("style");
  toastStyle.id="wayne-toast-styles";
  toastStyle.textContent=`
    .wayne-toast-stack{position:fixed;top:max(16px,env(safe-area-inset-top));right:16px;z-index:2147483000;width:min(390px,calc(100vw - 32px));display:grid;gap:10px;pointer-events:none}
    .wayne-toast{--toast:#087fca;position:relative;pointer-events:auto;display:grid;grid-template-columns:40px 1fr 30px;align-items:center;gap:10px;padding:13px 12px;border:1px solid color-mix(in srgb,var(--toast) 30%,white);border-radius:16px;background:rgba(255,255,255,.97);color:#102b4e;box-shadow:0 18px 45px rgba(15,45,83,.22);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);animation:wayneToastIn .28s cubic-bezier(.2,.8,.2,1);overflow:hidden}
    .wayne-toast:before{content:"";position:absolute;inset:0 auto 0 0;width:5px;background:var(--toast)}
    .wayne-toast.success{--toast:#16a34a}.wayne-toast.error{--toast:#dc2626}.wayne-toast.warning{--toast:#d97706}.wayne-toast.info{--toast:#087fca}
    .wayne-toast-icon{width:38px;height:38px;border-radius:12px;display:grid;place-items:center;background:color-mix(in srgb,var(--toast) 13%,white);color:var(--toast);font-size:20px;font-weight:950}
    .wayne-toast-copy{min-width:0}.wayne-toast-title{display:block;font-size:14px;font-weight:950;line-height:1.15;margin-bottom:3px}.wayne-toast-message{display:block;font-size:13px;line-height:1.35;color:#5d718a;overflow-wrap:anywhere}
    .wayne-toast-close{width:30px;height:30px;border:0;border-radius:9px;background:transparent;color:#6b7f96;font-size:20px;line-height:1;cursor:pointer}
    .wayne-toast.hiding{animation:wayneToastOut .22s ease forwards}
    @keyframes wayneToastIn{from{opacity:0;transform:translateY(-14px) scale(.96)}to{opacity:1;transform:none}}
    @keyframes wayneToastOut{to{opacity:0;transform:translateY(-10px) scale(.97)}}
    @media(max-width:600px){.wayne-toast-stack{left:12px;right:12px;top:max(12px,env(safe-area-inset-top));width:auto}.wayne-toast{border-radius:14px;padding:12px 10px;grid-template-columns:38px 1fr 28px}}
    html.wayne-dark-mode .wayne-toast{background:rgba(12,31,55,.97);color:#f3f8ff;border-color:color-mix(in srgb,var(--toast) 45%,#1d3b60)}
    html.wayne-dark-mode .wayne-toast-message{color:#b8c8db}
  `;
  document.head.appendChild(toastStyle);

  let stack;
  function ensureStack(){
    if(stack&&stack.isConnected)return stack;
    stack=document.createElement("div");
    stack.className="wayne-toast-stack";
    stack.setAttribute("aria-live","polite");
    stack.setAttribute("aria-atomic","false");
    document.body.appendChild(stack);
    return stack;
  }
  const titles={success:"Success",error:"Something went wrong",warning:"Please check",info:"Update"};
  const icons={success:"✓",error:"!",warning:"!",info:"i"};
  function cleanMessage(value,fallback){
    const clean=String(value||"").replace(/\s+/g," ").trim();
    return clean||fallback;
  }
  function toast(message,type="info",options={}){
    if(window.__wayneFeedbackV3)return null;
    const kind=["success","error","warning","info"].includes(type)?type:"info";
    if(typeof window.waynePopup==="function"){window.waynePopup(message,kind,options.title);return null}
    const host=ensureStack();
    const item=document.createElement("div");
    item.className=`wayne-toast ${kind}`;
    item.setAttribute("role",kind==="error"?"alert":"status");
    const icon=document.createElement("span");icon.className="wayne-toast-icon";icon.textContent=icons[kind];
    const copy=document.createElement("span");copy.className="wayne-toast-copy";
    const title=document.createElement("strong");title.className="wayne-toast-title";title.textContent=options.title||titles[kind];
    const body=document.createElement("span");body.className="wayne-toast-message";body.textContent=cleanMessage(message,kind==="success"?"Completed successfully.":"Please try again.");
    copy.append(title,body);
    const close=document.createElement("button");close.type="button";close.className="wayne-toast-close";close.setAttribute("aria-label","Close notification");close.textContent="×";
    item.append(icon,copy,close);host.appendChild(item);
    while(host.children.length>4)host.firstElementChild?.remove();
    let timer;
    const remove=()=>{clearTimeout(timer);if(!item.isConnected)return;item.classList.add("hiding");setTimeout(()=>item.remove(),230)};
    close.addEventListener("click",remove);
    timer=setTimeout(remove,Number(options.duration)||4600);
    return item;
  }
  window.wayneToast=toast;
  window.showToast=window.showToast||toast;

  function actionMessage(url,method,ok,data){
    const supplied=data&&typeof data==="object"&&(data.message||data.error);
    if(supplied)return cleanMessage(supplied,ok?"Completed successfully.":"The request failed.");
    const path=String(url||"").toLowerCase();
    if(!ok){
      if(path.includes("/auth/login"))return"Login failed. Check your details and try again.";
      if(path.includes("/auth/register"))return"Account creation failed. Please check your details.";
      if(path.includes("/wallet"))return"Wallet action failed. Please try again.";
      if(path.includes("/orders"))return"Order action failed. Please try again.";
      return"Your action could not be completed. Please try again.";
    }
    if(path.includes("/auth/login"))return"Login successful.";
    if(path.includes("/auth/register"))return"Account created successfully.";
    if(path.includes("/wallet")&&path.includes("/pay"))return"Wallet payment completed successfully.";
    if(path.includes("/wallet"))return"Wallet updated successfully.";
    if(path.includes("/orders"))return method==="DELETE"?"Order removed successfully.":"Order completed successfully.";
    if(path.includes("/products"))return method==="DELETE"?"Product deleted successfully.":"Product saved successfully.";
    if(path.includes("/support"))return"Support message sent successfully.";
    if(path.includes("/notification"))return"Notification sent successfully.";
    if(path.includes("/settings")||path.includes("/config"))return"Settings saved successfully.";
    if(path.includes("/profile")||path.includes("/auth/me"))return"Profile updated successfully.";
    return"Action completed successfully.";
  }

  const originalFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const method=String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")||"GET").toUpperCase();
    const url=typeof input==="string"?input:(input?.url||"");
    try{
      const response=await originalFetch(input,init);
      if(!["GET","HEAD","OPTIONS"].includes(method)){
        let data=null;
        try{data=await response.clone().json()}catch{}
        const type=response.ok?"success":"error";
        const message=actionMessage(url,method,response.ok,data);
        toast(message,type);
        if(response.ok){
          const pending={id:`${Date.now()}_${Math.random()}`,message,type,createdAt:Date.now()};
          try{sessionStorage.setItem("waynePendingToast",JSON.stringify(pending))}catch{}
          setTimeout(()=>{try{const saved=JSON.parse(sessionStorage.getItem("waynePendingToast")||"null");if(saved?.id===pending.id)sessionStorage.removeItem("waynePendingToast")}catch{}},7000);
        }
      }
      return response;
    }catch(error){
      if(!["GET","HEAD","OPTIONS"].includes(method))toast("Connection failed. Check your network and try again.","error");
      throw error;
    }
  };

  const nativeAlert=window.alert.bind(window);
  window.alert=function(message){
    toast(message,/fail|error|wrong|unable|invalid/i.test(String(message))?"error":"info",{duration:5600});
  };
  window.wayneNativeAlert=nativeAlert;

  function showPending(){
    try{
      const pending=JSON.parse(sessionStorage.getItem("waynePendingToast")||"null");
      sessionStorage.removeItem("waynePendingToast");
      if(pending&&Date.now()-Number(pending.createdAt||0)<15000)toast(pending.message,pending.type||"success");
    }catch{}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",showPending,{once:true});else showPending();
})();


/* WAYNE_ACTION_POPUP_V2 */
(()=>{
  const style=document.createElement("style");
  style.textContent=`
    .wayne-dialog-layer{background:rgba(43,45,86,.36)!important;padding:20px!important}
    .wayne-dialog{width:min(440px,calc(100vw - 28px))!important;border:1px solid rgba(119,105,255,.2)!important;border-radius:30px!important;background:#fff!important;color:#21213b!important;box-shadow:0 35px 90px rgba(38,42,83,.28)!important}
    .wayne-dialog-copy{padding:34px 28px 26px!important}
    .wayne-dialog-icon{width:76px!important;height:76px!important;margin:0 auto 24px!important;border-radius:50%!important;background:#f0edff!important;color:#796cff!important;border:2px solid #d9d2ff!important;box-shadow:inset 0 0 0 7px #faf9ff!important;font-size:31px!important}
    .wayne-dialog.success .wayne-dialog-icon{background:#eafaf1!important;color:#159552!important;border-color:#bdebd0!important;box-shadow:inset 0 0 0 7px #f8fffb!important}
    .wayne-dialog.error .wayne-dialog-icon{background:#fff0f2!important;color:#db3653!important;border-color:#ffcbd4!important;box-shadow:inset 0 0 0 7px #fffafb!important}
    .wayne-dialog h2{margin:0 0 12px!important;font-size:25px!important;line-height:1.15!important;color:#21213b!important}
    .wayne-dialog p{max-width:330px;margin:0 auto!important;color:#67677f!important;font-size:16px!important;line-height:1.55!important}
    .wayne-dialog-actions{display:grid!important;gap:10px!important;padding:0 28px 30px!important;border:0!important}
    .wayne-dialog-actions button{min-height:56px!important;border-radius:15px!important;font-size:16px!important;font-weight:900!important}
    .wayne-dialog-actions .primary{background:linear-gradient(135deg,#7768ff,#8b78ff)!important;box-shadow:0 12px 25px rgba(119,104,255,.25)!important}
    @media(max-width:600px){.wayne-dialog{border-radius:24px!important}.wayne-dialog-copy{padding:29px 22px 22px!important}.wayne-dialog-icon{width:68px!important;height:68px!important;margin-bottom:20px!important}.wayne-dialog h2{font-size:22px!important}.wayne-dialog p{font-size:15px!important}.wayne-dialog-actions{padding:0 20px 22px!important}.wayne-dialog-actions button{min-height:52px!important}}
  `;
  document.head.appendChild(style);
  if(typeof window.waynePopup==="function"){
    const popup=window.waynePopup;
    let lastSignature="",lastAt=0;
    window.waynePopup=(message,type="success",title)=>{
      const signature=[type,title||"",String(message||"")].join("|"),now=Date.now();
      if(signature===lastSignature&&now-lastAt<1600)return Promise.resolve(true);
      lastSignature=signature;lastAt=now;
      return popup(message,type,title);
    };
  }
})();
