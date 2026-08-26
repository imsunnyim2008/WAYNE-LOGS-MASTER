const fs=require("fs");
const path=require("path");
const vm=require("vm");

const serverRoot=path.resolve(__dirname,"..");
const projectRoot=path.resolve(serverRoot,"..");
const failures=[];

function collectJs(directory){
  const files=[];
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})){
    if(entry.name==="node_modules"||entry.name.startsWith("."))continue;
    const full=path.join(directory,entry.name);
    if(entry.isDirectory())files.push(...collectJs(full));
    else if(entry.isFile()&&entry.name.endsWith(".js"))files.push(full);
  }
  return files;
}

const files=[...collectJs(serverRoot),...['app.js','admin.js','wallet-admin.js','config.js'].map(name=>path.join(projectRoot,name)).filter(fs.existsSync)];
for(const file of files){
  try{new vm.Script(fs.readFileSync(file,"utf8"),{filename:file})}
  catch(error){failures.push(`${path.relative(projectRoot,file)}: ${error.message}`)}
}

for(const required of ["server.js","models/User.js","models/Order.js","models/WalletTransaction.js","services/maintenanceService.js"]){
  if(!fs.existsSync(path.join(serverRoot,required)))failures.push(`Missing required server file: ${required}`);
}

const envExample=fs.readFileSync(path.join(serverRoot,".env.example"),"utf8");
for(const key of ["MONGO_URI","JWT_SECRET","INVENTORY_ENCRYPTION_KEY","FRONTEND_URL","BACKEND_URL"]){
  if(!new RegExp(`^${key}=`,`m`).test(envExample))failures.push(`.env.example is missing ${key}`);
}

if(failures.length){console.error("Stability check failed:\n- "+failures.join("\n- "));process.exit(1)}
console.log(`Stability check passed: ${files.length} JavaScript files compiled successfully.`);

