import {isIP} from 'node:net';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {readJson,atomicJson,stateRoot,withFileLock} from './local-blobs.mjs';
export function publicIPv4(ip){
 if(isIP(ip)!==4)return false;const [a,b]=ip.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||a===169&&b===254||a===172&&b>=16&&b<=31||a===192&&b===168||a===100&&b>=64&&b<=127||a===198&&[18,19].includes(b));
}
const host=v=>String(v||'').toLowerCase().replace(/\.$/,'');
export async function syncDns({env=process.env,fetcher=fetch,dryRun=true,stateFile=path.join(stateRoot(),'ddns-state.json')}={}){
 const zone=env.NETLIFY_DNS_ZONE_ID,token=env.NETLIFY_DDNS_TOKEN,configured=JSON.parse(env.NETLIFY_DDNS_RECORDS_JSON||'{}');
 if(!/^[a-zA-Z0-9_.-]+$/.test(zone||'')||!token||!Object.keys(configured).length)throw Error('DDNS_CONFIG_MISSING');
 const request=async(route,init={})=>{const r=await fetcher('https://api.netlify.com/api/v1'+route,{...init,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)});if(!r.ok)throw Error('DDNS_NETLIFY_'+r.status);return r.status===204?null:r.json();};
 const ips=await Promise.all(['https://api.ipify.org','https://checkip.amazonaws.com'].map(async url=>{const r=await fetcher(url,{redirect:'error',signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error('DDNS_IP_UNAVAILABLE');return (await r.text()).trim();}));
 if(ips[0]!==ips[1]||!publicIPv4(ips[0]))throw Error('DDNS_PUBLIC_IP_NOT_CONFIRMED');
 const ip=ips[0],zoneData=await request('/dns_zones/'+zone),records=await request('/dns_zones/'+zone+'/dns_records'),saved=await readJson(stateFile)||{zone,hosts:{}};
 if(saved.zone!==zone||!Array.isArray(records))throw Error('DDNS_ZONE_CONFLICT');let changed=0;
 for(const [rawHostname,initialId] of Object.entries(configured)){
  const hostname=host(rawHostname),zoneName=host(zoneData.name),prior=saved.hosts[hostname];
  if(!/^[a-z0-9.-]+$/.test(hostname)||hostname!==zoneName&&!hostname.endsWith('.'+zoneName))throw Error('DDNS_HOST_OUTSIDE_ZONE');
  const rows=records.filter(r=>host(r.hostname)===hostname),id=prior?.id||initialId,current=rows.find(r=>r.id===id);
  if(!current||current.type!=='A'||current.managed||rows.some(r=>r.type!=='A'&&['CNAME','NETLIFY','NETLIFYv6','ALIAS','AAAA'].includes(r.type)))throw Error('DDNS_RECORD_CONFLICT');
  if(prior?.pendingOld){const old=rows.find(r=>r.id===prior.pendingOld.id);if(old&&(old.type!=='A'||old.managed||old.value!==prior.pendingOld.value))throw Error('DDNS_PENDING_CONFLICT');if(old&&!dryRun)await request('/dns_zones/'+zone+'/dns_records/'+old.id,{method:'DELETE'});if(!dryRun){delete prior.pendingOld;await atomicJson(stateFile,saved);}}
  if(current.value===ip)continue;
  const extras=rows.filter(r=>r.type==='A'&&r.id!==current.id&&r.id!==prior?.pendingOld?.id);if(extras.some(r=>r.managed||r.value!==ip)||extras.length>1)throw Error('DDNS_EXTRA_A_RECORDS');
  changed++;if(dryRun)continue;
  const next=extras[0]||await request('/dns_zones/'+zone+'/dns_records',{method:'POST',body:JSON.stringify({type:'A',hostname,value:ip,ttl:300})});
  if(next.type!=='A'||host(next.hostname)!==hostname||next.value!==ip||!next.id)throw Error('DDNS_CREATE_UNCONFIRMED');
  saved.hosts[hostname]={id:next.id,pendingOld:{id:current.id,value:current.value}};await atomicJson(stateFile,saved);
  await request('/dns_zones/'+zone+'/dns_records/'+current.id,{method:'DELETE'});delete saved.hosts[hostname].pendingOld;await atomicJson(stateFile,saved);
 }
 return {dryRun,hosts:Object.keys(configured).length,changed};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const once=process.argv.includes('--once'),dryRun=process.argv.includes('--dry-run');
 if(!dryRun&&process.env.NETLIFY_DDNS_ENABLED!=='true')throw Error('DDNS_DISABLED');
 let stopping=false;process.once('SIGINT',()=>stopping=true);process.once('SIGTERM',()=>stopping=true);
 do{try{const result=await withFileLock(path.join(stateRoot(),'ddns-run'),()=>syncDns({dryRun}));console.log('QUASI_DDNS',JSON.stringify(result));}catch(e){console.error('QUASI_DDNS_FAILED',e.message?.startsWith('DDNS_')?e.message:e.code||e.name);if(once)process.exitCode=1;}
  if(once||dryRun)break;for(let i=0;i<300&&!stopping;i++)await new Promise(r=>setTimeout(r,1000));
 }while(!stopping);
}
