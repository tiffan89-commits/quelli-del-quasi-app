import {matchCacheTicket} from '../match-cache.mjs';
// Only explicit administrator requests or the single morning operation call this.
export async function dispatchRelated(kind,{env=process.env,fetcher=fetch}={}){
 const base=new URL(env.DEPLOY_PRIME_URL||env.URL),jobs=[];if(base.protocol!=='https:')throw Error('Invalid worker origin');

 if(kind==='morning')jobs.push(['match-cache-background','X-Quasi-Cache',matchCacheTicket(env)]);
 for(const[name,header,ticket]of jobs){const response=await fetcher(new URL('/.netlify/functions/'+name,base),{method:'POST',headers:{[header]:ticket},signal:AbortSignal.timeout(5000),redirect:'error'});if(!response.ok)throw Error('Related worker dispatch failed: '+name);}
 return jobs.length;
}
