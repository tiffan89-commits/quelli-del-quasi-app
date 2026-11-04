// Display snapshots only. Authentication and all writes always use the server.
const pools=new Map(),prefix='qdq:display:v1:';
export function displayCache(scope,{storage=globalThis.localStorage}={}){
 if(pools.has(scope))return pools.get(scope);
 const key=prefix+scope,map=new Map();let generation=0;
 try{const saved=JSON.parse(storage?.getItem(key)||'null');if(Array.isArray(saved))for(const [k,v]of saved)if(v&&Number.isFinite(v.at)&&Date.now()-v.at<86400000)map.set(k,v);}catch{}
 const persist=()=>{try{while(map.size>64)map.delete(map.keys().next().value);let data=JSON.stringify([...map]);while(data.length>1500000&&map.size){map.delete(map.keys().next().value);data=JSON.stringify([...map]);}storage?.setItem(key,data);}catch{try{storage?.removeItem(key);}catch{}}};
 const cache={pending:new Map(),get generation(){return generation;},get(k,ttl){const v=map.get(k);return v&&Date.now()-v.at<ttl?structuredClone(v.data):null;},set(k,data,version=generation){if(version!==generation)return;map.set(k,{at:Date.now(),data:structuredClone(data)});persist();},clear(){generation++;map.clear();cache.pending.clear();try{storage?.removeItem(key);}catch{}}};pools.set(scope,cache);return cache;
}
export function clearDisplayCaches(userId,{storage=globalThis.localStorage}={}){
 for(const [scope,c]of pools)if(scope.endsWith(':'+userId))c.clear();
 try{for(let i=storage.length-1;i>=0;i--){const k=storage.key(i);if(k?.startsWith(prefix)&&k.endsWith(':'+userId))storage.removeItem(k);}}catch{}
}
export function linkedBarTarget(bars,fantaId,target={}){
 const bar=bars.find(b=>b.nativeFantaLink?.leagueId===fantaId);
 return bar?{...target,league:bar.id}:target;
}

globalThis.addEventListener?.('storage',event=>{if(event.key?.startsWith(prefix)&&event.newValue===null)pools.get(event.key.slice(prefix.length))?.clear();});
