import {enqueueJob} from './queue.mjs';
import {mailTicket,readMailTicket} from '../lib/account-mail.mjs';
import {operationTicket,readOperationTicket} from '../lib/operations/store.mjs';
import {jobTicket,validJobTicket} from '../fanta/jobs.mjs';
import {footballRefreshTicket,validFootballRefreshTicket} from '../lib/api-football-refresh.mjs';
import {matchCacheTicket,validMatchCacheTicket} from '../lib/match-cache.mjs';
const entries={
 'account-mail-background':{header:'X-Quasi-Mail',read:t=>{const v=readMailTicket(t);return v?.jobId?{jobId:v.jobId}:null;},sign:v=>mailTicket(v.jobId)},
 'operational-worker-background':{header:'X-Quasi-Operation',read:readOperationTicket,sign:v=>operationTicket(v)},
 'fanta-worker-background':{header:'X-Quasi-Fanta',read:t=>{const kind=validJobTicket(t);return kind?{kind}:null;},sign:v=>jobTicket(v.kind)},
 'api-football-refresh-background':{header:'X-Quasi-Football',read:t=>validFootballRefreshTicket(t)?{operation:process.env.API_FOOTBALL_FULL_REFRESH}:null,sign:v=>footballRefreshTicket(v.operation)},
 'match-cache-background':{header:'X-Quasi-Cache',read:t=>validMatchCacheTicket(t)?{}:null,sign:()=>matchCacheTicket()},
};
export function decodeDispatch(url,init={},env=process.env){
 const target=new URL(url),origin=new URL(env.PUBLIC_ORIGIN);if(target.origin!==origin.origin||!target.pathname.startsWith('/.netlify/functions/'))return undefined;
 const name=target.pathname.split('/').at(-1),entry=entries[name];if(!entry||init.method!=='POST')throw Error('Unknown internal dispatch');
 const ticket=new Headers(init.headers).get(entry.header),payload=entry.read(ticket||'');if(!payload)throw Error('Invalid internal ticket');
 delete payload.at;return {name,payload,...(!['account-mail-background','operational-worker-background'].includes(name)?{dispatchBucket:Math.floor(Date.now()/60000)}:{})};
}
export function installInternalDispatch({env=process.env,enqueue=enqueueJob,network=globalThis.fetch}={}){
 const replacement=async(input,init={})=>{
  const url=typeof input==='string'||input instanceof URL?String(input):input.url,job=decodeDispatch(url,init,env);
  if(job){await enqueue(job);return new Response(null,{status:202});}
  if(env.SELFHOST_ALLOW_EXTERNAL!=='true')throw Object.assign(Error('External network disabled in migration preview'),{code:'EXTERNAL_DISABLED'});
  return network(input,init);
 };globalThis.fetch=replacement;return ()=>{globalThis.fetch=network;};
}
export async function executeJob({name,payload}){
 const entry=entries[name];if(!entry)throw Error('Unknown worker');
 const module=await import('../netlify/functions/'+name+'.mjs');
 await module.default(new Request(new URL('/.netlify/functions/'+name,process.env.PUBLIC_ORIGIN),{method:'POST',headers:{[entry.header]:entry.sign(payload)}}));
}
