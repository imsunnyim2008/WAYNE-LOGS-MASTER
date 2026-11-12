(()=>{
"use strict";
const api=window.WAYNE_API_URL;
if(!api||document.getElementById("ultron-store-root"))return;
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
const root=make("aside");root.id="ultron-store-root";
const launch=make("button");launch.id="ultron-store-launch";launch.type="button";launch.setAttribute("aria-expanded","false");launch.setAttribute("aria-controls","ultron-store-panel");
launch.append(make("span","ultron-pulse","✦"),make("span","","ULTRON · AI"));
const panel=make("section");panel.id="ultron-store-panel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","ULTRON AI store assistant");
const head=make("header");head.id="ultron-store-head";
const avatar=make("span","ultron-avatar","U");
const identity=make("div");identity.append(make("h2","","ULTRON"),make("p","","WAYNE LOGS · Secure assistant"));
const close=make("button","","×");close.id="ultron-store-close";close.type="button";close.setAttribute("aria-label","Close chat");
head.append(avatar,identity,close);
const modeBar=make("div");modeBar.id="ultron-store-modes";
const body=make("div");body.id="ultron-store-body";body.setAttribute("aria-live","polite");body.setAttribute("aria-relevant","additions");
const actions=make("div");actions.id="ultron-store-actions";
const form=make("form");form.id="ultron-store-form";
const input=make("input");input.id="ultron-store-input";input.type="text";input.maxLength=650;input.placeholder="Ask ULTRON a question…";input.required=true;input.setAttribute("aria-label","Message ULTRON");input.autocomplete="off";
const send=make("button","","Send");send.id="ultron-store-send";send.type="submit";
form.append(input,send);panel.append(head,modeBar,body,actions,form);root.append(panel,launch);document.body.appendChild(root);
const path=location.pathname.split("/").pop().toLowerCase();
let mode="customer",aiReady=false,pending=false,history=[];
const user=()=>{try{return JSON.parse(localStorage.getItem("wayneUser")||"null")}catch{return null}};
const jwt=()=>localStorage.getItem("wayneToken")||"";
const isAdmin=()=>user()?.role==="admin"&&Boolean(jwt());
const allowedLinks=new Set(["index.html#shop","wallet.html","dashboard.html","orders.html","support.html","forgot-password.html"]);
function append(text,role,link){
 const node=make("div","ultron-msg "+role,String(text||""));
 if(link&&allowedLinks.has(link.href)){
  const a=make("a","",link.label||"Open page");a.href=link.href;node.appendChild(a);
 }
 body.appendChild(node);body.scrollTop=body.scrollHeight;
}
function welcome(){body.replaceChildren();history=[];
 if(mode==="customer")append("Hi, I'm ULTRON. Ask me about products, prices, wallet funding, deliveries or support. Sign in to use live AI, or ask me basic store questions without an account.","bot");
 else if(mode==="admin")append("ULTRON Administrator Analysis is read-only. I can discuss sales totals, inventory, payment reviews, and operational priorities without exposing private customer details.","bot");
 else append("ULTRON Creator Conversation. This is a restricted, read-only bridge to ULTRON's AI, not access to your original private files, tools or long-term memory.","bot");
}
function modeButton(label,value){
 const b=make("button","",label);b.type="button";
 b.addEventListener("click",()=>{mode=value;for(const button of modeBar.querySelectorAll("button"))button.setAttribute("aria-pressed",button===b?"true":"false");setActions();welcome()});
 b.setAttribute("aria-pressed",value===mode?"true":"false");modeBar.appendChild(b);
}
modeButton("Store", "customer");
if(isAdmin()){modeButton("Admin insights","admin");modeButton("Creator","creator");if(/^admin/.test(path)){mode="admin";for(const b of modeBar.querySelectorAll("button"))b.setAttribute("aria-pressed",b.textContent==="Admin insights"?"true":"false");}}
function setActions(){
 actions.replaceChildren();
 const options=mode==="customer"?
  [["🛒 Products","Show available products"],["💳 My balance","What is my wallet balance?"],["📦 My orders","Where are my orders?"],["💳 My transactions","Show my recent wallet transactions"],["🎧 Support","How do I contact support?"]]:
  mode==="admin"?
  [["📈 Sales","Analyze our sales totals"],["📦 Stock","Which products need restocking?"],["💳 Payments","Review outstanding manual transfer risks"]]:
  [["🧠 Strategy","Suggest priorities for Wayne Logs"],["🛡 Security","What should I secure next?"]];
 for(const [label,question]of options){const b=make("button","",label);b.type="button";b.addEventListener("click",()=>submitQuestion(question));actions.appendChild(b)}
}
welcome();setActions();
function toggle(open){panel.hidden=!open;launch.setAttribute("aria-expanded",open?"true":"false");if(open)input.focus();else launch.focus()}
launch.addEventListener("click",()=>toggle(panel.hidden));close.addEventListener("click",()=>toggle(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden)toggle(false)});
const compactHistory=()=>history.slice(-6).map(v=>({role:v.role,content:v.content.slice(0,800)}));
async function sendFaq(text){
 const r=await fetch(api+"/api/ultron/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text.slice(0,280)}),signal:AbortSignal.timeout(12000)});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw Error(data.message||"Store help is unavailable.");
 return data;
}
async function submitQuestion(question){
 const text=String(question||"").trim();if(!text||pending)return;
 if(text.length>650){append("Keep your message under 650 characters.","bot");return}
 const askMode=mode;pending=true;input.disabled=true;send.disabled=true;actions.querySelectorAll("button").forEach(b=>b.disabled=true);
 const previous=compactHistory();append(text,"user");input.value="";
 try{
  let response;
  // First use a signed-in, read-only account lookup. This also works
  // when the AI worker is offline and never exposes private data to a model.
  if(jwt()&&askMode==="customer"){
    const r=await fetch(api+"/api/ultron/ai/customer-help",{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+jwt()},
      body:JSON.stringify({message:text}),signal:AbortSignal.timeout(12000)
    });
    const d=await r.json().catch(()=>({}));
    if(r.ok&&d.handled===true)response=d;
    else if([401,403].includes(r.status))throw Error(d.message||"Please sign in again for account help.");
    else if(!r.ok)throw Error(d.message||"Account lookup is temporarily unavailable.");
  }
  // AI never receives authentication secrets, private records, or arbitrary site actions.
  if(!response&&jwt()&&aiReady){
   const r=await fetch(api+"/api/ultron/ai/chat",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+jwt()},body:JSON.stringify({mode:askMode,message:text,history:previous}),signal:AbortSignal.timeout(42000)});
   const data=await r.json().catch(()=>({}));
   if(r.ok)response=data;
   else if(askMode!=="customer"||![503,504].includes(r.status))throw Error(data.message||"AI could not respond.");
  }
  if(!response){
   if(askMode!=="customer"){append(aiReady?"Sign in with the owner account and enable 2FA for creator mode.":"ULTRON AI is not connected yet. Check the service status before using privileged conversation.","bot");return}
   response=await sendFaq(text);
   if(!jwt())append("For conversational AI, please sign in first. Basic store help remains available to everyone.","bot");
  }
  append(response.answer||"Please try asking something about the store.","bot",response.link);
  history.push({role:"user",content:text},{role:"assistant",content:response.answer||""});history=history.slice(-6);
 }catch(e){append(e.name==="TimeoutError"?"ULTRON timed out. Try again.":e.message||"Connection problem.","bot",askMode==="customer"?{href:"support.html",label:"Contact Support"}:null);}
 finally{pending=false;input.disabled=false;send.disabled=false;actions.querySelectorAll("button").forEach(b=>b.disabled=false);input.focus()}
}
form.addEventListener("submit",e=>{e.preventDefault();submitQuestion(input.value)});
fetch(api+"/api/ultron/ai/status",{signal:AbortSignal.timeout(8000)}).then(r=>r.ok?r.json():{}).then(d=>{aiReady=d?.aiReady===true;identity.querySelector("p").textContent=aiReady?"WAYNE LOGS · AI connected":"WAYNE LOGS · Store help mode";}).catch(()=>{aiReady=false});
})();
