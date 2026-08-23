const API_URL =
  window.WAYNE_API_URL ||
  localStorage.getItem("wayneApiUrl") ||
  "https://wayne-logs-master-api.onrender.com";

const $ = (id) => document.getElementById(id);
const accountLink = $("accountLink");
const registerLink = $("registerLink");
const adminLink = $("adminLink");
const cartButton = $("cartButton");
const cartDrawer = $("cartDrawer");
const overlay = $("overlay");
const closeCartBtn = $("closeCartBtn");
const searchInput = $("searchInput");
const filterSelect = $("filterSelect");
const platformFilters = $("platformFilters");
const productGrid = $("productGrid");
const cartItems = $("cartItems");
const cartTotal = $("cartTotal");
const checkoutBtn = $("checkoutBtn");
const productModal = $("productModal");
const closeProductBtn = $("closeProductBtn");
const modalArt = $("modalArt");
const modalPlatform = $("modalPlatform");
const modalTitle = $("modalTitle");
const modalDesc = $("modalDesc");
const modalPrice = $("modalPrice");
const modalDelivery = $("modalDelivery");
const modalStock = $("modalStock");
const modalWhat = $("modalWhat");
const modalAdd = $("modalAdd");
const modalBuy = $("modalBuy");
const checkoutModal = $("checkoutModal");
const closeCheckoutBtn = $("closeCheckoutBtn");
const checkoutProduct = $("checkoutProduct");
const checkoutEmail = $("checkoutEmail");
const checkoutTotal = $("checkoutTotal");
const checkoutMessage = $("checkoutMessage");
const payButton = $("payButton");

let token = localStorage.getItem("wayneToken") || "";
let currentUser = null;
let products = [];
let activePlatform = "all";
let currentProduct = null;
let checkoutSelection = null;
let cart = [];

try {
  const saved = JSON.parse(localStorage.getItem("wayneCart") || "[]");
  cart = Array.isArray(saved) ? saved.slice(0, 1) : [];
} catch {
  cart = [];
}

function money(value) {
  return "₦" + Number(value || 0).toLocaleString("en-NG");
}

function esc(value) {
  const el = document.createElement("div");
  el.textContent = value ?? "";
  return el.innerHTML;
}

const platformIcons={facebook:["facebook","1877F2"],instagram:["instagram","E4405F"],tiktok:["tiktok","000000"],"tiktok ads":["tiktok","000000"],youtube:["youtube","FF0000"],twitter:["x","000000"],x:["x","000000"],discord:["discord","5865F2"],telegram:["telegram","26A5E4"],whatsapp:["whatsapp","25D366"],linkedin:["linkedin","0A66C2"],snapchat:["snapchat","FFFC00"],reddit:["reddit","FF4500"],pinterest:["pinterest","BD081C"],quora:["quora","B92B27"],github:["github","181717"],spotify:["spotify","1ED760"],grindr:["grindr","FEC016"],bumble:["bumble","FFC629"],badoo:["badoo","783BF9"],threads:["threads","000000"],twitch:["twitch","9146FF"],vpn:["protonvpn","6D4AFF"]};
function platformIcon(platform,fallback="★"){
  const key=String(platform||"").toLowerCase().trim(),entry=platformIcons[key];
  return entry?`<img class="platform-logo-img" src="https://cdn.simpleicons.org/${entry[0]}/${entry[1]}" alt="${esc(platform)}">`:`<span>${esc(fallback)}</span>`;
}

function deliveryText(product) {
  return product?.deliveryType === "instant"
    ? "Instant after verified payment"
    : "Processed after verified payment";
}

function clearSession() {
  localStorage.removeItem("wayneToken");
  localStorage.removeItem("wayneUser");
  token = "";
  currentUser = null;
}

function setNavLoggedOut() {
  accountLink.textContent = "Login";
  accountLink.href = "login.html";
  registerLink.hidden = false;
  adminLink.hidden = true;
  document.getElementById("logoutNav")?.remove();
}

function setNavLoggedIn(user) {
  accountLink.textContent = "My Profile";
  accountLink.href = "profile.html";
  registerLink.hidden = true;
  adminLink.hidden = user?.role !== "admin";

  let logout = document.getElementById("logoutNav");
  if (!logout) {
    logout = document.createElement("button");
    logout.id = "logoutNav";
    logout.className = "simple-btn secondary";
    logout.type = "button";
    logout.textContent = "Logout";
    logout.addEventListener("click", () => {
      clearSession();
      location.href = "index.html";
    });
    cartButton.before(logout);
  }
}

async function validateSession() {
  if (!token) {
    setNavLoggedOut();
    return;
  }

  try {
    const response = await fetch(API_URL + "/api/auth/me", {
      headers: { Authorization: "Bearer " + token }
    });
    const data = await response.json();
    if (!response.ok || !data.user) throw new Error("Session expired");
    currentUser = data.user;
    localStorage.setItem("wayneUser", JSON.stringify(data.user));
    setNavLoggedIn(data.user);
  } catch {
    clearSession();
    setNavLoggedOut();
  }
}

function saveCart() {
  cart = cart.slice(0, 1);
  localStorage.setItem("wayneCart", JSON.stringify(cart));
  document.querySelectorAll("[data-cart-count]").forEach((el) => {
    el.textContent = cart.length ? 1 : 0;
  });
}

function platformName(value) {
  return String(value || "").trim();
}

function platformKey(value) {
  const key = platformName(value).toLowerCase();
  if (["twitter", "twitter / x", "x.com"].includes(key)) return "x";
  if (["youtube accounts", "youtube accounts & channels", "youtube channels"].includes(key)) return "youtube";
  if (["dating", "dating app", "dating accounts"].includes(key)) return "dating apps";
  return key;
}

function updateCategoryCounts() {
  document.querySelectorAll("[data-category-count]").forEach((label) => {
    const key = platformKey(label.dataset.categoryCount);
    const matching = key === "all" ? products : products.filter((p) => platformKey(p.platform) === key);
    const available = matching.filter((p) => Number(p.stock) > 0);
    const units = available.reduce((sum, p) => sum + Number(p.stock || 0), 0);
    label.textContent = available.length ? `${available.length} product${available.length === 1 ? "" : "s"} · ${units} left` : "No stock";
    label.closest("button")?.classList.toggle("category-empty", !available.length);
  });
}

function buildPlatformFilters() {
  const known = [...new Set(products.map((p) => platformName(p.platform)).filter(Boolean))];
  const fixed = platformFilters.querySelectorAll("[data-platform='all'],[data-platform='social'],[data-platform='vpn']");
  const keep = [...fixed].map((el) => el.outerHTML).join("");
  const extra = known
    .filter((name) => name.toLowerCase() !== "vpn")
    .map((name) => `<button class="platform-pill" type="button" data-platform="${esc(name)}">${platformIcon(name,name.charAt(0))}${esc(name)}</button>`)
    .join("");
  platformFilters.innerHTML = keep + extra;
  markActiveFilter();
}

function markActiveFilter() {
  platformFilters.querySelectorAll(".platform-pill").forEach((btn) => {
    btn.classList.toggle(
      "active",
      String(btn.dataset.platform).toLowerCase() === String(activePlatform).toLowerCase()
    );
  });
}

async function loadProducts() {
  productGrid.innerHTML = '<div class="simple-empty">Loading products...</div>';
  try {
    const response = await fetch(API_URL + "/api/products");
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Could not load products.");
    products = Array.isArray(data.products) ? data.products : [];
    buildPlatformFilters();
    updateCategoryCounts();
    renderProducts();
    renderCart();
  } catch (error) {
    productGrid.innerHTML = `<div class="simple-empty">Could not load the store.<br><small>${esc(error.message)}</small></div>`;
  }
}

function productMatches(product) {
  const query = (searchInput.value || "").toLowerCase().trim();
  const type = filterSelect.value;
  const text = `${product.name || ""} ${product.platform || ""} ${product.description || ""}`.toLowerCase();

  const searchOk = !query || text.includes(query);
  const typeOk = type === "all" || product.type === type;

  let platformOk = true;
  if (activePlatform === "social") platformOk = product.type === "social";
  else if (activePlatform === "vpn") platformOk = product.type === "vpn";
  else if (activePlatform !== "all") {
    platformOk = platformKey(product.platform) === platformKey(activePlatform);
  }

  return searchOk && typeOk && platformOk;
}

function renderProducts() {
  const list = products.filter(productMatches);

  if (!list.length) {
    const selected = activePlatform === "all" ? "this category" : activePlatform;
    productGrid.innerHTML = `<div class="simple-empty"><strong>No products available in ${esc(selected)}.</strong><br><small>Please check another category or come back after new stock is added.</small></div>`;
    return;
  }

  productGrid.innerHTML = list.map((product) => `
    <article class="simple-product" data-product="${esc(product._id)}" tabindex="0" role="button">
      <div class="simple-product-top">
        <div class="simple-product-icon" style="--c1:${esc(product.color1 || "#7b61ff")};--c2:${esc(product.color2 || "#ff5cab")}">${platformIcon(product.platform,product.icon)}</div>
        <div class="simple-product-title">
          <small>${esc(product.platform || "Digital")}</small>
          <h3>${esc(product.name)}</h3>
          <span class="stock-badge ${Number(product.stock) > 0 ? "in-stock" : "out-stock"}">${Number(product.stock) > 0 ? esc(product.stock + " remaining") : "Out of stock"}</span>
        </div>
      </div>

      <div class="simple-product-body">
        <p>${esc(product.description || "Digital service.")}</p>

        <div class="simple-buy-info">
          <div><span>Delivery</span><strong>${esc(product.deliveryType === "instant" ? "Instant" : "Processed")}</strong></div>
          <div><span>Availability</span><strong>${Number(product.stock) > 0 ? esc(product.stock + " available") : "Out of stock"}</strong></div>
        </div>

        <div class="simple-price-row">
          <div class="simple-price">${money(product.price)}</div>
          <div class="simple-card-actions">
            <button class="simple-btn secondary" type="button" data-view="${esc(product._id)}">Details</button>
            <button class="simple-btn primary" type="button" data-buy="${esc(product._id)}" ${Number(product.stock) < 1 ? "disabled" : ""}>Buy Now</button>
          </div>
        </div>
      </div>
    </article>
  `).join("");
}

function getProduct(id) {
  return products.find((p) => String(p._id) === String(id));
}

function openProduct(id) {
  const product = getProduct(id);
  if (!product) return;
  currentProduct = product;

  modalArt.innerHTML = platformIcon(product.platform,product.icon);
  modalArt.style.setProperty("--c1", product.color1 || "#7b61ff");
  modalArt.style.setProperty("--c2", product.color2 || "#ff5cab");
  modalPlatform.textContent = product.platform || "Digital";
  modalTitle.textContent = product.name || "";
  modalDesc.textContent = product.description || "";
  modalPrice.textContent = money(product.price);
  modalDelivery.textContent = product.deliveryType === "instant" ? "Instant" : "Processed";
  modalStock.textContent = Number(product.stock) > 0 ? `${product.stock} available` : "Out of stock";
  modalWhat.textContent = `${product.name}. ${product.description || ""} Delivery: ${deliveryText(product)}.`;
  modalAdd.disabled = Number(product.stock) < 1;
  modalBuy.disabled = Number(product.stock) < 1;

  productModal.classList.add("show");
  productModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeProduct() {
  productModal.classList.remove("show");
  productModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function setCartProduct(id, open = true) {
  const product = getProduct(id);
  if (!product || Number(product.stock) < 1) return;
  cart = [{ id: product._id, qty: 1 }];
  saveCart();
  renderCart();
  if (open) openCart();
}

function clearCart() {
  cart = [];
  saveCart();
  renderCart();
}

function renderCart() {
  const item = cart[0];
  const product = item ? getProduct(item.id) : null;

  if (!product) {
    if (item) clearCart();
    cartItems.innerHTML = '<div class="simple-empty">Your cart is empty.</div>';
    cartTotal.textContent = money(0);
    checkoutBtn.disabled = true;
    return;
  }

  cartItems.innerHTML = `
    <div class="simple-cart-item">
      <div class="simple-product-icon" style="--c1:${esc(product.color1 || "#7b61ff")};--c2:${esc(product.color2 || "#ff5cab")}">${platformIcon(product.platform,product.icon)}</div>
      <div>
        <strong>${esc(product.name)}</strong>
        <small>${esc(product.platform)} · ${esc(deliveryText(product))}</small>
      </div>
      <button class="simple-close" type="button" id="removeCartItem">×</button>
    </div>
  `;
  cartTotal.textContent = money(product.price);
  checkoutBtn.disabled = false;
  $("removeCartItem").addEventListener("click", clearCart);
}

function openCart() {
  cartDrawer.classList.add("open");
  overlay.classList.add("show");
}

function closeCart() {
  cartDrawer.classList.remove("open");
  overlay.classList.remove("show");
}

function requireLoginFor(id) {
  localStorage.setItem("wayneBuyAfterLogin", String(id));
  location.href = "login.html";
}

function openCheckoutFor(id) {
  const product = getProduct(id);
  if (!product || Number(product.stock) < 1) return;

  if (!token || !currentUser) {
    requireLoginFor(id);
    return;
  }

  checkoutSelection = product;
  setCartProduct(id, false);
  closeCart();
  closeProduct();

  checkoutProduct.innerHTML = `
    <div class="simple-product-icon" style="--c1:${esc(product.color1 || "#7b61ff")};--c2:${esc(product.color2 || "#ff5cab")}">${platformIcon(product.platform,product.icon)}</div>
    <div>
      <strong>${esc(product.name)}</strong>
      <small>${esc(product.platform)} · ${esc(deliveryText(product))}</small>
    </div>
  `;
  checkoutEmail.textContent = currentUser.email || "Your account";
  checkoutTotal.textContent = money(product.price);
  checkoutMessage.className = "simple-message";
  checkoutMessage.textContent = "";
  payButton.disabled = false;
  payButton.textContent = "Pay with Wallet Balance";

  checkoutModal.classList.add("show");
  checkoutModal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeCheckout() {
  checkoutModal.classList.remove("show");
  checkoutModal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function showCheckoutMessage(text, type = "error") {
  checkoutMessage.textContent = text;
  checkoutMessage.className = `simple-message show ${type}`;
}

async function pay() {
  if (!checkoutSelection) return;
  if (!token || !currentUser) {
    requireLoginFor(checkoutSelection._id);
    return;
  }

  payButton.disabled = true;
  payButton.textContent = "Paying from wallet...";
  showCheckoutMessage("Securely checking and deducting your wallet balance...", "info");

  try {
    let response = await fetch(API_URL + "/api/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify({ productId: checkoutSelection._id })
    });
    let data = await response.json();

    if (!response.ok) {
      if (response.status === 401) {
        clearSession();
        requireLoginFor(checkoutSelection._id);
        return;
      }
      throw new Error(data.message || "Could not create your order.");
    }

    const order = data.order;
    localStorage.setItem("wayneLastOrderId", order._id);

    response = await fetch(`${API_URL}/api/orders/${order._id}/wallet/pay`, {method:"POST",headers:{Authorization:"Bearer "+token}});
    data = await response.json();
    if (!response.ok) throw new Error(data.message || "Wallet payment could not be completed.");
    clearCart();
    location.href = "orders.html?walletPurchase=success";
  } catch (error) {
    showCheckoutMessage(
      `${error.message} Your order is saved. You can also retry from My Orders.`,
      "error"
    );
    payButton.disabled = false;
    payButton.textContent = "Pay with Wallet Balance";
  }
}

productGrid.addEventListener("click", (event) => {
  const buy = event.target.closest("[data-buy]");
  if (buy) {
    event.stopPropagation();
    openCheckoutFor(buy.dataset.buy);
    return;
  }

  const view = event.target.closest("[data-view]");
  if (view) {
    event.stopPropagation();
    openProduct(view.dataset.view);
    return;
  }

  const card = event.target.closest("[data-product]");
  if (card) openProduct(card.dataset.product);
});

productGrid.addEventListener("keydown", (event) => {
  if (!["Enter", " "].includes(event.key)) return;
  const card = event.target.closest("[data-product]");
  if (!card) return;
  event.preventDefault();
  openProduct(card.dataset.product);
});

platformFilters.addEventListener("click", (event) => {
  const btn = event.target.closest("[data-platform]");
  if (!btn) return;
  activePlatform = btn.dataset.platform || "all";
  markActiveFilter();
  renderProducts();
  document.getElementById("shop").scrollIntoView({ behavior: "smooth", block: "start" });
});

document.querySelectorAll("[data-jump-platform]").forEach((button)=>button.addEventListener("click",()=>{
  activePlatform=button.dataset.jumpPlatform||"all";
  document.querySelectorAll("[data-jump-platform]").forEach((item)=>item.classList.toggle("selected",item===button));
  markActiveFilter();renderProducts();
  document.getElementById("shop").scrollIntoView({behavior:"smooth",block:"start"});
}));

searchInput.addEventListener("input", renderProducts);
filterSelect.addEventListener("change", renderProducts);
cartButton.addEventListener("click", openCart);
closeCartBtn.addEventListener("click", closeCart);
overlay.addEventListener("click", closeCart);
checkoutBtn.addEventListener("click", () => {
  if (cart[0]) openCheckoutFor(cart[0].id);
});
closeProductBtn.addEventListener("click", closeProduct);
closeCheckoutBtn.addEventListener("click", closeCheckout);
modalAdd.addEventListener("click", () => {
  if (currentProduct) {
    setCartProduct(currentProduct._id, true);
    closeProduct();
  }
});
modalBuy.addEventListener("click", () => {
  if (currentProduct) openCheckoutFor(currentProduct._id);
});
payButton.addEventListener("click", pay);

productModal.addEventListener("click", (event) => {
  if (event.target === productModal) closeProduct();
});
checkoutModal.addEventListener("click", (event) => {
  if (event.target === checkoutModal) closeCheckout();
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  closeProduct();
  closeCheckout();
  closeCart();
});

(async function init() {
  saveCart();
  await validateSession();
  await loadProducts();

  const params = new URLSearchParams(location.search);
  const requested = params.get("buy") || localStorage.getItem("wayneBuyAfterLogin");
  if (requested && currentUser && getProduct(requested)) {
    localStorage.removeItem("wayneBuyAfterLogin");
    history.replaceState({}, "", "index.html#shop");
    openCheckoutFor(requested);
  }
})();
