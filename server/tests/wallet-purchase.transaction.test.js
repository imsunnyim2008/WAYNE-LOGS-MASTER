"use strict";
const assert=require("node:assert/strict");
const vm=require("node:vm");
const fs=require("node:fs");
const path=require("node:path");
const checks=require("../services/purchaseChecks");

function makeHarness(changes={}){
  const state={
    debits:0,stockChanges:0,ledgerEntries:0,
    order:{
      _id:"order-1",user:"customer-1",product:"product-1",status:"pending",
      paymentStatus:"pending",paymentReference:"",quantity:1,
      totalAmount:1250,currency:"NGN",unitPrice:1250,productName:"Test item",
      save:async function(){return this}
    },
    product:{
      _id:"product-1",price:1250,currency:"NGN",stock:5,
      status:"active",inventoryManaged:false,deliveryType:"instant",
      privateDelivery:"demo-only-test-content"
    }
  };
  Object.assign(state.order,changes.order||{});
  Object.assign(state.product,changes.product||{});
  const query=value=>({
    select:()=>query(value),
    session:async()=>value,
    lean:async()=>value,
    then:(resolve,reject)=>Promise.resolve(value).then(resolve,reject)
  });
  const mocks={
    mongoose:{
      isValidObjectId:()=>true,
      startSession:async()=>({withTransaction:async callback=>callback(),endSession:async()=>{}})
    },
    "../models/Order":{
      findOne:()=>query(state.order)
    },
    "../models/SiteSetting":{
      findOne:()=>query(null)
    },
    "../models/Product":{
      findById:()=>query(state.product),
      findOneAndUpdate:(filter,change)=>{
        if(state.product.stock<1||filter.price!==state.product.price||
          filter.currency!==state.product.currency||state.product.status!=="active")return query(null);
        state.stockChanges++;
        state.product.stock-=1;
        return query({...state.product});
      }
    },
    "../models/User":{
      findOneAndUpdate:()=>{state.debits++;return Promise.resolve({_id:"customer-1",walletBalanceKobo:200000})},
      find:()=>query([])
    },
    "../models/WalletTransaction":{
      create:async()=>{state.ledgerEntries++;return []}
    },
    "../models/InventoryItem":{
      findOneAndUpdate:()=>query(null)
    },
    "../services/inventoryCrypto":{decrypt:()=>""},
    "../services/emailService":{isConfigured:()=>false},
    "../services/notificationService":{create:async()=>{}},
    "../services/referralService":{rewardForPurchase:async()=>{}},
    "../services/purchaseChecks":checks,
    crypto:require("node:crypto"),
    bcryptjs:{}
  };
  const module={exports:{}};
  const sandbox={
    module,exports:module.exports,
    process:{env:{}},
    console,
    Buffer,
    fetch:()=>{throw Error("External payment must not run in wallet tests")},
    AbortSignal:global.AbortSignal,
    require:id=>{
      if(!Object.prototype.hasOwnProperty.call(mocks,id))throw Error("Unexpected require: "+id);
      return mocks[id];
    }
  };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,"../controllers/orderController.js"),"utf8"),sandbox);
  const res={statusCode:200,payload:null,status(code){this.statusCode=code;return this},
    json(value){this.payload=value;return this}};
  const req={params:{id:"order-1"},user:{_id:"customer-1"}};
  return {state,res,run:async()=>module.exports.payWithWallet(req,res)};
}
(async()=>{
  const normal=makeHarness();
  await normal.run();
  assert.equal(normal.res.statusCode,200);
  assert.equal(normal.res.payload?.order?.paymentStatus,"paid");
  assert.equal(normal.state.debits,1);
  assert.equal(normal.state.stockChanges,1);
  assert.equal(normal.state.ledgerEntries,1);
  const second=makeHarness({order:{paymentStatus:"paid",status:"completed",paymentReference:"BUY-order-1"}});
  await second.run();
  assert.equal(second.res.statusCode,200);
  assert.equal(second.state.debits,0,"Previously paid order must never debit wallet again.");
  assert.equal(second.state.ledgerEntries,0);

  for(const scenario of [
    {order:{status:"cancelled"}},
    {order:{status:"refunded",paymentStatus:"refunded"}},
    {order:{paymentReference:"PAYSTACK-EXTERNAL"}},
    {product:{price:1300}},
    {product:{currency:"USD"}},
    {product:{stock:0}},
    {product:{status:"inactive"}},
    {order:{currency:"USD"}}
  ]){
    const attempt=makeHarness(scenario);
    await attempt.run();
    assert.equal(attempt.res.statusCode,409,JSON.stringify(scenario));
    assert.equal(attempt.state.debits,0,JSON.stringify(scenario));
    assert.equal(attempt.state.ledgerEntries,0,JSON.stringify(scenario));
    assert.equal(attempt.state.stockChanges,0,JSON.stringify(scenario));
  }
  console.log("Mocked wallet transaction safety and paid-replay tests passed.");
})().catch(error=>{console.error(error);process.exitCode=1});
