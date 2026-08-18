WAYNE LOGS — SIMPLE CUSTOMER UPDATE
==================================

Replace these files in your existing WAYNE-LOGS-MASTER-FULL project:

ROOT:
- index.html
- app.js
- login.html
- register.html
- orders.html
- store-simple.css   (NEW FILE)

SERVER:
- server/controllers/orderController.js

WHAT CHANGED
------------
- Removed the confusing "major platforms" display cards.
- Platforms are now REAL filters for the store.
- Every product card opens details.
- Clear Details and Buy Now buttons.
- Customer sees product name, description, price, delivery type and availability before buying.
- Buy Now sends logged-out customers to Login/Create Account, then returns them to checkout.
- Checkout clearly shows product, account and total.
- Cart is intentionally one product at a time.
- My Orders has Pay Now for pending orders, so payment can be retried.
- Duplicate unpaid orders for the same product are reused.
- Better Paystack error message if PAYSTACK_SECRET_KEY is missing.
- Successful payments are never left showing "unpaid" just because stock changed at the final moment.

PAYSTACK REQUIRED
-----------------
Render Environment must contain:
PAYSTACK_SECRET_KEY=sk_test_...  (use test key first)
FRONTEND_URL=https://wayne-logs-master.vercel.app

Recommended Paystack webhook:
https://wayne-logs-master-api.onrender.com/api/paystack/webhook

DO NOT put the Paystack secret key in app.js, config.js, GitHub, or any frontend file.

AFTER REPLACING FILES
---------------------
From the project root:
git add -A
git commit -m "Simplify store and fix checkout flow"
git push

Vercel will update the frontend from GitHub.
Render should auto-deploy because server/controllers/orderController.js changed.

Then wait until BOTH Vercel and Render show successful deployment before testing.
