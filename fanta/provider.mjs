import {recordExternal} from '../lib/platform-admin.mjs';
export function fantaProvider({env=process.env,fetcher=fetch,maxCalls=200}={}){
 let calls=0,remaining=Infinity;
 return {get calls(){return calls;},async get(path){
  if(!env.API_FOOTBALL_KEY)throw Error('Configura API_FOOTBALL_KEY');
  if(!/^(?:teams\?league=135&season=\d{4}|players\/squads\?team=\d+|players\?league=135&season=\d{4}&page=\d+|injuries\?(?:league=135&season=\d{4}|fixture=\d+|ids=\d+(?:-\d+){0,19})|fixtures\?(?:live=all|league=135&season=\d{4}|ids=\d+(?:-\d+){0,19}))$/.test(path))throw Error('Endpoint Fanta non consentito');
  if(calls>=maxCalls||remaining<25)throw Error('Budget API protetto: ripresa al prossimo giro');calls++;
  const r=await fetcher('https://v3.football.api-sports.io/'+path,{headers:{'x-apisports-key':env.API_FOOTBALL_KEY},redirect:'error',signal:AbortSignal.timeout(12000)});
  recordExternal('API-FOOTBALL Fanta',path.split('?')[0],r.status);const left=r.headers.get('x-ratelimit-requests-remaining');if(left!=null)remaining=Number(left);
  if(!r.ok)throw Error('API-FOOTBALL non disponibile ('+r.status+')');const j=await r.json();if(j.errors&&Object.keys(j.errors).length||!Array.isArray(j.response))throw Error('Dati API-FOOTBALL non disponibili per la stagione');return j;
 }};
}
