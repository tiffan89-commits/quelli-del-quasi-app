import {createHash} from 'node:crypto';
import {getStore} from '../runtime/local-blobs.mjs';
import {appEnv,isProduction} from './release-env.mjs';

// Private, server-side read-through cache. DB revisions are checked before use;
// transactions and authorization decisions are never served from this cache.
export function createReadCache({store,now=Date.now,maxBytes=32*1024*1024,maxEntries=32}={}){
 const memory=new Map(),pending=new Map();let bytes=0;
 const remember=(key,envelope)=>{const size=Buffer.byteLength(envelope.json);if(size>maxBytes)return;const old=memory.get(key);if(old)bytes-=old.size;memory.delete(key);memory.set(key,{...envelope,size});bytes+=size;while(bytes>maxBytes||memory.size>maxEntries){const first=memory.keys().next().value;bytes-=memory.get(first).size;memory.delete(first);}};
 return {async read(key,revision,load,{ttl=300000}={}){
  const digest=createHash('sha256').update(key).digest('hex'),valid=e=>e&&e.revision===String(revision)&&e.until>now();
  const hit=memory.get(digest);if(valid(hit)){memory.delete(digest);memory.set(digest,hit);return JSON.parse(hit.json);}
  const flight=digest+':'+revision;if(pending.has(flight))return JSON.parse(await pending.get(flight));
  const job=(async()=>{let shared;try{shared=await store?.get(digest,{type:'json'});}catch{/* A cache outage must not block the database. */}
   if(valid(shared)){remember(digest,shared);return shared.json;}
   const value=await load(),json=JSON.stringify(value),envelope={revision:String(revision),until:now()+ttl,json};
   remember(digest,envelope);try{if(Buffer.byteLength(json)<=maxBytes)await store?.setJSON(digest,envelope);}catch{/* Best effort; never cache failed reads. */}return json;
  })();pending.set(flight,job);try{return JSON.parse(await job);}finally{pending.delete(flight);}
 },clear(){memory.clear();bytes=0;},get size(){return memory.size;}};
}
let cache;
export function databaseReadCache(){return cache??=createReadCache({store:{get:(...a)=>privateStore().get(...a),setJSON:(...a)=>privateStore().setJSON(...a)}});}
function privateStore(){const scope=isProduction()?'production':appEnv()+'-'+createHash('sha256').update(process.env.DEPLOY_ID||process.env.BRANCH||'local').digest('hex').slice(0,12);return getStore({name:'quasi-private-db-cache-'+scope,consistency:'strong'});}
