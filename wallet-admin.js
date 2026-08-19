(function(){
  const walletTable=document.getElementById("adminWalletTable"),refresh=document.getElementById("refreshWallets"),userTable=document.getElementById("adminUserTable");
  const token=localStorage.getItem("wayneToken"),base=localStorage.getItem("wayneApiUrl")||window.WAYNE_API_URL||"http://localhost:5000";
  const esc=v=>{const d=document.createElement("div");d.textContent=v??"";return d.innerHTML};
  const moneyKobo=k=>"₦"+(Number(k||0)/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2});
  async function request(path){const r=await fetch(base+path,{headers:{Authorization:"Bearer "+token}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.message||"Request failed");return d}
  async function loadWallets(){
    try{const d=await request("/api/wallet/admin/transactions"),rows=d.transactions||[];walletTable.innerHTML=rows.length?rows.map(t=>`<tr><td>${new Date(t.createdAt).toLocaleString()}</td><td>${esc((t.user?.firstName||"")+" "+(t.user?.lastName||""))}<br><small>${esc(t.user?.email||"")}</small></td><td>${esc(t.type)}</td><td>${moneyKobo(t.amountKobo)}</td><td>${esc(t.status)}</td><td>${esc(t.reference)}</td></tr>`).join(""):'<tr><td colspan="6">No wallet transactions.</td></tr>'}catch(e){walletTable.innerHTML=`<tr><td colspan="6">${esc(e.message)}</td></tr>`}
  }
  async function loadBalances(){
    try{const d=await request("/api/auth/admin/users"),rows=d.users||[];userTable.innerHTML=rows.length?rows.map(u=>`<tr><td>${esc(u.firstName+" "+u.lastName)}</td><td>${esc(u.email)}</td><td>${esc(u.phone)}</td><td>${moneyKobo(u.walletBalanceKobo)}</td><td>${esc(u.role)}</td><td>${u.isActive?"Active":"Disabled"}</td></tr>`).join(""):'<tr><td colspan="6">No users.</td></tr>'}catch(e){}
  }
  refresh.addEventListener("click",loadWallets);setTimeout(()=>{loadWallets();loadBalances()},400);
})();
