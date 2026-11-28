const API_URL = window.WAYNE_API_URL || localStorage.getItem("wayneApiUrl") || "https://wayne-logs-master-api.onrender.com";
const $ = (id) => document.getElementById(id);

const accountLink=$("accountLink"),registerLink=$("registerLink"),adminLink=$("adminLink"),cartButton=$("cartButton"),cartDrawer=$("cartDrawer"),overlay=$("overlay"),closeCartBtn=$("closeCartBtn"),searchInput=$("searchInput"),productGrid=$("productGrid"),cartItems=$("cartItems"),cartTotal=$("cartTotal"),checkoutBtn=$("checkoutBtn"),productModal=$("productModal"),closeProductBtn=$("closeProductBtn"),modalArt=$("modalArt"),modalPlatform=$("modalPlatform"),modalTitle=$("modalTitle"),modalDesc=$("modalDesc"),modalPrice=$("modalPrice"),modalDelivery=$("modalDelivery"),modalStock=$("modalStock"),modalWhat=$("modalWhat"),modalAdd=$("modalAdd"),modalBuy=$("modalBuy"),checkoutModal=$("checkoutModal"),closeCheckoutBtn=$("closeCheckoutBtn"),checkoutArt=$("checkoutArt"),checkoutProduct=$("checkoutProduct"),checkoutStock=$("checkoutStock"),checkoutDetails=$("checkoutDetails"),checkoutEmail=$("checkoutEmail"),checkoutTotal=$("checkoutTotal"),checkoutWalletBalance=$("checkoutWalletBalance"),checkoutRelated=$("checkoutRelated"),checkoutMessage=$("checkoutMessage"),payButton=$("payButton");
const marketMenuBtn=$("marketMenuBtn"),marketSidePanel=$("marketSidePanel"),marketSideOverlay=$("marketSideOverlay"),marketSideClose=$("marketSideClose"),sideWalletBalance=$("sideWalletBalance"),sideAccountBox=$("sideAccountBox");

let token=localStorage.getItem("wayneToken")||"",currentUser=null,products=[],activePlatform="all",currentProduct=null,checkoutSelection=null,checkoutRequestId="",walletBalanceKobo=0,cart=[];
try{const saved=JSON.parse(localStorage.getItem("wayneCart")||"[]");cart=Array.isArray(saved)?saved.slice(0,1):[]}catch{cart=[]}

function money(value){return"₦"+Number(value||0).toLocaleString("en-NG")}
function walletMoney(kobo){return"₦"+(Number(kobo||0)/100).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}
function esc(value){const el=document.createElement("div");el.textContent=value??"";return el.innerHTML}
function platformKey(value){const key=String(value||"").trim().toLowerCase();if(["twitter","twitter / x","x.com"].includes(key))return"x";if(["youtube accounts","youtube accounts & channels","youtube channels"].includes(key))return"youtube";return key}

const platformIcons={facebook:["facebook","1877F2","f"],instagram:["instagram","E4405F","◎"],tiktok:["tiktok","000000","♪"],"tiktok ads":["tiktok","000000","♪"],youtube:["youtube","FF0000","▶"],twitter:["x","000000","X"],x:["x","000000","X"],discord:["discord","5865F2","D"],telegram:["telegram","26A5E4","➤"],whatsapp:["whatsapp","25D366","W"],linkedin:["linkedin","0A66C2","in"],snapchat:["snapchat","FFFC00","S"],reddit:["reddit","FF4500","R"],pinterest:["pinterest","BD081C","P"],quora:["quora","B92B27","Q"],github:["github","181717","G"],spotify:["spotify","1ED760","S"],threads:["threads","000000","@"],twitch:["twitch","9146FF","T"],"private internet access":["privateinternetaccess","1E811F","PIA"],pia:["privateinternetaccess","1E811F","PIA"],expressvpn:["expressvpn","DA3940","E"],"express vpn":["expressvpn","DA3940","E"],"proton vpn":["protonvpn","6D4AFF","P"],protonvpn:["protonvpn","6D4AFF","P"],vpn:["protonvpn","6D4AFF","VPN"]};
function iconMarkup(platform,fallback="★",className="platform-logo-img"){
  const entry=platformIcons[platformKey(platform)];
  if(!entry)return`<span class="order-icon-fallback">${esc(fallback||String(platform||"?").charAt(0))}</span>`;
  return`<img class="${className}" src="https://cdn.simpleicons.org/${entry[0]}/${entry[1]}" alt="${esc(platform)}" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false"><span class="order-icon-fallback" hidden>${esc(entry[2])}</span>`;
}
function deliveryText(product){return product?.deliveryType==="instant"?"Instant after payment":"Processed after payment"}

function clearSession(){localStorage.removeItem("wayneToken");localStorage.removeItem("wayneUser");token="";currentUser=null}
function setNavLoggedOut(){
  if(accountLink){accountLink.textContent="Login";accountLink.href="login.html"}
  if(registerLink){registerLink.hidden=false;registerLink.removeAttribute("hidden")}
  if(adminLink)adminLink.hidden=true;
  if($("sideLogout"))$("sideLogout").hidden=true;if($("sideAdminLink"))$("sideAdminLink").hidden=true;
  if(sideAccountBox)sideAccountBox.innerHTML='<div class="market-side-guest"><strong>Customer Account</strong><a href="login.html">Sign In →</a><a href="register.html">Create Account →</a></div>';
}
function setNavLoggedIn(user){
  if(accountLink){accountLink.textContent="My Profile";accountLink.href="profile.html"}
  if(registerLink){registerLink.hidden=true;registerLink.setAttribute("hidden","")}
  if(adminLink)adminLink.hidden=user?.role!=="admin";
  if($("sideLogout"))$("sideLogout").hidden=false;if($("sideAdminLink"))$("sideAdminLink").hidden=user?.role!=="admin";
  if(sideAccountBox){sideAccountBox.innerHTML='<div class="market-side-wallet-icon"><svg class="market-svg" viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="14" rx="2"/><path d="M4 6V4h14v2m-2 5h5v5h-5a2.5 2.5 0 0 1 0-5Z"/></svg></div><div class="market-side-wallet-copy"><small>Wallet Balance</small><strong id="sideWalletBalance" aria-live="polite">—</strong></div><a class="market-side-topup" href="dashboard.html#topupForm">Top Up</a>';if(typeof user.walletBalanceKobo==="number")$("sideWalletBalance").textContent=walletMoney(user.walletBalanceKobo)}
}
async function validateSession(){
  if(!token){setNavLoggedOut();return}
  try{const response=await fetch(API_URL+"/api/auth/me",{headers:{Authorization:"Bearer "+token}}),data=await response.json();if(!response.ok||!data.user)throw new Error("Session expired");currentUser=data.user;localStorage.setItem("wayneUser",JSON.stringify(data.user));setNavLoggedIn(data.user);await loadWalletBalance()}catch{clearSession();setNavLoggedOut()}
}
async function loadWalletBalance(){
  if(!token)return;
  try{const r=await fetch(API_URL+"/api/wallet",{headers:{Authorization:"Bearer "+token}}),d=await r.json();if(!r.ok)return;walletBalanceKobo=Number(d.wallet?.balanceKobo||0);const el=document.getElementById("sideWalletBalance");if(el)el.textContent=walletMoney(walletBalanceKobo);if(checkoutWalletBalance)checkoutWalletBalance.textContent=walletMoney(walletBalanceKobo)}catch{}
}

let menuPreviousOverflow="";
function openMenu(){if(!marketSidePanel||marketSidePanel.classList.contains("open"))return;menuPreviousOverflow=document.body.style.overflow;marketSidePanel.inert=false;marketSidePanel.setAttribute("aria-hidden","false");marketSidePanel.classList.add("open");marketSideOverlay?.classList.add("show");marketMenuBtn?.setAttribute("aria-expanded","true");document.body.style.overflow="hidden";marketSideClose?.focus()}
function closeMenu(){if(!marketSidePanel?.classList.contains("open"))return;marketMenuBtn?.focus();marketSidePanel.classList.remove("open");marketSidePanel.inert=true;marketSidePanel.setAttribute("aria-hidden","true");marketSideOverlay?.classList.remove("show");marketMenuBtn?.setAttribute("aria-expanded","false");document.body.style.overflow=menuPreviousOverflow}
$("sideTheme")?.addEventListener("click",()=>{if(typeof window.wayneApplyAppearance==="function")window.wayneApplyAppearance(document.documentElement.classList.contains("wayne-dark-mode")?"light":"dark")});
$("sideLogout")?.addEventListener("click",()=>{clearSession();location.href="login.html"});
marketSidePanel?.addEventListener("keydown",e=>{if(e.key!=="Tab")return;const items=[...marketSidePanel.querySelectorAll("a[href],button:not([disabled])")].filter(el=>!el.hidden&&el.getClientRects().length);if(!items.length)return;const first=items[0],last=items[items.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}});
marketMenuBtn?.addEventListener("click",openMenu);marketSideClose?.addEventListener("click",closeMenu);marketSideOverlay?.addEventListener("click",closeMenu);document.querySelectorAll("[data-close-menu]").forEach(a=>a.addEventListener("click",closeMenu));

function saveCart(){cart=cart.slice(0,1);localStorage.setItem("wayneCart",JSON.stringify(cart));document.querySelectorAll("[data-cart-count]").forEach(el=>el.textContent=cart.length?1:0)}
function getProduct(id){return products.find(p=>String(p._id)===String(id))}
function groupName(product){if(String(product?.type||"").toLowerCase()==="vpn")return"VPN & Proxies";return String(product?.platform||"Other Products").trim()||"Other Products"}
function groupIconPlatform(name,items){if(name==="VPN & Proxies")return"vpn";return items?.[0]?.platform||name}
function productMatches(product){
  const query=(searchInput?.value||"").toLowerCase().trim();
  const text=`${product.name||""} ${product.platform||""} ${product.description||""}`.toLowerCase();
  if(query&&!text.includes(query))return false;
  if(activePlatform==="all")return true;
  if(activePlatform==="vpn")return String(product.type||"").toLowerCase()==="vpn";
  return platformKey(product.platform)===platformKey(activePlatform);
}
function stockClass(stock){if(Number(stock)<1)return"out";if(Number(stock)<10)return"low";return""}
function catalogueMoney(value){return "₦"+Number(value||0).toLocaleString("en-NG",{minimumFractionDigits:2,maximumFractionDigits:2})}
function catalogueIcon(platform,fallback){
 const key=platformKey(platform);
 if(key==="facebook")return '<span class="catalogue-brand-icon facebook" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false"><path fill="#fff" d="M28 48V30h6l1-7h-7v-5c0-3 1-5 5-5h4V7c-2-.4-4-.7-6-.7-7 0-12 4.5-12 12.2V23h-6v7h6v18z"/></svg></span>';
 if(key==="instagram")return '<span class="catalogue-brand-icon instagram" aria-hidden="true"><svg viewBox="0 0 48 48" focusable="false" fill="none" stroke="#fff" stroke-width="3.2"><rect x="8" y="8" width="32" height="32" rx="9"/><circle cx="24" cy="24" r="8"/><circle cx="34" cy="14" r="1.8" fill="#fff" stroke="none"/></svg></span>';
 return iconMarkup(platform,fallback,"");
}
function renderProducts(){
  const list=products.filter(productMatches);
  if(!list.length){productGrid.innerHTML='<div class="market-empty"><strong>No products found.</strong><br><small>Try another category or search term.</small></div>';return}
  const groups=new Map();
  list.forEach(p=>{const name=groupName(p);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(p)});
  productGrid.innerHTML=[...groups.entries()].map(([name,items])=>{
    const iconPlatform=groupIconPlatform(name,items);
    const rows=items.map(product=>{
      const stock=Number(product.stock||0),available=stock>0;
      return`<div class="market-product-row ${available?"":"is-sold"}" data-product="${esc(product._id)}" role="button" tabindex="0">
        <div class="market-product-thumb">${catalogueIcon(product.platform,product.icon||"★")}</div>
        <div class="market-product-copy"><h3>${esc(product.name)}</h3><div class="market-stock ${stockClass(stock)}">${available?`${stock} pcs.`:"Out of stock"}</div></div>
        <div class="market-product-buy"><span class="market-product-price">${catalogueMoney(product.price)}</span><button class="market-buy-btn" type="button" data-buy="${esc(product._id)}" ${available?"":"disabled"}>${available?"Buy ›":"Sold"}</button></div>
      </div>`
    }).join("");
    return`<section class="market-category-section" data-group="${esc(name)}"><div class="market-category-heading"><div class="market-category-logo">${catalogueIcon(iconPlatform,String(name).charAt(0))}</div><h2>${esc(name)}</h2><button class="market-view-all" type="button" data-view-group="${esc(name)}">View All →</button></div><div class="market-product-list">${rows}</div></section>`
  }).join("");
}
async function loadProducts(){
  productGrid.innerHTML='<div class="market-empty">Loading products...</div>';
  try{const response=await fetch(API_URL+"/api/products"),data=await response.json();if(!response.ok)throw new Error(data.message||"Could not load products.");products=Array.isArray(data.products)?data.products:[];renderProducts();renderCart()}catch(error){productGrid.innerHTML=`<div class="market-empty">Could not load the store.<br><small>${esc(error.message)}</small></div>`}
}
function choosePlatform(value){activePlatform=String(value||"all").toLowerCase()==="vpn"?"vpn":value||"all";document.querySelectorAll("[data-jump-platform]").forEach(btn=>btn.classList.toggle("selected",platformKey(btn.dataset.jumpPlatform)===platformKey(activePlatform)));renderProducts();document.getElementById("shop")?.scrollIntoView({behavior:"smooth",block:"start"})}
document.querySelectorAll("[data-jump-platform]").forEach(button=>button.addEventListener("click",()=>choosePlatform(button.dataset.jumpPlatform)));
searchInput?.addEventListener("input",()=>{activePlatform="all";document.querySelectorAll("[data-jump-platform]").forEach(b=>b.classList.remove("selected"));renderProducts()});
productGrid?.addEventListener("click",event=>{
  const viewGroup=event.target.closest("[data-view-group]");if(viewGroup){const group=viewGroup.dataset.viewGroup;if(group==="VPN & Proxies")choosePlatform("vpn");else choosePlatform(group);return}
  const buy=event.target.closest("[data-buy]");if(buy){event.stopPropagation();openCheckoutFor(buy.dataset.buy);return}
  const row=event.target.closest("[data-product]");if(row)openProduct(row.dataset.product)
});
productGrid?.addEventListener("keydown",event=>{if(!["Enter"," "].includes(event.key))return;const row=event.target.closest("[data-product]");if(!row)return;event.preventDefault();openProduct(row.dataset.product)});

function openProduct(id){
  const product=getProduct(id);if(!product)return;currentProduct=product;try{const recent=JSON.parse(sessionStorage.getItem('wayneRecentlyViewed')||'[]');sessionStorage.setItem('wayneRecentlyViewed',JSON.stringify([String(id),...recent.filter(x=>x!==String(id))].slice(0,20)))}catch{}
  modalArt.innerHTML=iconMarkup(product.platform,product.icon||"★");modalPlatform.textContent=product.platform||"Digital";modalTitle.textContent=product.name||"";modalDesc.textContent=product.description||"";modalPrice.textContent=money(product.price);modalDelivery.textContent=product.deliveryType==="instant"?"Instant":"Processed";let hub=document.getElementById("growthProductLink");if(!hub){hub=document.createElement("a");hub.id="growthProductLink";hub.textContent="♡ Save / restock alerts";hub.style.cssText="display:block;margin:8px 0;color:inherit;font-weight:700";modalStock.insertAdjacentElement("afterend",hub)}hub.href="shopping.html?product="+encodeURIComponent(id);modalStock.textContent=Number(product.stock)>0?`${product.stock} available`:"Out of stock";modalWhat.textContent=`${product.name}. ${product.description||""} Delivery: ${deliveryText(product)}.`;modalAdd.disabled=Number(product.stock)<1;modalBuy.disabled=Number(product.stock)<1;productModal.classList.add("show");productModal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden"
}
function closeProduct(){productModal?.classList.remove("show");productModal?.setAttribute("aria-hidden","true");document.body.style.overflow=""}
function setCartProduct(id,open=true){const product=getProduct(id);if(!product||Number(product.stock)<1)return;cart=[{id:product._id,qty:1}];saveCart();renderCart();if(open)openCart()}
function clearCart(){cart=[];saveCart();renderCart()}
function renderCart(){
  const item=cart[0],product=item?getProduct(item.id):null;
  if(!product){if(item)clearCart();cartItems.innerHTML='<div class="simple-empty">Your cart is empty.</div>';cartTotal.textContent=money(0);checkoutBtn.disabled=true;return}
  cartItems.innerHTML=`<div class="simple-cart-item"><div class="simple-product-icon">${iconMarkup(product.platform,product.icon||"★")}</div><div><strong>${esc(product.name)}</strong><small>${esc(product.platform||"Digital")} · ${esc(deliveryText(product))}</small></div><button class="simple-close" type="button" id="removeCartItem">×</button></div>`;cartTotal.textContent=money(product.price);checkoutBtn.disabled=false;$("removeCartItem")?.addEventListener("click",clearCart)
}
function openCart(){cartDrawer?.classList.add("open");overlay?.classList.add("show")}
function closeCart(){cartDrawer?.classList.remove("open");overlay?.classList.remove("show")}
cartButton?.addEventListener("click",openCart);closeCartBtn?.addEventListener("click",closeCart);overlay?.addEventListener("click",closeCart);checkoutBtn?.addEventListener("click",()=>{if(cart[0])openCheckoutFor(cart[0].id)});

function requireLoginFor(id){localStorage.setItem("wayneBuyAfterLogin",String(id));location.href="login.html"}
function renderCheckoutRelated(product){
  if(!checkoutRelated)return;
  const related=products.filter(item=>String(item._id)!==String(product._id)&&Number(item.stock)>0&&(platformKey(item.platform)===platformKey(product.platform)||String(item.type||"")===String(product.type||""))).slice(0,3);
  checkoutRelated.innerHTML=related.length?related.map(item=>`<button class="checkout-related-card" type="button" data-checkout-related="${esc(item._id)}"><span class="checkout-related-icon">${iconMarkup(item.platform,item.icon||"★","")}</span><span><strong>${esc(item.name)}</strong><small>${money(item.price)} · ${Number(item.stock)} available</small></span><b>›</b></button>`).join(""):'<p class="checkout-no-related">No similar products available right now.</p>';
}
let growthQuoteRequest=0;
async function getGrowthQuote(product,code){const r=await fetch(API_URL+"/api/growth/quote/"+encodeURIComponent(product._id),{method:"POST",cache:"no-store",headers:{Authorization:"Bearer "+token,"Content-Type":"application/json"},body:JSON.stringify({couponCode:code})});const d=await r.json().catch(()=>({}));if(!r.ok||!Number.isSafeInteger(d.quote?.amountKobo))throw Error(d.message||"Could not check the current price.");return d.quote}
function showGrowthQuote(q){checkoutTotal.textContent=money(q.amountKobo/100);$("growthQuoteNote").textContent=q.discount?q.discount+"% discount"+(q.endsAt?" · Ends "+new Date(q.endsAt).toLocaleString():""):"Current price confirmed."}
$("growthQuote")?.addEventListener("click",async()=>{const p=checkoutSelection,code=$("growthCoupon").value,seq=++growthQuoteRequest;if(!p||checkoutBusy)return;try{const q=await getGrowthQuote(p,code);if(seq===growthQuoteRequest&&checkoutSelection===p)showGrowthQuote(q)}catch(e){if(seq===growthQuoteRequest)$("growthQuoteNote").textContent=e.message}});
$("growthCoupon")?.addEventListener("input",()=>{growthQuoteRequest++;$("growthQuoteNote").textContent="Price will be verified before payment.";if(checkoutSelection)checkoutTotal.textContent=money(checkoutSelection.price)});
function openCheckoutFor(id){
  const product=getProduct(id);if(!product||Number(product.stock)<1)return;if(!token||!currentUser){requireLoginFor(id);return}
  checkoutSelection=product;growthQuoteRequest++;$("growthCoupon").value="";$("growthQuoteNote").textContent="";checkoutRequestId=(globalThis.crypto?.randomUUID?.()||`buy_${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g,"_");setCartProduct(id,false);closeCart();closeProduct();
  checkoutArt.innerHTML=`<div class="checkout-visual-logo">${iconMarkup(product.platform,product.icon||"★","")}</div>`;
  checkoutProduct.innerHTML=`<h2>${esc(product.name)}</h2><div class="checkout-platform">${iconMarkup(product.platform,product.icon||"★","")}<span>${esc(product.platform||"Digital")}</span></div>`;
  checkoutStock.textContent=`${Number(product.stock)} available`;checkoutDetails.textContent=product.description||`${product.name}. ${deliveryText(product)}.`;checkoutEmail.textContent=currentUser.email||"Your account";checkoutTotal.textContent=money(product.price);checkoutWalletBalance.textContent=walletMoney(walletBalanceKobo);renderCheckoutRelated(product);checkoutMessage.className="simple-message";checkoutMessage.textContent="";payButton.disabled=false;payButton.innerHTML="<span>⚡</span> Buy Now";checkoutModal.classList.add("show");checkoutModal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";$("growthQuote")?.click()
}
function closeCheckout(){checkoutModal?.classList.remove("show");checkoutModal?.setAttribute("aria-hidden","true");document.body.style.overflow=""}
function showCheckoutMessage(text,type="error"){checkoutMessage.textContent=text;checkoutMessage.className=`simple-message show ${type}`}
let checkoutBusy=false;
async function pay(){
  if(checkoutBusy||!checkoutSelection)return;
  if(!token||!currentUser){requireLoginFor(checkoutSelection._id);return}
  checkoutBusy=true;let orderId="";
  try{
    const selected=checkoutSelection,code=$("growthCoupon").value,quote=await getGrowthQuote(selected,code);if(checkoutSelection!==selected)throw Error("Checkout changed. Review the item again.");showGrowthQuote(quote);
    const reviewMessage=`Product: ${checkoutSelection.name}\nAmount: ${money(quote.amountKobo/100)}\nDelivery: ${deliveryText(checkoutSelection)}\nWallet balance: ${walletMoney(walletBalanceKobo)}\n\nPlease recheck these details before continuing. Completed wallet purchases cannot be reversed.`;
    const approved=typeof window.wayneConfirm==="function"
      ?await window.wayneConfirm(reviewMessage,{title:"Review Purchase",confirmText:"Continue",cancelText:"Recheck"})
      :window.confirm(reviewMessage);
    if(!approved)return;if(checkoutSelection!==selected||$("growthCoupon").value!==code)throw Error("Checkout changed. Review the item again.");
    payButton.disabled=true;payButton.textContent="Processing purchase...";
    showCheckoutMessage("Securely checking your wallet balance...","info");
    const created=await fetch(API_URL+"/api/orders",{
      method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},
      body:JSON.stringify({productId:checkoutSelection._id,requestId:checkoutRequestId,couponCode:code,expectedKobo:quote.amountKobo})
    });
    const details=await created.json().catch(()=>({}));
    if(!created.ok){
      if(created.status===401){clearSession();requireLoginFor(checkoutSelection._id);return}
      throw new Error(details.message||"Could not create your order.");
    }
    orderId=String(details.order?._id||"");
    if(!orderId)throw new Error("The server did not return an order.");if(Math.round(Number(details.order.totalAmount)*100)!==quote.amountKobo)throw Error("The price has changed. Review the order again before paying.");
    localStorage.setItem("wayneLastOrderId",orderId);
    const paid=await fetch(API_URL+"/api/orders/"+encodeURIComponent(orderId)+"/wallet/pay",{
      method:"POST",headers:{Authorization:"Bearer "+token}
    });
    const result=await paid.json().catch(()=>({}));
    if(!paid.ok)throw new Error(result.message||"Wallet payment could not be completed.");
    if(result.order?.paymentStatus!=="paid")throw new Error("Payment has not been confirmed. Check My Orders before trying again.");
    clearCart();
    location.href="orders.html?order="+encodeURIComponent(orderId)+"&walletPurchase=success";
  }catch(error){
    if(orderId){
      // A failed HTTP response does not prove the database transaction failed.
      // Look up the existing order before allowing the customer to retry.
      try{
        const r=await fetch(API_URL+"/api/orders/my",{cache:"no-store",headers:{Authorization:"Bearer "+token}});
        const data=await r.json().catch(()=>({}));
        const row=Array.isArray(data.orders)?data.orders.find(o=>String(o._id)===orderId):null;
        if(r.ok&&row?.paymentStatus==="paid"){clearCart();location.href="orders.html?order="+encodeURIComponent(orderId);return}
      }catch{}
    }
    const stale=/price (?:has )?changed|checkout changed|new price|refresh the store/i.test(String(error.message||""));
    if(stale){
      closeCheckout();
      await loadProducts();
      if(typeof window.waynePopup==="function")window.waynePopup(error.message,"error","Review New Price");
    }else{
      showCheckoutMessage(error.message+(orderId?" Check My Orders before retrying to avoid paying twice.":""),"error");
      if(typeof window.waynePopup==="function")window.waynePopup(error.message||"Purchase was not confirmed.","error","Purchase Not Confirmed");
    }
  }finally{
    checkoutBusy=false;
    if(payButton){payButton.disabled=false;payButton.innerHTML="<span>⚡</span> Buy Now"}
  }
}
closeProductBtn?.addEventListener("click",closeProduct);closeCheckoutBtn?.addEventListener("click",closeCheckout);modalAdd?.addEventListener("click",()=>{if(currentProduct){setCartProduct(currentProduct._id,true);closeProduct()}});modalBuy?.addEventListener("click",()=>{if(currentProduct)openCheckoutFor(currentProduct._id)});payButton?.addEventListener("click",pay);checkoutRelated?.addEventListener("click",event=>{const card=event.target.closest("[data-checkout-related]");if(card)openCheckoutFor(card.dataset.checkoutRelated)});
productModal?.addEventListener("click",e=>{if(e.target===productModal)closeProduct()});checkoutModal?.addEventListener("click",e=>{if(e.target===checkoutModal)closeCheckout()});document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;closeMenu();closeProduct();closeCheckout();closeCart()});

(async function init(){saveCart();await Promise.all([validateSession(),loadProducts()]);const params=new URLSearchParams(location.search),requested=params.get("buy")||localStorage.getItem("wayneBuyAfterLogin");if(requested&&currentUser&&getProduct(requested)){localStorage.removeItem("wayneBuyAfterLogin");history.replaceState({},"","index.html#shop");openCheckoutFor(requested)}})();

; (function setupHomeCarousel(){
 const root=document.getElementById("homeCarousel"),controls=document.getElementById("homeCarouselControls");if(!root||!controls)return;
 const inner=root.querySelector(".market-home-hero-inner"),title=root.querySelector("h1"),description=root.querySelector("p"),cta=root.querySelector(".market-shop-now"),art=root.querySelector(".market-hero-art"),originalArt=art.innerHTML;
 const fallback=[{"title":"Premium Digital Marketplace","description":"Browse digital services, subscriptions and VPN products. See the price, stock and product details before you buy.","buttonLabel":"Shop Now","productId":"","theme":"blue","enabled":true},{"title":"Discover our catalogue","description":"Explore available products and find the right digital service for you.","buttonLabel":"Explore Products","productId":"","theme":"navy","enabled":true},{"title":"Fast wallet checkout","description":"Add funds securely and shop with your WAYNE LOGS wallet.","buttonLabel":"Shop Now","productId":"","theme":"teal","enabled":true}];
 const reduce=matchMedia("(prefers-reduced-motion: reduce)");
 let slides=fallback,index=0,timer=null,paused=reduce.matches,hovered=false,focused=false,start=null;
 function display(next,animate=true){index=(next+slides.length)%slides.length;const slide=slides[index];title.textContent=slide.title;description.textContent=slide.description;cta.textContent=slide.buttonLabel;root.dataset.theme=["blue","navy","teal","purple"].includes(slide.theme)?slide.theme:"blue";const product=slide.productId&&getProduct(slide.productId);art.innerHTML=originalArt;if(product){const box=document.createElement("div");box.className="market-hero-promo-art";box.innerHTML=iconMarkup(product.platform,product.icon||"★","");art.replaceChildren(box)}cta.href="#shop";syncDots();if(animate&&!reduce.matches){inner.classList.remove("slide-changing");void inner.offsetWidth;inner.classList.add("slide-changing")}}
 function schedule(){clearInterval(timer);if(slides.length>1&&!paused&&!hovered&&!focused&&!document.hidden)timer=setInterval(()=>display(index+1),5000)}
 function go(i){display(i);schedule()}
 function syncDots(){controls.querySelectorAll("[data-slide]").forEach((b,i)=>{const active=i===index;b.setAttribute("aria-current",String(active));b.setAttribute("aria-label",active?(paused?"Resume automatic promotions":"Pause automatic promotions"):"Show promotion "+(i+1));b.title=active?(paused?"Resume rotation":"Pause rotation"):"Promotion "+(i+1)})}
 function build(){controls.replaceChildren();controls.hidden=slides.length<2;slides.forEach((s,i)=>{const b=document.createElement("button");b.type="button";b.dataset.slide=i;b.onclick=()=>{if(i===index){paused=!paused;syncDots();schedule()}else go(i)};controls.append(b)});display(0,false);schedule()}
 cta.addEventListener("click",e=>{const id=slides[index]?.productId;if(id&&getProduct(id)){e.preventDefault();openProduct(id)}});
 root.addEventListener("mouseenter",()=>{hovered=matchMedia("(hover: hover) and (pointer: fine)").matches;schedule()});root.addEventListener("mouseleave",()=>{hovered=false;schedule()});
 root.addEventListener("focusin",e=>{focused=e.target.matches(":focus-visible");schedule()});root.addEventListener("focusout",()=>{queueMicrotask(()=>{focused=root.contains(document.activeElement)&&document.activeElement.matches(":focus-visible");schedule()})});
 inner.addEventListener("touchstart",e=>{const t=e.changedTouches[0];start={x:t.clientX,y:t.clientY}},{passive:true});
 inner.addEventListener("touchend",e=>{if(!start)return;const t=e.changedTouches[0],dx=t.clientX-start.x,dy=t.clientY-start.y;start=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)go(index+(dx<0?1:-1))},{passive:true});
 inner.addEventListener("touchcancel",()=>{start=null});root.addEventListener("keydown",e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();go(index+(e.key==="ArrowRight"?1:-1))}});
 document.addEventListener("visibilitychange",schedule);window.addEventListener("pagehide",()=>clearInterval(timer));window.addEventListener("pageshow",schedule);
 build();
 fetch(API_URL+"/api/settings/banners",{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error("Banners unavailable");const data=await r.json();if(!Array.isArray(data.banners))return;slides=data.banners.filter(s=>s&&s.enabled===true&&typeof s.title==="string"&&typeof s.description==="string"&&typeof s.buttonLabel==="string").slice(0,8);if(!slides.length)slides=[fallback[0]];build()}).catch(()=>{});
})();
