/* WAYNE LOGS unified action feedback */
(()=>{
  if(window.__wayneFeedbackV3)return;
  window.__wayneFeedbackV3=true;

  const style=document.createElement("style");
  style.textContent=`
    .wayne-feedback-layer{position:fixed;inset:0;z-index:2147483640;display:grid;place-items:center;padding:20px;background:rgba(5,42,80,.38);backdrop-filter:blur(9px);-webkit-backdrop-filter:blur(9px)}
    .wayne-feedback-card{width:min(430px,calc(100vw - 30px));border:1px solid #ebe9ff;border-radius:30px;background:#fff;color:#232238;box-shadow:0 34px 90px rgba(42,44,88,.28);text-align:center;overflow:hidden;animation:wayneFeedbackIn .24s ease-out}
    .wayne-feedback-copy{padding:34px 28px 25px}.wayne-feedback-icon{display:grid;place-items:center;width:76px;height:76px;margin:0 auto 24px;border:2px solid #9edcf4;border-radius:50%;background:#e8f8ff;color:#087fc0;box-shadow:inset 0 0 0 7px #f8fdff;font-size:31px;font-weight:950}
    .wayne-feedback-card.success .wayne-feedback-icon{border-color:#bdebd0;background:#eafaf1;color:#159552;box-shadow:inset 0 0 0 7px #f8fffb}.wayne-feedback-card.error .wayne-feedback-icon{border-color:#ffcbd4;background:#fff0f2;color:#db3653;box-shadow:inset 0 0 0 7px #fffafb}
    .wayne-feedback-card h2{margin:0 0 12px;color:#232238;font-size:25px;line-height:1.16}.wayne-feedback-card p{max-width:335px;margin:0 auto;color:#67677f;font-size:16px;line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}
    .wayne-feedback-actions{display:grid;grid-template-columns:repeat(var(--feedback-actions,1),1fr);gap:10px;padding:0 28px 30px}.wayne-feedback-actions button{min-height:56px;border:0;border-radius:15px;background:#e7f6fd;color:#0879b8;font-size:16px;font-weight:900;cursor:pointer}.wayne-feedback-actions .primary{border:0;background:linear-gradient(135deg,#075fc7,#0ca9de);color:#fff;box-shadow:0 12px 25px rgba(8,119,190,.25)}
    @keyframes wayneFeedbackIn{from{opacity:0;transform:translateY(15px) scale(.96)}to{opacity:1;transform:none}}
    @media(max-width:600px){.wayne-feedback-card{border-radius:24px}.wayne-feedback-copy{padding:29px 22px 22px}.wayne-feedback-icon{width:68px;height:68px;margin-bottom:20px}.wayne-feedback-card h2{font-size:22px}.wayne-feedback-card p{font-size:15px}.wayne-feedback-actions{padding:0 20px 22px}.wayne-feedback-actions button{min-height:52px}}
  `;
  document.head.appendChild(style);

  let active=null,queue=[],popupVersion=0,lastSignature="",lastAt=0;
  const defaultTitle=type=>type==="success"?"Successful":type==="error"?"Action failed":type==="warning"?"Please check":"Notification";
  const defaultIcon=type=>type==="success"?"✓":type==="error"?"!":type==="warning"?"!":"●";
  function present(job){
    active=job;
    const layer=document.createElement("div");layer.className="wayne-feedback-layer";
    const card=document.createElement("section");card.className="wayne-feedback-card "+job.type;
    const copy=document.createElement("div");copy.className="wayne-feedback-copy";
    const icon=document.createElement("div");icon.className="wayne-feedback-icon";icon.textContent=defaultIcon(job.type);
    const title=document.createElement("h2");title.textContent=job.title||defaultTitle(job.type);
    const message=document.createElement("p");message.textContent=String(job.message||"Action completed.");
    copy.append(icon,title,message);
    const actions=document.createElement("div");actions.className="wayne-feedback-actions";actions.style.setProperty("--feedback-actions",job.confirm?"2":"1");
    const finish=value=>{layer.remove();active=null;job.resolve(value);const next=queue.shift();if(next)present(next)};
    if(job.confirm){const cancel=document.createElement("button");cancel.type="button";cancel.textContent=job.cancelText||"Cancel";cancel.onclick=()=>finish(false);actions.appendChild(cancel)}
    const okay=document.createElement("button");okay.type="button";okay.className="primary";okay.textContent=job.confirm?(job.confirmText||"Continue"):(job.buttonText||"Done");okay.onclick=()=>finish(true);actions.appendChild(okay);
    layer.onclick=e=>{if(e.target===layer&&!job.confirm)finish(true)};
    card.append(copy,actions);layer.appendChild(card);document.body.appendChild(layer);okay.focus();
  }
  function open(message,type="success",title,options={}){
    const kind=["success","error","warning","info"].includes(type)?type:"info";
    const signature=[kind,title||"",String(message||"")].join("|"),now=Date.now();
    if(signature===lastSignature&&now-lastAt<1800)return Promise.resolve(true);
    lastSignature=signature;lastAt=now;popupVersion++;
    return new Promise(resolve=>{const job={message,type:kind,title,resolve,...options};if(active)queue.push(job);else present(job)});
  }
  window.waynePopup=(message,type="success",title)=>open(message,type,title);
  window.wayneConfirm=(message,options={})=>open(message,"info",options.title||"Confirm action",{confirm:true,confirmText:options.confirmText||"Continue",cancelText:options.cancelText||"Recheck"});
  window.wayneReview=window.wayneConfirm;
  window.alert=message=>{open(message,/fail|error|wrong|unable|invalid/i.test(String(message))?"error":"info")};

  function responseMessage(url,method,ok,data){
    if(data&&typeof data==="object"&&(data.message||data.error))return String(data.message||data.error);
    const path=String(url||"").toLowerCase();
    if(!ok)return path.includes("/wallet")?"Wallet action failed. Please check the details and try again.":"The action could not be completed. Please try again.";
    if(path.includes("/auth/login"))return"Login successful.";
    if(path.includes("/auth/register"))return"Account created successfully.";
    if(path.includes("/wallet")&&path.includes("/pay"))return"Wallet payment completed successfully.";
    if(path.includes("/wallet"))return"Wallet updated successfully.";
    if(path.includes("/orders"))return"Order action completed successfully.";
    if(path.includes("/products"))return method==="DELETE"?"Product deleted successfully.":"Product saved successfully.";
    if(path.includes("/support"))return"Support action completed successfully.";
    if(path.includes("/notification"))return"Notification action completed successfully.";
    if(path.includes("/settings")||path.includes("/config"))return"Settings saved successfully.";
    if(path.includes("/profile")||path.includes("/auth/me"))return"Profile updated successfully.";
    return"Action completed successfully.";
  }

  const inheritedFetch=window.fetch.bind(window);
  window.fetch=async function(input,init){
    const method=String(init?.method||(typeof Request!=="undefined"&&input instanceof Request?input.method:"GET")||"GET").toUpperCase();
    const url=typeof input==="string"?input:(input?.url||"");
    const mutation=!["GET","HEAD","OPTIONS"].includes(method);
    const before=popupVersion;
    try{
      const response=await inheritedFetch(input,init);
      if(mutation){
        let data=null;try{data=await response.clone().json()}catch{}
        const message=responseMessage(url,method,response.ok,data),type=response.ok?"success":"error";
        if(response.ok){try{sessionStorage.setItem("wayneFeedbackPending",JSON.stringify({message,type,createdAt:Date.now()}))}catch{}}
        setTimeout(()=>{if(popupVersion===before)open(message,type)},0);
        setTimeout(()=>{try{sessionStorage.removeItem("wayneFeedbackPending")}catch{}},7000);
      }
      return response;
    }catch(error){
      if(mutation)setTimeout(()=>{if(popupVersion===before)open("Connection failed. Check your network and try again.","error")},0);
      throw error;
    }
  };

  function showPending(){
    try{const pending=JSON.parse(sessionStorage.getItem("wayneFeedbackPending")||"null");sessionStorage.removeItem("wayneFeedbackPending");if(pending&&Date.now()-Number(pending.createdAt||0)<15000)open(pending.message,pending.type||"success")}catch{}
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",showPending,{once:true});else showPending();
})();
