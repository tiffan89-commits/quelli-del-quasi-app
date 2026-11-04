import {optimizePortrait,PORTRAIT_VERSION} from './image-optimize.mjs';
import {createHash,randomUUID} from 'node:crypto';
import {transaction} from './db.mjs';
import {normalizeTeam} from './calendar.mjs';
import {sqlPlayerStore} from './player-store.mjs';
import {recordExternal} from './platform-admin.mjs';
export const isPlaceholderPortrait=digest=>digest==='2ff7d52a628fce5d954c58480dde4e47396db4bb405b7b7d6a6567134bf86422';
const DAY=86400000,BASE='https://v3.football.api-sports.io/';
const validImage=url=>{try{const u=new URL(url);return u.protocol==='https:'&&u.hostname==='media.api-sports.io'&&/^\/football\/players\/\d+\.png$/.test(u.pathname)&&!u.search;}catch{return false;}};
export function parseSquad(json,team,season){const row=json.response?.find(r=>String(r.team?.id)===String(team.id));if(!Array.isArray(row?.players)||row.players.length>100)throw Error('Rosa non valida');return row.players.filter(p=>/^\d+$/.test(String(p.id))&&p.name&&p.name.length<100).map(p=>({id:'apifootball:'+p.id,provider:'API-FOOTBALL',providerId:String(p.id),season:String(season),team:normalizeTeam(team.name),name:p.name,number:p.number==null?'':String(p.number),position:p.position||'',sourcePhoto:validImage(p.photo)?p.photo:null,sourceUrl:'https://www.api-football.com/'}));}
export async function runPlayerMediaBatch({transact=transaction,store=sqlPlayerStore,fetcher=fetch,env=process.env,now=()=>Date.now(),maxTeams=4,budgetMs=90000}={}){
 if(!env.API_FOOTBALL_KEY)return {configured:false,teams:0,photos:0,missing:0};
 const converted=await migrateStoredPortraits(store,{limit:20});
 const started=now(),lease=randomUUID();
 const job=await transact(s=>{const season=String(s.football.calendar?.season||new Date(now()).getUTCFullYear());if(s.football.playerMediaLease?.until>now())return null;if(s.football.playerMediaJob?.completedAt>now()-7*DAY)return null;s.football.playerMediaLease={id:lease,until:now()+5*60000};if(s.football.playerMediaJob?.season!==season)s.football.playerMediaJob={season,teams:[]};return structuredClone(s.football.playerMediaJob);});
 if(!job)return {configured:true,cached:true};
 const report={configured:true,converted,teams:0,players:0,photos:0,missing:0,at:new Date(now()).toISOString()};
 const day=new Date(now()).toISOString().slice(0,10);if(job.quota?.day!==day)job.quota={day,used:0};
 const get=async path=>{if(job.quota.used>=85||job.quota.remaining!=null&&job.quota.remaining<=10)throw Error('Quota giornaliera protetta: aggiornamento rinviato');job.quota.used++;const r=await fetcher(BASE+path,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY},signal:AbortSignal.timeout(10000),redirect:'error'});const remaining=r.headers.get('x-ratelimit-requests-remaining');if(remaining!=null&&/^\d+$/.test(remaining))job.quota.remaining=Number(remaining);recordExternal('API-FOOTBALL',path.split('?')[0],r.status);if(!r.ok)throw Error('Catalogo giocatori non disponibile ('+r.status+')');const j=await r.json();if(j.errors&&Object.keys(j.errors).length)throw Error('API-FOOTBALL: verificare quota, piano e stagione');return j;};
 try{
  await store.init();
  if(!job.teams.length){
   const expected=await transact(s=>[...new Set(s.football.calendar.rounds.flatMap(r=>r.matches).flatMap(m=>[normalizeTeam(m.home),normalizeTeam(m.away)]))]);
   for(const season of [...new Set([job.season,'2024','2023'])]){let j;try{j=await get('teams?league=135&season='+encodeURIComponent(season));}catch(e){if(!e.message.includes('piano'))throw e;continue;}
    for(const x of j.response||[]){if(!expected.includes(normalizeTeam(x.team?.name))||job.teams.some(t=>t.id===String(x.team.id)))continue;job.teams.push({id:String(x.team.id),name:x.team.name,doneAt:0});}
    if(job.teams.length===expected.length)break;
   }
   if(!job.teams.length)throw Error('Nessuna squadra disponibile per la stagione');
  }
  for(const team of job.teams.filter(t=>!t.doneAt||t.doneAt<now()-7*DAY).slice(0,maxTeams)){
   if(now()-started>budgetMs)break;
   const incoming=parseSquad(await get('players/squads?team='+team.id),team,job.season),existing=await store.catalog([normalizeTeam(team.name)]),out=[];
   for(let i=0;i<incoming.length;i+=3){if(now()-started>budgetMs)break;await Promise.all(incoming.slice(i,i+3).map(async player=>{
    const old=existing.find(r=>r.id===player.id),record={...old,...player,...(old?.digest?{downloadedSourcePhoto:old.downloadedSourcePhoto||old.sourcePhoto}:{}),checkedAt:new Date(now()).toISOString()};
    if(old?.digest&&(old.downloadedSourcePhoto||old.sourcePhoto)===player.sourcePhoto){out.push(record);return;}
    if(player.sourcePhoto)try{const r=await fetcher(player.sourcePhoto,{redirect:'error',signal:AbortSignal.timeout(8000)});recordExternal('API-FOOTBALL immagini',new URL(player.sourcePhoto).pathname,r.status);if(r.ok){if(Number(r.headers.get('content-length'))>1000000)throw Error('Immagine troppo grande');const bytes=Buffer.from(await r.arrayBuffer()),mime=r.headers.get('content-type')?.split(';')[0];if(!['image/png','image/jpeg','image/webp'].includes(mime)||bytes.length>1000000||bytes.length<20)throw Error('Immagine non valida');const originalDigest=createHash('sha256').update(bytes).digest('hex');record.placeholder=isPlaceholderPortrait(originalDigest);let optimized;try{optimized=record.placeholder?null:await optimizePortrait(bytes,mime);}catch{}Object.assign(record,optimized||{data:bytes,mime,digest:originalDigest});record.downloadedSourcePhoto=player.sourcePhoto;if(record.placeholder)report.missing++;else report.photos++;}}catch{/* Preserve a prior portrait and retry missing artwork on the next roster pass. */}
    if(!record.digest)report.missing++;out.push(record);
   }));}
   await store.save(out);report.players+=out.length;report.teams++;if(out.length===incoming.length)team.doneAt=now();
  }
  if(job.teams.every(t=>t.doneAt>now()-7*DAY))job.completedAt=now();
 }catch(e){report.error=e.message;}finally{
  await transact(s=>{if(s.football.playerMediaLease?.id!==lease)return;delete s.football.playerMediaLease;s.football.playerMediaJob=job;s.football.playerMediaReport={...report,totalTeams:job.teams.length,completedTeams:job.teams.filter(t=>t.doneAt>now()-7*DAY).length};});
 }
 return report;
}
const key=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/ø/g,'o').replace(/ł/g,'l').replace(/đ/g,'d').replace(/ß/g,'ss').replace(/[^a-z0-9]+/g,' ').trim();
export function matchPortrait(player,team,roster){
 const candidates=roster.filter(p=>normalizeTeam(p.team)===normalizeTeam(team)),name=key(player.name);let comparable=String(player.name||'');const suffix=comparable.match(/\s+((?:[a-z]{1,2}\.)+)$/i);if(suffix)comparable=suffix[1]+' '+comparable.slice(0,-suffix[0].length);const resolvedName=key(comparable);if(!name)return null;
 let found=candidates.filter(p=>key(p.name)===name);if(found.length===1)return found[0];
 const parts=resolvedName.split(' '),prefixes=['di','de','del','della','da','van','von','dos'];if(parts.length>1&&parts.at(-1).length===1)parts.unshift(parts.pop());
 found=candidates.filter(p=>{const tokens=key(p.name).split(' ');if(tokens.at(-1)!==parts.at(-1)||parts.at(-1).length<3)return false;if(parts.length>1&&tokens.length>parts.length&&tokens.slice(-parts.length).join(' ')===parts.join(' '))return true;if(parts.length>1&&tokens.length>1&&!prefixes.includes(parts[0])&&!prefixes.includes(tokens[0])&&parts[0][0]!==tokens[0][0])return false;return true;});
 if(found.length>1&&player.jersey)found=found.filter(p=>p.number===String(player.jersey));
 if(found.length!==1)return null;return found[0];
}
export function enrichLineupPortraits(lineups,roster){if(!lineups)return null;return {...lineups,teams:lineups.teams.map(t=>{const enrich=p=>{const r=matchPortrait(p,t.team,roster);return {...p,...(r?{playerId:r.id,jersey:p.jersey||r.number||'',position:p.position||r.position,photo:r.digest&&!isPlaceholderPortrait(r.digest)?'/api/player-photo?id='+encodeURIComponent(r.id)+'&v='+r.digest:null}:{})};};return {...t,players:t.players.map(enrich),bench:(t.bench||[]).map(enrich)};})};}
export function enrichFantasyPortraits(details,roster){
 if(!details?.teams)return details;
 const clubs=[...new Set(roster.map(r=>r.team))];
 return {...details,teams:details.teams.map(t=>({...t,players:t.players.map(p=>{
  const matches=(p.club?[p.club]:clubs).map(club=>matchPortrait(p,club,roster)).filter(Boolean),unique=[...new Map(matches.map(r=>[r.id,r])).values()];
  if(unique.length!==1)return {...p,photo:null};
  const r=unique[0],club=p.club||r.team.charAt(0).toUpperCase()+r.team.slice(1);
  return {...p,club,jersey:p.jersey||r.number||'',playerId:r.id,photo:r.digest&&!isPlaceholderPortrait(r.digest)?'/api/player-photo?id='+encodeURIComponent(r.id)+'&v='+r.digest:null};
 })}))};
}

// Data-only, bounded and idempotent: retain old immutable image rows for existing URLs.
export async function migrateStoredPortraits(store=sqlPlayerStore,{limit=20}={}){
 if(!store.pendingOptimization)return 0;
 const pending=await store.pendingOptimization(PORTRAIT_VERSION,limit),changed=[];
 for(const record of pending){
  try{
   const placeholder=record.placeholder||isPlaceholderPortrait(record.digest);
   const converted=placeholder?{optimizationVersion:PORTRAIT_VERSION,placeholder:true}:await optimizePortrait(record.data,record.mime);
   changed.push({...record,...converted});
  }catch{/* Leave invalid/unsupported originals available; no partial overwrite. */}
 }
 if(changed.length)await store.save(changed);
 return changed.length;
}
