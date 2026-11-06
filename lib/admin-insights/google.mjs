import {readFile} from 'node:fs/promises';
import {createSign,createHash} from 'node:crypto';

const scope='https://www.googleapis.com/auth/analytics.readonly';
const tokens=new Map();
export class AnalyticsError extends Error {
 constructor(code,status=503){super(code);this.code=code;this.status=status;}
}
const json64=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
async function googleJson(url,options,fetcher){
 let response;
 try{response=await fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(20000)});}catch{throw new AnalyticsError('google-unreachable');}
 if(!response.ok)throw new AnalyticsError(response.status===401?'google-authentication':response.status===403?'google-permission-or-api-disabled':response.status===429?'google-quota':'google-report-error');
 const text=await response.text();if(text.length>4_000_000)throw new AnalyticsError('google-report-too-large');
 try{return JSON.parse(text);}catch{throw new AnalyticsError('google-response-invalid');}
}
export async function accessToken(credentials,{fetcher=fetch,now=Date.now()}={}){
 if(credentials.type!=='service_account'||!credentials.client_email||!credentials.private_key)throw new AnalyticsError('google-credentials-invalid');
 const identity=createHash('sha256').update(credentials.client_email+credentials.private_key).digest('hex');
 const cached=tokens.get(identity);if(cached?.expires>now+60000)return cached.value;
 const issued=Math.floor(now/1000),unsigned=json64({alg:'RS256',typ:'JWT'})+'.'+json64({iss:credentials.client_email,scope,aud:'https://oauth2.googleapis.com/token',iat:issued,exp:issued+3600});
 let assertion;try{assertion=unsigned+'.'+createSign('RSA-SHA256').update(unsigned).sign(credentials.private_key,'base64url');}catch{throw new AnalyticsError('google-credentials-invalid');}
 const result=await googleJson('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'urn:ietf:params:oauth:grant-type:jwt-bearer',assertion}).toString()},fetcher);
 if(typeof result.access_token!=='string')throw new AnalyticsError('google-authentication');
 tokens.clear();tokens.set(identity,{value:result.access_token,expires:now+Math.min(3600,Number(result.expires_in)||3600)*1000});return result.access_token;
}
export function reportRequests(){
 const comparison=[{startDate:'28daysAgo',endDate:'yesterday',name:'current'},{startDate:'56daysAgo',endDate:'29daysAgo',name:'previous'}];
 const request=(dimensions,metrics,extra={})=>({dateRanges:comparison,dimensions:dimensions.map(name=>({name})),metrics:metrics.map(name=>({name})),limit:100,...extra});
 return [
  request([],['totalUsers','activeUsers','newUsers','sessions','engagedSessions','screenPageViews','engagementRate','userEngagementDuration']),
  request(['date'],['sessions','engagedSessions','screenPageViews','newUsers'],{dateRanges:[{startDate:'56daysAgo',endDate:'yesterday'}],limit:60,orderBys:[{dimension:{dimensionName:'date'}}]}),
  request(['sessionSourceMedium','sessionCampaignName'],['sessions','engagedSessions','totalUsers'],{orderBys:[{metric:{metricName:'sessions'},desc:true}]}),
  request(['eventName'],['eventCount','totalUsers']),
  request(['deviceCategory'],['sessions','engagedSessions','engagementRate'],{limit:20}),
  request(['pagePath'],['screenPageViews','activeUsers'],{dateRanges:[comparison[0]],orderBys:[{metric:{metricName:'screenPageViews'},desc:true}],limit:30}),
 ];
}
export function decodeReport(report={}){
 const dimensions=(report.dimensionHeaders||[]).map(x=>x.name),metrics=(report.metricHeaders||[]).map(x=>x.name);
 return {rows:(report.rows||[]).map(row=>Object.fromEntries([...dimensions.map((name,i)=>[name,row.dimensionValues?.[i]?.value??'']),...metrics.map((name,i)=>[name,Number(row.metricValues?.[i]?.value)||0])])),metadata:{timeZone:report.metadata?.timeZone||null,thresholded:report.metadata?.subjectToThresholding===true,otherRow:report.metadata?.dataLossFromOtherRow===true,truncated:(report.rowCount||0)>(report.rows?.length||0)}};
}
export async function fetchAnalytics({env=process.env,fetcher=fetch,now=Date.now(),credentials}={}){
 if(!/^\d{5,15}$/.test(env.GA4_PROPERTY_ID||''))throw new AnalyticsError('google-property-missing');
 if(!credentials){try{credentials=JSON.parse(await readFile(env.GA4_CREDENTIALS_FILE,'utf8'));}catch{throw new AnalyticsError('google-credentials-missing');}}
 const token=await accessToken(credentials,{fetcher,now}),requests=reportRequests(),reports=[];
 // Six small reports, two batch requests. No realtime polling and no browser credentials.
 for(let i=0;i<requests.length;i+=5){const batch=await googleJson('https://analyticsdata.googleapis.com/v1beta/properties/'+env.GA4_PROPERTY_ID+':batchRunReports',{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({requests:requests.slice(i,i+5)})},fetcher);if(batch.reports?.length!==Math.min(5,requests.length-i))throw new AnalyticsError('google-report-incomplete');reports.push(...batch.reports.map(decodeReport));}
 const [summary,daily,campaigns,events,devices,pages]=reports;
 return {property:env.GA4_PROPERTY_ID,fetchedAt:new Date(now).toISOString(),periodDays:28,excludesToday:true,summary,daily,campaigns,events,devices,pages};
}
