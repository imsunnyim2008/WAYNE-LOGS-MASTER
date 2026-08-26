const Product=require("../models/Product");
const InventoryItem=require("../models/InventoryItem");
const state={lastRunAt:null,lastRepairCount:0,lastError:""};

exports.reconcileInventoryStock=async()=>{
  const [products,counts]=await Promise.all([
    Product.find({inventoryManaged:true}).select("_id stock").lean(),
    InventoryItem.aggregate([{$match:{status:"available"}},{$group:{_id:"$product",count:{$sum:1}}}])
  ]);
  const available=new Map(counts.map(row=>[String(row._id),Number(row.count||0)]));
  const operations=[];
  for(const product of products){
    const actual=available.get(String(product._id))||0;
    if(Number(product.stock)!==actual)operations.push({updateOne:{filter:{_id:product._id,inventoryManaged:true},update:{$set:{stock:actual}}}});
  }
  if(operations.length)await Product.bulkWrite(operations,{ordered:false});
  state.lastRunAt=new Date();state.lastRepairCount=operations.length;state.lastError="";
  return{checked:products.length,repaired:operations.length};
};
exports.recordError=error=>{state.lastError=String(error?.message||error||"Unknown maintenance error").slice(0,300)};
exports.status=()=>({...state});

