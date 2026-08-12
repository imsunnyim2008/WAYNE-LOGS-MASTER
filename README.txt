WAYNE LOGS MASTER — COMPLETE FRESH PROJECT
==========================================

This ZIP already contains the frontend AND backend. You do not need to create folders manually.

FRONTEND
--------
index.html       Storefront
login.html       Customer/admin login
register.html    Registration
orders.html      Customer orders + fulfillment
admin.html       Real admin dashboard
styles.css       Colorful responsive design
config.js        Frontend API URL configuration
app.js           Store/cart/checkout logic
admin.js         Admin backend integration

BACKEND
-------
server/server.js
server/models/User.js
server/models/Product.js
server/models/Order.js
server/controllers/*
server/routes/*
server/middleware/*
server/seed.js
server/package.json
server/.env.example
server/render.yaml

FEATURES
--------
- Social + VPN store only
- Facebook, Instagram, TikTok, YouTube, X, Snapchat, Telegram, WhatsApp,
  Discord, Reddit, LinkedIn, Pinterest, Threads, Twitch and VPN seed products
- MongoDB customer/admin accounts
- Secure bcrypt password hashing
- JWT authentication
- Admin-only product CRUD
- Admin users list
- Real MongoDB orders
- Admin order management
- Paystack initialization on backend
- Server-side Paystack verification
- Signed Paystack webhook
- Stock reduction after verified payment
- Instant fulfillment only after verified payment
- Responsive colorful UI

IMPORTANT
---------
The social-media section is for legitimate services/assets you own or are authorized to sell.
Do not use fulfillment fields for stolen passwords, cookies, session tokens, or compromised accounts.

LOCAL BACKEND SETUP
-------------------
1. Open server/.env (it is already created for you).
2. Replace the placeholder values with YOUR OWN values.
3. Never upload server/.env to GitHub; .gitignore already excludes it.
4. In the VS Code terminal:

   cd server
   npm install
   npm run seed
   npm start

The local frontend automatically uses http://localhost:5000.

ADMIN ACCOUNT
-------------
Set ADMIN_EMAIL in server/.env / Render Environment to your admin email.
Register on the website with that SAME email address. The backend will make that account admin.
Public registration cannot choose the admin role.

PRODUCTION DEPLOYMENT
---------------------
Frontend:
- Push the project root to your WAYNE-LOGS-MASTER GitHub repo.
- Deploy the repository root to Vercel.

Backend:
- Create a Render Web Service named exactly:
  wayne-logs-master-api
- Connect the same GitHub repo.
- Root Directory: server
- Build Command: npm install
- Start Command: npm start

Render environment variables:
MONGO_URI
JWT_SECRET
PAYSTACK_SECRET_KEY
FRONTEND_URL=https://wayne-logs-master.vercel.app
ADMIN_EMAIL=your admin email

If your Render service gets a different URL, open admin.html -> Settings and save that URL,
or change config.js once and push it.

PAYSTACK TEST MODE
------------------
Keep using a Test Secret Key until everything is verified.
Set the Paystack Test Webhook URL to:
https://wayne-logs-master-api.onrender.com/api/paystack/webhook

Never put PAYSTACK_SECRET_KEY in config.js, app.js, admin.js, Vercel frontend variables, or GitHub.
