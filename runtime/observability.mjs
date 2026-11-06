import fs from 'node:fs';import path from 'node:path';
export function redact(value){
 if(Array.isArray(value))return value.map(redact);
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,/(password|secret|token|authorization|api.?key|cookie|connection.?string)/i.test(key)?'[redatto]':redact(v)]));
 if(typeof value==='string'){let text=value;try{const parsed=JSON.parse(text);if(parsed&&typeof parsed==='object')return JSON.stringify(redact(parsed));}catch{}for(const[key,secret]of Object.entries(process.env))if(/(password|secret|token|api.?key|DATABASE_URL)/i.test(key)&&secret?.length>7)text=text.replaceAll(secret,'[redatto]');return text.replace(/postgres(?:ql)?:\/\/\S+/gi,'[connessione redatta]').slice(0,16000);}
 return value;
}
export function installRuntimeLogging(kind){
 const root=process.env.SELFHOST_INSTALL_ROOT;if(!root)return;
 const directory=path.join(root,'logs'),file=path.join(directory,kind+'-runtime.jsonl');fs.mkdirSync(directory,{recursive:true});
 for(const level of ['info','warn','error']){const original=console[level].bind(console);console[level]=(...args)=>{const safe=args.map(v=>redact(v));original(...safe);try{if(fs.existsSync(file)&&fs.statSync(file).size>5*1024*1024){for(let n=2;n>=1;n--)if(fs.existsSync(file+'.'+n))fs.renameSync(file+'.'+n,file+'.'+(n+1));fs.renameSync(file,file+'.1');}fs.appendFileSync(file,JSON.stringify({at:new Date().toISOString(),level,args:safe})+'\n');}catch{}};}
}
