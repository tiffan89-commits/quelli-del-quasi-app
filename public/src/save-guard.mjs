// A shared in-flight lock survives DOM redraws; no automatic retry of writes.
const writes=new Map();
export function saveOnce(key,job){
 if(writes.has(key))return writes.get(key);
 let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});writes.set(key,promise);
 Promise.resolve().then(job).then(resolve,reject).finally(()=>{if(writes.get(key)===promise)writes.delete(key);});
 return promise;
}
export const savePending=key=>writes.has(key);
