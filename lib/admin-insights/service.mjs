import {isProduction,appEnv} from '../release-env.mjs';
import {createHash} from 'node:crypto';
import {getStore} from '../blob-store.mjs';
import {fetchAnalytics,AnalyticsError} from './google.mjs';
import {fetchClarity,ClarityError} from './clarity.mjs';
import {loadProduct} from './product.mjs';
import {dashboard,recommend} from './analysis.mjs';

export const insightsStore=()=>getStore({name:'quasi-admin-insights-'+(isProduction()?'v1':appEnv()+'-'+createHash('sha256').update(process.env.DEPLOY_ID||process.env.BRANCH||'local').digest('hex').slice(0,12)),consistency:'strong'});
const hour=3600000,period=6*hour;
const clarityIsDue=(attempt,forced,now)=>!attempt||now>=attempt.nextAt||forced&&now>=Math.max(attempt.at+6*hour,attempt.manualAfter||0);
export const emptyReport=()=>({version:1,generatedAt:null,google:null,googleStatus:'not-configured',clarity:null,clarityStatus:'not-configured',product:null});
export async function readInsights({store=insightsStore(),now=Date.now()}={}){
 const [report,workflow]=await Promise.all([store.get('report',{type:'json'}),store.get('workflow',{type:'json'})]);
 const result=dashboard(report||emptyReport(),workflow||{},now);result.stale=!report?.generatedAt||now-Date.parse(report.generatedAt)>2*hour;return result;
}
export async function updateSuggestion(input,{store=insightsStore(),now=Date.now()}={}){
 if(!['todo','planned','applied','dismissed'].includes(input.status)||typeof input.id!=='string'||typeof(input.note??'')!=='string'||(input.note?.length||0)>500)throw Object.assign(Error('Aggiornamento suggerimento non valido'),{status:400});
 const report=await store.get('report',{type:'json'})||emptyReport();
 for(let i=0;i<5;i++){
  const previous=await store.getWithMetadata('workflow',{type:'json'}),value=previous?.data||{tasks:{},history:[]};
  const suggestion=recommend(report).find(x=>x.id===input.id)||value.tasks[input.id]?.suggestion;
  if(!suggestion)throw Object.assign(Error('Suggerimento non disponibile'),{status:404});
  const old=value.tasks[input.id];
  if(old?.status===input.status&&old.note===(input.note||''))return {ok:true,unchanged:true};
  const task={id:input.id,status:input.status,note:input.note||'',suggestion,metric:suggestion.metric,updatedAt:new Date(now).toISOString(),appliedAt:input.status==='applied'?(old?.status==='applied'?old.appliedAt:new Date(now).toISOString()):null};
  value.tasks[input.id]=task;value.history=[...(value.history||[]),{id:task.id,status:task.status,at:task.updatedAt,note:task.note}].slice(-300);
  const saved=await store.setJSON('workflow',value,previous?{onlyIfMatch:previous.etag}:{onlyIfNew:true});if(saved.modified)return {ok:true};
 }
 throw Object.assign(Error('Un altro aggiornamento è in corso. Riprova.'),{status:409});
}
export async function requestRefresh({store=insightsStore(),now=Date.now()}={}){
 for(let i=0;i<4;i++){
  const old=await store.getWithMetadata('refresh-request',{type:'json'});if(old?.data?.at>now-15*60000)return {ok:true,queued:true,reused:true};
  const saved=await store.setJSON('refresh-request',{at:now},old?{onlyIfMatch:old.etag}:{onlyIfNew:true});if(saved.modified)return {ok:true,queued:true};
 }
 throw Object.assign(Error('Richiesta già in elaborazione'),{status:409});
}
export async function refreshInsights({store=insightsStore(),env=process.env,now=Date.now(),google=fetchAnalytics,clarity=fetchClarity,product=loadProduct}={}){
 if(env.ADMIN_INSIGHTS_ENABLED!=='true')return {skipped:'disabled'};
 const old=await store.get('report',{type:'json'})||emptyReport(),request=await store.get('refresh-request',{type:'json'}),clarityAttempt=await store.get('clarity-export-attempt',{type:'json'});
 const forced=request?.at>(old.lastRequestedAt||0),productDue=!old.generatedAt||now-Date.parse(old.generatedAt)>=hour;
 const clarityConfigured=!!env.CLARITY_EXPORT_TOKEN?.trim();
 const clarityDue=clarityConfigured&&clarityIsDue(clarityAttempt,forced,now);
 if(!forced&&!productDue&&!clarityDue)return {skipped:'cached'};
 // A shared storage lease prevents duplicate refreshes across workers and manual requests.
 const prior=await store.getWithMetadata('refresh-lease',{type:'json'});
 if(prior?.data?.until>now)return {skipped:'busy'};
 const claim=await store.setJSON('refresh-lease',{until:now+5*60000},prior?{onlyIfMatch:prior.etag}:{onlyIfNew:true});if(!claim.modified)return {skipped:'busy'};
 try{
  const next={...old,lastRequestedAt:Math.max(old.lastRequestedAt||0,request?.at||0),generatedAt:new Date(now).toISOString(),nextProductAt:new Date(now+hour).toISOString()};
  try{next.product=await product({now});next.productError=null;}catch{next.productError='product-read-failed';}
  const configured=!!env.GA4_PROPERTY_ID&&!!env.GA4_CREDENTIALS_FILE;
  const googleDue=configured&&(forced||!old.googleAttemptAt||now-Date.parse(old.googleAttemptAt)>=period);
  if(googleDue){next.googleAttemptAt=new Date(now).toISOString();try{next.google=await google({env,now});next.googleStatus='ready';next.googleError=null;}catch(e){next.googleStatus=next.google?'stale':'error';next.googleError=e instanceof AnalyticsError?e.code:'google-unavailable';}}
  else if(!configured){next.googleStatus='not-configured';next.googleError=null;}
  next.nextGoogleAt=configured?new Date(Date.parse(next.googleAttemptAt||next.generatedAt)+period).toISOString():null;
  const latestClarityAttempt=await store.get('clarity-export-attempt',{type:'json'});
  if(clarityConfigured&&clarityIsDue(latestClarityAttempt,forced,now)){
   // Reserve before the request: timeouts, crashes and restarts must not consume the quota repeatedly.
   const attempt={at:now,nextAt:now+6*hour};await store.setJSON('clarity-export-attempt',attempt);
   next.clarityAttemptAt=new Date(now).toISOString();
   try{next.clarity=await clarity({env,now});next.clarityStatus='ready';next.clarityError=null;attempt.nextAt=now+12*hour;}
   catch(e){next.clarityStatus=next.clarity?'stale':'error';next.clarityError=e instanceof ClarityError?e.code:'clarity-unavailable';if(next.clarityError==='clarity-quota')attempt.manualAfter=attempt.nextAt=now+24*hour;}
   await store.setJSON('clarity-export-attempt',attempt);next.nextClarityAt=new Date(attempt.nextAt).toISOString();
  }else if(!clarityConfigured){next.clarityStatus='not-configured';next.clarityError=null;next.nextClarityAt=null;}
  else if(latestClarityAttempt)next.nextClarityAt=new Date(latestClarityAttempt.nextAt).toISOString();
  await store.setJSON('report',next);
  const date=new Date(now).toISOString().slice(0,10);
  // A compact daily aggregate for future comparisons, never the raw database payload.
  await store.setJSON('day-'+date,{at:next.generatedAt,product:next.product&&{users:next.product.users,verified:next.product.verified,active7:next.product.active7,slips:next.product.slips,fanta:next.product.fanta},googleFetchedAt:next.google?.fetchedAt||null});
  return {ok:true,google:next.googleStatus,clarity:next.clarityStatus,product:!next.productError};
 }finally{await store.setJSON('refresh-lease',{until:0},{onlyIfMatch:claim.etag});}
}
