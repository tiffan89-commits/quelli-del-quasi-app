// A shared in-flight lock survives DOM redraws; no automatic retry of writes.
const writes=new Map();
export function saveOnce(key,job){
 if(writes.has(key))return writes.get(key);
 let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});writes.set(key,promise);
 Promise.resolve().then(job).then(resolve,reject).finally(()=>{if(writes.get(key)===promise)writes.delete(key);});
 return promise;
}
export const savePending=key=>writes.has(key);

// Retrying an identical draft reuses its key, including after a timeout.
const slipAttempts=new Map();
export function identifySlipSave(input,{user='',now=Date.now(),makeId=()=>crypto.randomUUID()}={}){
 const signature=JSON.stringify([user,input.league,input.round,input.stake,input.baseSavedAt??null,Object.entries(input.picks||{}).sort(([a],[b])=>a.localeCompare(b))]);
 const old=slipAttempts.get(signature);if(old&&now-old.at<24*3600000)return {...input,requestId:old.id};
 const value={id:makeId(),at:now};slipAttempts.set(signature,value);while(slipAttempts.size>30)slipAttempts.delete(slipAttempts.keys().next().value);return {...input,requestId:value.id};
}
