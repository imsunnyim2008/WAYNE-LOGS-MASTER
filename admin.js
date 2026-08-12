
const FALLBACK = window.DEFAULT_PRODUCTS || [];
function products(){try{return JSON.parse(localStorage.getItem("wayneFreshProducts")||"[]")}catch(e){return []}}
function saveProducts(v){localStorage.setItem("wayneFreshProducts",JSON.stringify(v))}
function orders(){try{return JSON.parse(localStorage.getItem("wayneFreshOrders")||"[]")}catch(e){return []}}
function money(n){return "₦"+Number(n||0).toLocaleString("en-NG")}
function esc(v){const d=document.createElement("div");d.textContent=v??"";return d.innerHTML}

let editingId=null;
const menuButtons=[...document.querySelectorAll("[data-admin-section]")];
menuButtons.forEach(b=>b.addEventListener("click",()=>{
  menuButtons.forEach(x=>x.classList.remove("active"));b.classList.add("active");
  document.querySelectorAll(".admin-section").forEach(s=>s.classList.remove("active"));
  document.getElementById(b.dataset.adminSection).classList.add("active");
  document.getElementById("adminTitle").textContent=b.textContent.trim();
  document.getElementById("adminSidebar").classList.remove("open");
  if(b.dataset.adminSection==="orders")renderOrders();
  if(b.dataset.adminSection==="products")renderProducts();
  if(b.dataset.adminSection==="overview")renderOverview();
}));

function renderOverview(){
  const p=products(), o=orders();
  const revenue=o.filter(x=>x.status==="Completed").reduce((s,x)=>s+Number(x.total||0),0);
  document.getElementById("statProducts").textContent=p.length;
  document.getElementById("statOrders").textContent=o.length;
  document.getElementById("statPending").textContent=o.filter(x=>x.status==="Pending").length;
  document.getElementById("statRevenue").textContent=money(revenue);
  const recent=o.slice(0,5);
  document.getElementById("recentOrders").innerHTML=recent.length?recent.map(x=>`
    <tr><td>${esc(x.id)}</td><td>${esc(x.customer)}</td><td>${money(x.total)}</td><td><span class="status-pill ${x.status==="Pending"?"pending":""}">${esc(x.status)}</span></td><td>${new Date(x.createdAt).toLocaleString()}</td></tr>`).join(""):`<tr><td colspan="5">No orders yet.</td></tr>`;
}
function renderProducts(){
  const p=products();
  document.getElementById("adminProductTable").innerHTML=p.length?p.map(x=>`
    <tr>
      <td><strong>${esc(x.name)}</strong><br><small>${esc(x.platform)}</small></td>
      <td>${esc(x.type)}</td><td>${money(x.price)}</td><td>${x.stock}</td>
      <td><button class="small-btn" onclick="editProduct('${x.id}')">Edit</button> <button class="danger-btn" onclick="deleteProduct('${x.id}')">Delete</button></td>
    </tr>`).join(""):`<tr><td colspan="5">No products.</td></tr>`;
}
function renderOrders(){
  const o=orders();
  document.getElementById("adminOrderTable").innerHTML=o.length?o.map(x=>`
    <tr>
      <td>${esc(x.id)}</td><td><strong>${esc(x.customer)}</strong><br><small>${esc(x.email)}</small></td>
      <td>${money(x.total)}</td><td>${new Date(x.createdAt).toLocaleString()}</td>
      <td>
        <select class="filter-select" onchange="setOrderStatus('${x.id}',this.value)">
          ${["Pending","Processing","Completed","Cancelled"].map(s=>`<option ${x.status===s?"selected":""}>${s}</option>`).join("")}
        </select>
      </td>
    </tr>`).join(""):`<tr><td colspan="5">No orders yet.</td></tr>`;
}
window.setOrderStatus=(id,status)=>{
  const o=orders();const item=o.find(x=>x.id===id);if(item){item.status=status;localStorage.setItem("wayneFreshOrders",JSON.stringify(o));renderOrders();renderOverview()}
}
window.deleteProduct=(id)=>{
  if(!confirm("Delete this product?"))return;
  saveProducts(products().filter(x=>x.id!==id));renderProducts();renderOverview();
}
window.editProduct=(id)=>{
  const p=products().find(x=>x.id===id);if(!p)return;
  editingId=id;
  ["name","platform","price","stock","icon","c1","c2","description"].forEach(k=>document.getElementById("p_"+k).value=p[k]??"");
  document.getElementById("p_type").value=p.type;
  document.getElementById("productFormTitle").textContent="Edit Product";
  document.getElementById("saveProduct").textContent="Save Changes";
  window.scrollTo({top:0,behavior:"smooth"});
}
document.getElementById("productForm").addEventListener("submit",e=>{
  e.preventDefault();
  const fd=new FormData(e.target);
  const data={
    id: editingId || "p"+Date.now(),
    name:fd.get("name").trim(),
    platform:fd.get("platform").trim(),
    type:fd.get("type"),
    price:Number(fd.get("price")),
    stock:Number(fd.get("stock")),
    icon:fd.get("icon").trim()||"★",
    c1:fd.get("c1")||"#7c5cff",
    c2:fd.get("c2")||"#ff5db1",
    description:fd.get("description").trim()
  };
  let p=products();
  if(editingId)p=p.map(x=>x.id===editingId?data:x);else p.unshift(data);
  saveProducts(p);editingId=null;e.target.reset();
  document.getElementById("p_c1").value="#7c5cff";document.getElementById("p_c2").value="#ff5db1";
  document.getElementById("productFormTitle").textContent="Add Product";document.getElementById("saveProduct").textContent="Add Product";
  renderProducts();renderOverview();
});
document.getElementById("resetStore").addEventListener("click",()=>{
  if(confirm("Reset products and orders created in this browser?")){
    localStorage.removeItem("wayneFreshProducts");localStorage.removeItem("wayneFreshOrders");
    location.reload();
  }
});
document.getElementById("adminMenuBtn").addEventListener("click",()=>document.getElementById("adminSidebar").classList.toggle("open"));
renderOverview();renderProducts();renderOrders();
