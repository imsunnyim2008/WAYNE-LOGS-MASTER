"use strict";
const {safeReceipt}=require("./growthRules");
function receiptPdf(order){
 const lines=safeReceipt(order).replace(/[^\x20-\x7e\n]/g,"-").split("\n").flatMap(line=>line.match(/.{1,70}/g)||[""]);
 const escape=s=>s.replace(/([\\()])/g,"\\$1");
 const content="0.03 0.23 0.40 rg 36 720 523 86 re f\nBT /F1 24 Tf 1 1 1 rg 56 770 Td (WAYNE LOGS) Tj /F1 12 Tf 0 -22 Td (Payment receipt) Tj ET\nBT /F1 12 Tf 0.08 0.15 0.23 rg 56 690 Td 18 TL\n"+lines.slice(1,30).map(l=>"("+escape(l)+") Tj T*").join("\n")+"\nET\n";
 const objects=["<< /Type /Catalog /Pages 2 0 R >>","<< /Type /Pages /Kids [3 0 R] /Count 1 >>","<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>","<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>","<< /Length "+Buffer.byteLength(content)+" >>\nstream\n"+content+"endstream"];
 let out="%PDF-1.4\n",offsets=[0];objects.forEach((obj,i)=>{offsets.push(Buffer.byteLength(out));out+=(i+1)+" 0 obj\n"+obj+"\nendobj\n"});const xref=Buffer.byteLength(out);out+="xref\n0 "+offsets.length+"\n0000000000 65535 f \n"+offsets.slice(1).map(n=>String(n).padStart(10,"0")+" 00000 n \n").join("")+"trailer\n<< /Size "+offsets.length+" /Root 1 0 R >>\nstartxref\n"+xref+"\n%%EOF\n";return Buffer.from(out);
}
module.exports={receiptPdf};
