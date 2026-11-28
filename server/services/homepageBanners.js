const defaults=[
 {title:"Premium Digital Marketplace",description:"Browse digital services, subscriptions and VPN products. See the price, stock and product details before you buy.",buttonLabel:"Shop Now",productId:"",theme:"blue",enabled:true},
 {title:"Discover our catalogue",description:"Explore available products and find the right digital service for you.",buttonLabel:"Explore Products",productId:"",theme:"navy",enabled:true},
 {title:"Fast wallet checkout",description:"Add funds securely and shop with your WAYNE LOGS wallet.",buttonLabel:"Shop Now",productId:"",theme:"teal",enabled:true}
];
const themes=["blue","navy","teal","purple"];
function validateBanners(rows){
 if(!Array.isArray(rows)||rows.length>8)throw new Error("Choose up to 8 banners.");
 return rows.map((row,i)=>{
  if(!row||typeof row!=="object"||Array.isArray(row))throw new Error("Invalid banner "+(i+1)+".");
  function field(key,max,required){const v=row[key];if(typeof v!=="string"||v.length>max||(required&&!v.trim()))throw new Error("Invalid "+key+" in banner "+(i+1)+".");return v.trim()}
  const productId=field("productId",24,false);
  if(productId&&!/^[a-f0-9]{24}$/i.test(productId))throw new Error("Invalid product in banner "+(i+1)+".");
  if(!themes.includes(row.theme)||typeof row.enabled!=="boolean")throw new Error("Invalid banner theme or visibility.");
  const schedule={};for(const key of ["startsAt","endsAt"]){if(row[key]){if(typeof row[key]!=="string"||!Number.isFinite(Date.parse(row[key])))throw Error("Invalid banner schedule.");schedule[key]=new Date(row[key]).toISOString()}}if(schedule.startsAt&&schedule.endsAt&&schedule.startsAt>=schedule.endsAt)throw Error("Banner end must follow its start.");
  return {...schedule,title:field("title",64,true),description:field("description",180,true),buttonLabel:field("buttonLabel",24,true),productId,theme:row.theme,enabled:row.enabled};
 });
}
function readBanners(value){return Array.isArray(value)?value.map(x=>({title:x.title,description:x.description,buttonLabel:x.buttonLabel,productId:x.productId||"",theme:x.theme,enabled:x.enabled===true,startsAt:x.startsAt||null,endsAt:x.endsAt||null})):defaults.map(x=>({...x}))}
module.exports={defaults,validateBanners,readBanners};
