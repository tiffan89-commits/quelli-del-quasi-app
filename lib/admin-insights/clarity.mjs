// Server-only, aggregate export. Never retain URLs, recordings, identities or the token.
export class ClarityError extends Error {
 constructor(code){super(code);this.code=code;}
}
const numeric=value=>value===null||value===undefined||value===''?null:Number.isFinite(Number(value))&&Number(value)>=0?Number(value):null;
const percentage=value=>{const n=numeric(value);return n!==null&&n<=100?n:null;};
const signals={deadClicks:'DeadClickCount',rageClicks:'RageClickCount',excessiveScroll:'ExcessiveScroll',quickbacks:'QuickbackClick',scriptErrors:'ScriptErrorCount',errorClicks:'ErrorClickCount'};
export function decodeClarity(data,{now=Date.now()}={}){
 if(!Array.isArray(data)||data.length>100||data.some(m=>!m||typeof m.metricName!=='string'||!Array.isArray(m.information)))throw new ClarityError('clarity-response-invalid');
 const names=data.map(m=>m.metricName);if(new Set(names).size!==names.length)throw new ClarityError('clarity-response-invalid');
 // This request has no dimensions: totals must be a single row, never summed users.
 const row=name=>{const rows=data.find(m=>m.metricName===name)?.information;return rows?.length===1&&rows[0]&&typeof rows[0]==='object'?rows[0]:{};};
 const traffic=row('Traffic'),friction={};
 for(const [key,name]of Object.entries(signals)){const r=row(name);friction[key]={sessions:numeric(r.sessionsCount),affectedPct:percentage(r.sessionsWithMetricPercentage),occurrences:numeric(r.subTotal)};}
 const breakdown=name=>(data.find(m=>m.metricName===name)?.information||[]).slice(0,20).filter(r=>r&&typeof r.name==='string').map(r=>({name:r.name.replace(/[\u0000-\u001f\u007f]/g,'').slice(0,64),sessions:numeric(r.sessionsCount)}));
 return {fetchedAt:new Date(now).toISOString(),windowHours:72,from:new Date(now-72*3600000).toISOString(),to:new Date(now).toISOString(),timezone:'UTC',sessions:numeric(traffic.totalSessionCount),botSessions:numeric(traffic.totalBotSessionCount),users:numeric(traffic.distinctUserCount??traffic.distantUserCount),pagesPerSession:numeric(traffic.pagesPerSessionPercentage??traffic.PagesPerSessionPercentage),scrollDepthPct:percentage(row('ScrollDepth').averageScrollDepth),friction,devices:breakdown('Device'),browsers:breakdown('Browser'),limited:data.some(m=>m.information.length>=1000),missingMetrics:['Traffic',...Object.values(signals)].filter(name=>!names.includes(name))};
}
export async function fetchClarity({env=process.env,fetcher=fetch,now=Date.now()}={}){
 const token=env.CLARITY_EXPORT_TOKEN?.trim();if(!token)throw new ClarityError('clarity-not-configured');
 let response;
 try{response=await fetcher('https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3',{headers:{Authorization:'Bearer '+token,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new ClarityError('clarity-unreachable');}
 if(!response.ok)throw new ClarityError(response.status===401?'clarity-authentication':response.status===403?'clarity-permission':response.status===429?'clarity-quota':'clarity-report-error');
 let raw='';
 try{
  if(Number(response.headers.get('content-length'))>2_000_000)throw Error('large');
  const reader=response.body?.getReader();if(!reader)throw Error('body');const chunks=[];let size=0;
  try{while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>2_000_000)throw Error('large');chunks.push(value);}}catch(e){await reader.cancel().catch(()=>{});throw e;}
  raw=Buffer.concat(chunks).toString('utf8');
 }catch{throw new ClarityError('clarity-response-invalid');}
 let data;try{data=JSON.parse(raw);}catch{throw new ClarityError('clarity-response-invalid');}
 return decodeClarity(data,{now});
}
