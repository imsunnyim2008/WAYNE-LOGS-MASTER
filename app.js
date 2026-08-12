
const DEFAULT_PRODUCTS = [
  {id:"fb1",name:"Facebook Business Setup",platform:"Facebook",type:"social",price:25000,stock:12,icon:"f",c1:"#1877f2",c2:"#5aa5ff",description:"Professional Facebook business/page setup package for assets you own or are authorized to manage."},
  {id:"ig1",name:"Instagram Creator Pack",platform:"Instagram",type:"social",price:22000,stock:10,icon:"◎",c1:"#833ab4",c2:"#fd1d1d",description:"Instagram branding, profile optimization and creator setup package."},
  {id:"tt1",name:"TikTok Brand Pack",platform:"TikTok",type:"social",price:24000,stock:8,icon:"♪",c1:"#00f2ea",c2:"#ff0050",description:"TikTok profile branding and creator-ready setup for authorized accounts."},
  {id:"yt1",name:"YouTube Channel Kit",platform:"YouTube",type:"social",price:30000,stock:6,icon:"▶",c1:"#ff0000",c2:"#ff6a6a",description:"YouTube channel branding, banner direction and channel setup package."},
  {id:"x1",name:"X Profile Branding",platform:"X / Twitter",type:"social",price:18000,stock:15,icon:"𝕏",c1:"#2d2d2d",c2:"#6c6c6c",description:"Professional X profile setup, branding and launch checklist."},
  {id:"sc1",name:"Snapchat Creator Pack",platform:"Snapchat",type:"social",price:18000,stock:11,icon:"👻",c1:"#fffc00",c2:"#f5c400",description:"Snapchat creator profile setup and branding package."},
  {id:"tg1",name:"Telegram Channel Setup",platform:"Telegram",type:"social",price:20000,stock:20,icon:"➤",c1:"#229ed9",c2:"#7dd3fc",description:"Telegram channel/community setup with branding and structure."},
  {id:"wa1",name:"WhatsApp Business Setup",platform:"WhatsApp",type:"social",price:20000,stock:14,icon:"☏",c1:"#25d366",c2:"#65e6a0",description:"WhatsApp Business profile and catalog-ready setup package."},
  {id:"dc1",name:"Discord Community Setup",platform:"Discord",type:"social",price:28000,stock:7,icon:"☯",c1:"#5865f2",c2:"#8790ff",description:"Discord community setup, roles, channels and branding structure."},
  {id:"rd1",name:"Reddit Community Setup",platform:"Reddit",type:"social",price:18000,stock:9,icon:"●",c1:"#ff4500",c2:"#ff8b62",description:"Reddit community/subreddit setup and branding package."},
  {id:"li1",name:"LinkedIn Business Setup",platform:"LinkedIn",type:"social",price:26000,stock:9,icon:"in",c1:"#0a66c2",c2:"#5fa7e8",description:"LinkedIn company/profile presentation and business setup package."},
  {id:"pt1",name:"Pinterest Brand Setup",platform:"Pinterest",type:"social",price:19000,stock:10,icon:"P",c1:"#e60023",c2:"#ff6377",description:"Pinterest profile, board structure and visual branding setup."},
  {id:"th1",name:"Threads Creator Setup",platform:"Threads",type:"social",price:17000,stock:16,icon:"@",c1:"#1c1c1c",c2:"#585858",description:"Threads creator profile setup and launch package."},
  {id:"tw1",name:"Twitch Channel Kit",platform:"Twitch",type:"social",price:27000,stock:8,icon:"♜",c1:"#9146ff",c2:"#bc8cff",description:"Twitch channel presentation, panels and creator branding setup."},
  {id:"vpn1",name:"Secure VPN — 1 Month",platform:"VPN",type:"vpn",price:6500,stock:50,icon:"🛡",c1:"#00c6ff",c2:"#7c5cff",description:"One-month VPN subscription/license for privacy and secure browsing."},
  {id:"vpn6",name:"Secure VPN — 6 Months",platform:"VPN",type:"vpn",price:28000,stock:35,icon:"🔐",c1:"#00d4aa",c2:"#4ecbff",description:"Six-month VPN subscription/license with multi-device support."},
  {id:"vpn12",name:"Secure VPN — 12 Months",platform:"VPN",type:"vpn",price:48000,stock:25,icon:"🌐",c1:"#7c5cff",c2:"#ff5db1",description:"Twelve-month VPN subscription/license for long-term secure browsing."}
];

function getProducts(){
  const saved = localStorage.getItem("wayneFreshProducts");
  if(saved) try{return JSON.parse(saved)}catch(e){}
  localStorage.setItem("wayneFreshProducts",JSON.stringify(DEFAULT_PRODUCTS));
  return [...DEFAULT_PRODUCTS];
}
function getCart(){try{return JSON.parse(localStorage.getItem("wayneFreshCart")||"[]")}catch(e){return []}}
function setCart(cart){localStorage.setItem("wayneFreshCart",JSON.stringify(cart));updateCartCount()}
function money(n){return "₦"+Number(n||0).toLocaleString("en-NG")}
function escapeHtml(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML}

let products = getProducts();
let activeFilter = "all";
let currentProduct = null;

const productGrid = document.getElementById("productGrid");
const searchInput = document.getElementById("searchInput");
const filterSelect = document.getElementById("filterSelect");

function renderProducts(){
  const q=(searchInput?.value||"").toLowerCase().trim();
  const filter=filterSelect?.value||"all";
  const list=products.filter(p=>{
    const matchText=(p.name+" "+p.platform+" "+p.description).toLowerCase().includes(q);
    const matchFilter=filter==="all" || p.type===filter || p.platform.toLowerCase()===filter;
    return matchText && matchFilter;
  });
  productGrid.innerHTML = list.length ? list.map(p=>`
    <article class="product-card">
      <div class="product-art" style="--c1:${p.c1};--c2:${p.c2}">${escapeHtml(p.icon)}</div>
      <div class="product-body">
        <div class="tags"><span class="tag">${escapeHtml(p.platform)}</span><span class="tag">${p.type==="vpn"?"VPN":"Social"}</span></div>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description)}</p>
        <div class="product-bottom">
          <div><div class="price">${money(p.price)}</div><div class="stock">${p.stock>0?p.stock+" available":"Out of stock"}</div></div>
          <div class="product-actions">
            <button class="small-btn" onclick="openProduct('${p.id}')">View</button>
            <button class="small-btn buy" ${p.stock<1?"disabled":""} onclick="addToCart('${p.id}')">Add</button>
          </div>
        </div>
      </div>
    </article>`).join("") : `<div class="empty" style="grid-column:1/-1">No matching products found.</div>`;
}
function updateCartCount(){
  const count=getCart().reduce((a,b)=>a+b.qty,0);
  document.querySelectorAll("[data-cart-count]").forEach(el=>el.textContent=count);
}
function addToCart(id){
  const p=products.find(x=>x.id===id); if(!p||p.stock<1)return;
  const cart=getCart(); const item=cart.find(x=>x.id===id);
  if(item)item.qty=Math.min(item.qty+1,p.stock);else cart.push({id,qty:1});
  setCart(cart);renderCart();openCart();
}
function removeFromCart(id){setCart(getCart().filter(x=>x.id!==id));renderCart()}
function renderCart(){
  const cart=getCart(); const box=document.getElementById("cartItems");
  let total=0;
  box.innerHTML=cart.length?cart.map(i=>{
    const p=products.find(x=>x.id===i.id); if(!p)return "";
    total+=p.price*i.qty;
    return `<div class="cart-item"><div class="cart-art">${escapeHtml(p.icon)}</div><div class="meta"><strong>${escapeHtml(p.name)}</strong><small>${money(p.price)} × ${i.qty}</small></div><button class="icon-btn" onclick="removeFromCart('${p.id}')">×</button></div>`;
  }).join(""):`<div class="empty">Your cart is empty.</div>`;
  document.getElementById("cartTotal").textContent=money(total);
  document.getElementById("checkoutBtn").disabled=!cart.length;
}
function openCart(){document.getElementById("cartDrawer").classList.add("open");document.getElementById("overlay").classList.add("show")}
function closeCart(){document.getElementById("cartDrawer").classList.remove("open");document.getElementById("overlay").classList.remove("show")}
function openProduct(id){
  currentProduct=products.find(x=>x.id===id); if(!currentProduct)return;
  document.getElementById("modalArt").textContent=currentProduct.icon;
  document.getElementById("modalArt").style.background=`linear-gradient(135deg,${currentProduct.c1},${currentProduct.c2})`;
  document.getElementById("modalTitle").textContent=currentProduct.name;
  document.getElementById("modalPlatform").textContent=currentProduct.platform;
  document.getElementById("modalDesc").textContent=currentProduct.description;
  document.getElementById("modalPrice").textContent=money(currentProduct.price);
  document.getElementById("productModal").classList.add("show");
}
function closeProduct(){document.getElementById("productModal").classList.remove("show")}
function openCheckout(){
  const cart=getCart(); if(!cart.length)return;
  closeCart();
  document.getElementById("checkoutModal").classList.add("show");
  const total=cart.reduce((sum,i)=>{const p=products.find(x=>x.id===i.id);return sum+(p?p.price*i.qty:0)},0);
  document.getElementById("checkoutSummary").textContent=`Order total: ${money(total)}`;
}
function closeCheckout(){document.getElementById("checkoutModal").classList.remove("show")}
function submitOrder(e){
  e.preventDefault();
  const cart=getCart(); if(!cart.length)return;
  const fd=new FormData(e.target);
  const total=cart.reduce((sum,i)=>{const p=products.find(x=>x.id===i.id);return sum+(p?p.price*i.qty:0)},0);
  const orders=JSON.parse(localStorage.getItem("wayneFreshOrders")||"[]");
  const order={
    id:"WL-"+Date.now().toString().slice(-8),
    customer:fd.get("name"),
    email:fd.get("email"),
    phone:fd.get("phone"),
    items:cart,
    total,
    status:"Pending",
    createdAt:new Date().toISOString()
  };
  orders.unshift(order);localStorage.setItem("wayneFreshOrders",JSON.stringify(orders));
  setCart([]);renderCart();closeCheckout();
  document.getElementById("successModal").classList.add("show");
  document.getElementById("successOrderId").textContent=order.id;
  e.target.reset();
}
window.addToCart=addToCart;window.removeFromCart=removeFromCart;window.openProduct=openProduct;
window.openCart=openCart;window.closeCart=closeCart;window.closeProduct=closeProduct;window.openCheckout=openCheckout;window.closeCheckout=closeCheckout;
document.addEventListener("DOMContentLoaded",()=>{
  products=getProducts(); renderProducts(); renderCart(); updateCartCount();
  searchInput?.addEventListener("input",renderProducts);filterSelect?.addEventListener("change",renderProducts);
  document.getElementById("cartButton")?.addEventListener("click",openCart);
  document.getElementById("overlay")?.addEventListener("click",closeCart);
  document.getElementById("checkoutBtn")?.addEventListener("click",openCheckout);
  document.getElementById("checkoutForm")?.addEventListener("submit",submitOrder);
  document.getElementById("modalAdd")?.addEventListener("click",()=>{if(currentProduct){addToCart(currentProduct.id);closeProduct()}});
  document.getElementById("mobileNav")?.addEventListener("click",()=>document.querySelector(".nav-links")?.classList.toggle("mobile-open"));
});
