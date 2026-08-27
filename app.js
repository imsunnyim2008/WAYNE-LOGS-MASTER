const API_URL = window.WAYNE_API_URL || localStorage.getItem("wayneApiUrl") || "https://wayne-logs-master-api.onrender.com";
const $ = (id) => document.getElementById(id);

const accountLink=$("accountLink"),registerLink=$("registerLink"),adminLink=$("adminLink"),cartButton=$("cartButton"),cartDrawer=$("cartDrawer"),overlay=$("overlay"),closeCartBtn=$("closeCartBtn"),searchInput=$("searchInput"),productGrid=$("productGrid"),cartItems=$("cartItems"),cartTotal=$("cartTotal"),checkoutBtn=$("checkoutBtn"),productModal=$("productModal"),closeProductBtn=$("closeProductBtn"),modalArt=$("modalArt"),modalPlatform=$("modalPlatform"),modalTitle=$("modalTitle"),modalDesc=$("modalDesc"),modalPrice=$("modalPrice"),modalDelivery=$("modalDelivery"),modalStock=$("modalStock"),modalWhat=$("modalWhat"),modalAdd=$("modalAdd"),modalBuy=$("modalBuy"),checkoutModal=$("checkoutModal"),closeCheckoutBtn=$("closeCheckoutBtn"),checkoutProduct=$("checkoutProduct"),checkoutEmail=$("checkoutEmail"),checkoutTotal=$("checkoutTotal"),checkoutMessage=$("checkoutMessage"),payButton=$("payButton");
const marketMenuBtn=$("marketMenuBtn"),marketSidePanel=$("marketSidePanel"),marketSideOverlay=$("marketSideOverlay"),marketSideClose=$("marketSideClose"),sideWalletBalance=$("sideWalletBalance"),sideAccountBox=$("sideAccountBox");

let token=localStorage.getItem("wayneToken")||"",currentUser=null,products=[],activePlatform="all",currentProduct=null,checkoutSelection=null,checkoutRequestId="",cart=[];
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
  if(sideAccountBox)sideAccountBox.innerHTML='<strong>Customer Account</strong><a href="login.html">Login →</a><a href="register.html">Create Account →</a>';
}
function setNavLoggedIn(user){
  if(accountLink){accountLink.textContent="My Profile";accountLink.href="profile.html"}
  if(registerLink){registerLink.hidden=true;registerLink.setAttribute("hidden","")}
  if(adminLink)adminLink.hidden=user?.role!=="admin";
  if(sideAccountBox){sideAccountBox.innerHTML=`<strong>Wallet Balance</strong><div id="sideWalletBalance" style="font-size:25px;font-weight:950;margin:8px 0">₦0.00</div><a href="dashboard.html">Top Up →</a>${user?.role==="admin"?'<a href="admin.html" class="market-side-admin">Admin Panel →</a>':""}<a href="#" id="sideLogout" class="market-side-logout">Logout</a>`;sideAccountBox.querySelector("#sideLogout")?.addEventListener("click",e=>{e.preventDefault();clearSession();location.href="index.html"})}
}
async function validateSession(){
  if(!token){setNavLoggedOut();return}
  try{const response=await fetch(API_URL+"/api/auth/me",{headers:{Authorization:"Bearer "+token}}),data=await response.json();if(!response.ok||!data.user)throw new Error("Session expired");currentUser=data.user;localStorage.setItem("wayneUser",JSON.stringify(data.user));setNavLoggedIn(data.user);await loadWalletBalance()}catch{clearSession();setNavLoggedOut()}
}
async function loadWalletBalance(){
  if(!token)return;
  try{const r=await fetch(API_URL+"/api/wallet",{headers:{Authorization:"Bearer "+token}}),d=await r.json();if(!r.ok)return;const el=document.getElementById("sideWalletBalance");if(el)el.textContent=walletMoney(d.wallet?.balanceKobo)}catch{}
}

function openMenu(){marketSidePanel?.classList.add("open");marketSideOverlay?.classList.add("show");document.body.style.overflow="hidden"}
function closeMenu(){marketSidePanel?.classList.remove("open");marketSideOverlay?.classList.remove("show");document.body.style.overflow=""}
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
function stockClass(stock){if(Number(stock)<1)return"out";if(Number(stock)<=5)return"low";return""}
function renderProducts(){
  const list=products.filter(productMatches);
  if(!list.length){productGrid.innerHTML='<div class="market-empty"><strong>No products found.</strong><br><small>Try another category or search term.</small></div>';return}
  const groups=new Map();
  list.forEach(p=>{const name=groupName(p);if(!groups.has(name))groups.set(name,[]);groups.get(name).push(p)});
  productGrid.innerHTML=[...groups.entries()].map(([name,items])=>{
    const iconPlatform=groupIconPlatform(name,items);
    const rows=items.map(product=>{
      const stock=Number(product.stock||0),available=stock>0;
      return`<div class="market-product-row" data-product="${esc(product._id)}" role="button" tabindex="0">
        <div class="market-product-thumb">${iconMarkup(product.platform,product.icon||"★","")}</div>
        <div class="market-product-copy"><h3>${esc(product.name)}</h3><div class="market-stock ${stockClass(stock)}">${available?`${stock} pcs.`:"Out of stock"}</div></div>
        <div class="market-product-buy"><span class="market-product-price">${money(product.price)}</span><button class="market-buy-btn" type="button" data-buy="${esc(product._id)}" ${available?"":"disabled"}>${available?"Buy ›":"Sold"}</button></div>
      </div>`
    }).join("");
    return`<section class="market-category-section" data-group="${esc(name)}"><div class="market-category-heading"><div class="market-category-logo">${iconMarkup(iconPlatform,String(name).charAt(0),"")}</div><h2>${esc(name)}</h2><button class="market-view-all" type="button" data-view-group="${esc(name)}">View All →</button></div><div class="market-product-list">${rows}</div></section>`
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
  const product=getProduct(id);if(!product)return;currentProduct=product;
  modalArt.innerHTML=iconMarkup(product.platform,product.icon||"★");modalPlatform.textContent=product.platform||"Digital";modalTitle.textContent=product.name||"";modalDesc.textContent=product.description||"";modalPrice.textContent=money(product.price);modalDelivery.textContent=product.deliveryType==="instant"?"Instant":"Processed";modalStock.textContent=Number(product.stock)>0?`${product.stock} available`:"Out of stock";modalWhat.textContent=`${product.name}. ${product.description||""} Delivery: ${deliveryText(product)}.`;modalAdd.disabled=Number(product.stock)<1;modalBuy.disabled=Number(product.stock)<1;productModal.classList.add("show");productModal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden"
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
function openCheckoutFor(id){
  const product=getProduct(id);if(!product||Number(product.stock)<1)return;if(!token||!currentUser){requireLoginFor(id);return}
  checkoutSelection=product;checkoutRequestId=(globalThis.crypto?.randomUUID?.()||`buy_${Date.now()}_${Math.random().toString(36).slice(2)}`).replace(/[^A-Za-z0-9_-]/g,"_");setCartProduct(id,false);closeCart();closeProduct();checkoutProduct.innerHTML=`<div class="simple-product-icon">${iconMarkup(product.platform,product.icon||"★")}</div><div><strong>${esc(product.name)}</strong><small>${esc(product.platform||"Digital")} · ${esc(deliveryText(product))}</small></div>`;checkoutEmail.textContent=currentUser.email||"Your account";checkoutTotal.textContent=money(product.price);checkoutMessage.className="simple-message";checkoutMessage.textContent="";payButton.disabled=false;payButton.textContent="Pay with Wallet Balance";checkoutModal.classList.add("show");checkoutModal.setAttribute("aria-hidden","false");document.body.style.overflow="hidden"
}
function closeCheckout(){checkoutModal?.classList.remove("show");checkoutModal?.setAttribute("aria-hidden","true");document.body.style.overflow=""}
function showCheckoutMessage(text,type="error"){checkoutMessage.textContent=text;checkoutMessage.className=`simple-message show ${type}`}
async function pay(){
  if(!checkoutSelection)return;if(!token||!currentUser){requireLoginFor(checkoutSelection._id);return}
  payButton.disabled=true;payButton.textContent="Paying from wallet...";showCheckoutMessage("Securely checking your wallet balance...","info");
  try{
    let response=await fetch(API_URL+"/api/orders",{method:"POST",headers:{"Content-Type":"application/json",Authorization:"Bearer "+token},body:JSON.stringify({productId:checkoutSelection._id,requestId:checkoutRequestId})}),data=await response.json();if(!response.ok){if(response.status===401){clearSession();requireLoginFor(checkoutSelection._id);return}throw new Error(data.message||"Could not create your order.")}
    const order=data.order;localStorage.setItem("wayneLastOrderId",order._id);response=await fetch(`${API_URL}/api/orders/${order._id}/wallet/pay`,{method:"POST",headers:{Authorization:"Bearer "+token}});data=await response.json();if(!response.ok)throw new Error(data.message||"Wallet payment could not be completed.");clearCart();location.href=`orders.html?order=${encodeURIComponent(order._id)}&walletPurchase=success`
  }catch(error){showCheckoutMessage(`${error.message} Your order is saved and can be retried from My Orders.`,"error");payButton.disabled=false;payButton.textContent="Pay with Wallet Balance"}
}
closeProductBtn?.addEventListener("click",closeProduct);closeCheckoutBtn?.addEventListener("click",closeCheckout);modalAdd?.addEventListener("click",()=>{if(currentProduct){setCartProduct(currentProduct._id,true);closeProduct()}});modalBuy?.addEventListener("click",()=>{if(currentProduct)openCheckoutFor(currentProduct._id)});payButton?.addEventListener("click",pay);
productModal?.addEventListener("click",e=>{if(e.target===productModal)closeProduct()});checkoutModal?.addEventListener("click",e=>{if(e.target===checkoutModal)closeCheckout()});document.addEventListener("keydown",e=>{if(e.key!=="Escape")return;closeMenu();closeProduct();closeCheckout();closeCart()});

(async function init(){saveCart();await validateSession();await loadProducts();const params=new URLSearchParams(location.search),requested=params.get("buy")||localStorage.getItem("wayneBuyAfterLogin");if(requested&&currentUser&&getProduct(requested)){localStorage.removeItem("wayneBuyAfterLogin");history.replaceState({},"","index.html#shop");openCheckoutFor(requested)}})();
