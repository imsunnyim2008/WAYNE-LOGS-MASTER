"use strict";
const assert=require("node:assert/strict");
const bridge=require("../services/ultronBridgeQueue");
assert.equal(bridge.status().connected,false,"No worker connected by default");
assert.equal(bridge.available(),String(process.env.ULTRON_BRIDGE_SECRET||"").length>=40);
const fake={get(k){return k==="authorization"?"Bearer invalid":"0"}};
assert.deepEqual(bridge.next(fake),{error:"unauthorized"});
console.log("ULTRON AI bridge safety tests passed.");
