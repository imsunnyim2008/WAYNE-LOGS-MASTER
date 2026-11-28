// Deliberately network-only: never cache authentication, wallet, orders or customer data.
self.addEventListener("install",()=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method==="GET"&&e.request.mode==="navigate")e.respondWith(fetch(e.request).catch(()=>new Response("WAYNE LOGS is offline. Reconnect to access your account.",{status:503,headers:{"Content-Type":"text/plain"}})))});