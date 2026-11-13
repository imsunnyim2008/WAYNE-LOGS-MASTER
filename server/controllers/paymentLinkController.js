"use strict";
// Public payment-link preview. This is one merchant-designated receiving
// account, NOT a unique customer account and NOT verified payment acceptance.
// Wallet credit remains behind the existing admin-verified deposit workflow.
const SiteSetting=require("../models/SiteSetting");
function bankFrom(settings,env=process.env){
  if(settings?.manualBankEnabled===false)return null;
  const name=String(settings?.bankName||env.WALLET_BANK_NAME||"").trim();
  const accountName=String(settings?.bankAccountName||env.WALLET_BANK_ACCOUNT_NAME||"").trim();
  const accountNumber=String(settings?.bankAccountNumber||env.WALLET_BANK_ACCOUNT_NUMBER||"").trim();
  if(!name||!accountName||!/^[0-9]{10}$/.test(accountNumber))return null;
  return {name,accountName,accountNumber};
}
exports.bankFrom=bankFrom;
exports.instructions=async(req,res)=>{
  res.set("Cache-Control","no-store");
  try{
    const settings=await SiteSetting.findOne({key:"main"})
      .select("manualBankEnabled bankName bankAccountName bankAccountNumber minimumTopupKobo maximumTopupKobo").lean();
    const bank=bankFrom(settings);
    if(!bank)return res.status(503).json({success:false,available:false,message:"Bank transfer receiving details are not currently configured. Please contact WAYNE LOGS support."});
    return res.json({success:true,available:true,mode:"manual_bank",bank,currency:"NGN",
      minimumTopupKobo:Number(settings?.minimumTopupKobo||10000),
      maximumTopupKobo:Number(settings?.maximumTopupKobo||500000000),
      automaticConfirmation:false,
      message:"Bank transfers require a verified customer deposit request and manual confirmation by WAYNE LOGS. Payment screenshots do not prove receipt."});
  }catch(error){
    console.error("Public bank payment instructions unavailable:",String(error?.name||"unknown"));
    return res.status(503).json({success:false,available:false,message:"Bank-transfer instructions are temporarily unavailable."});
  }
};
