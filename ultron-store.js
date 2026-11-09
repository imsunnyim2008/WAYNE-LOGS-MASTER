(()=>{
"use strict";
const api=window.WAYNE_API_URL;
if(!api||document.getElementById("ultron-store-root"))return;
const make=(tag,className,text)=>{const e=document.createElement(tag);if(className)e.className=className;if(text!==undefined)e.textContent=text;return e};
const root=make("aside");root.id="ultron-store-root";
const launch=make("button");launch.id="ultron-store-launch";launch.type="button";launch.setAttribute("aria-expanded","false");launch.setAttribute("aria-controls","ultron-store-panel");
launch.append(make("span","ultron-pulse","✦"),make("span","","ULTRON · Help"));
const panel=make("section");panel.id="ultron-store-panel";panel.hidden=true;panel.setAttribute("role","dialog");panel.setAttribute("aria-label","ULTRON store help");
const head=make("header");head.id="ultron-store-head";
const avatar=make("span","ultron-avatar","U");
const identity=make("div");identity.append(make("h2","","ULTRON"),make("p","","WAYNE LOGS · Store help mode"));
const close=make("button","","×");close.id="ultron-store-close";close.type="button";close.setAttribute("aria-label","Close chat");
head.append(avatar,identity,close);
const body=make("div");body.id="ultron-store-body";body.setAttribute("aria-live","polite");body.setAttribute("aria-relevant","additions");
const actions=make("div");actions.id="ultron-store-actions";
const form=make("form");form.id="ultron-store-form";
const input=make("input");input.id="ultron-store-input";input.type="text";input.maxLength=280;input.placeholder="Ask about orders, wallet, products…";input.required=true;input.setAttribute("aria-label","Message ULTRON Store Help");input.autocomplete="off";
const send=make("button","","Send");send.id="ultron-store-send";send.type="submit";
form.append(input,send);
panel.append(head,body,actions,form);root.append(panel,launch);
document.body.appendChild(root);
let pending=false;
const allowedLinks=new Set(["index.html#shop","wallet.html","orders.html","support.html","forgot-password.html"]);
function append(text,role,link){
 const node=make("div","ultron-msg "+role,String(text||""));
 if(link&&allowedLinks.has(link.href)){
  const a=make("a","",link.label||"Open page");a.href=link.href;node.appendChild(a);
 }
 body.appendChild(node);body.scrollTop=body.scrollHeight;
}
append("Hello! I'm ULTRON Store Help. I can explain WAYNE LOGS products, wallet funding, orders, and where to get support. I don't access private accounts or the owner's personal ULTRON tools.","bot");
for(const [label,question]of [["🛒 Products","Show available products"],["💳 Wallet","How do I fund my wallet?"],["📦 Orders","How do I find my order?"],["🎧 Support","I need human support"]]){
 const b=make("button","",label);b.type="button";b.addEventListener("click",()=>submitQuestion(question));actions.appendChild(b);
}
function toggle(open){panel.hidden=!open;launch.setAttribute("aria-expanded",open?"true":"false");if(open)input.focus();else launch.focus()}
launch.addEventListener("click",()=>toggle(panel.hidden));close.addEventListener("click",()=>toggle(false));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden)toggle(false)});
async function submitQuestion(question){
 const text=String(question||"").trim();if(!text||pending)return;
 if(text.length>280){append("Please keep your question under 280 characters.","bot");return}
 pending=true;input.disabled=true;send.disabled=true;actions.querySelectorAll("button").forEach(b=>b.disabled=true);
 append(text,"user");input.value="";
 try{
  const response=await fetch(api+"/api/ultron/ask",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:text}),signal:AbortSignal.timeout(12000)});
  const data=await response.json().catch(()=>({}));
  if(!response.ok)throw Error(data.message||"Store help is unavailable right now.");
  append(data.answer||"Please try asking another store question.","bot",data.link);
 }catch(e){append(e.name==="TimeoutError"?"That request timed out. Please try again.":e.message||"Connection problem. Please retry.","bot",{href:"support.html",label:"Contact support"});}
 finally{pending=false;input.disabled=false;send.disabled=false;actions.querySelectorAll("button").forEach(b=>b.disabled=false);input.focus()}
}
form.addEventListener("submit",e=>{e.preventDefault();submitQuestion(input.value)});
})();
