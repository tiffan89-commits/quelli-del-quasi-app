import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
export const stateRoot=()=>path.resolve(process.env.SELFHOST_DATA_DIR||'.selfhost-data');
export const digest=v=>createHash('sha256').update(v).digest('hex');
export async function readJson(file){try{return JSON.parse(await fs.readFile(file,'utf8'));}catch(e){if(e.code==='ENOENT')return null;throw e;}}
export async function atomicJson(file,value){
 await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});
 const temp=file+'.'+randomUUID()+'.tmp';let handle;
 try{handle=await fs.open(temp,'wx',0o600);await handle.writeFile(JSON.stringify(value));await handle.sync();await handle.close();handle=null;await fs.rename(temp,file);}
 finally{await handle?.close();await fs.unlink(temp).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export async function withFileLock(file,fn){
 await fs.mkdir(path.dirname(file),{recursive:true,mode:0o700});const lock=file+'.lock';
 for(let i=0;i<200;i++){
  try{await fs.mkdir(lock);break;}catch(e){
   if(e.code!=='EEXIST')throw e;
   const stat=await fs.stat(lock).catch(()=>null);if(stat&&Date.now()-stat.mtimeMs>120000)await fs.rmdir(lock).catch(()=>{});
   if(i===199)throw Error('Local storage lock busy');await new Promise(r=>setTimeout(r,10));
  }
 }
 try{return await fn();}finally{await fs.rmdir(lock).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export function getStore({name,dataDir=stateRoot()}={}){
 if(!/^[a-zA-Z0-9_-]{1,150}$/.test(name||''))throw Error('Invalid local store name');
 const directory=path.join(path.resolve(dataDir),'blobs',name),file=key=>path.join(directory,digest(String(key))+'.json');
 const getWithMetadata=async(key,{type='text'}={})=>{const v=await readJson(file(key));if(!v)return null;return {data:type==='json'?v.value:JSON.stringify(v.value),etag:v.etag,metadata:v.metadata||{}};};
 return {
  async get(key,options){return (await getWithMetadata(key,options))?.data??null;},getWithMetadata,
  async setJSON(key,value,{onlyIfMatch,onlyIfNew=false,metadata={}}={}){return withFileLock(file(key),async()=>{
   const previous=await readJson(file(key));if(onlyIfNew&&previous||onlyIfMatch&&previous?.etag!==onlyIfMatch)return {modified:false};
   const etag=randomUUID();await atomicJson(file(key),{key:String(key),value,etag,metadata});return {modified:true,etag};
  });},
  async delete(key){return withFileLock(file(key),()=>fs.unlink(file(key)).catch(e=>{if(e.code!=='ENOENT')throw e;}));}
 };
}
