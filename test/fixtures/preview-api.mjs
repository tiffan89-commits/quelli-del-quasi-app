import {createBarDemo} from '../../public/src/bar-demo.mjs';
import {createDemoFantaApi} from '../../public/src/fanta/demo-api.mjs';
import {demoSlipServices} from '../../public/src/fanta/demo-slips.mjs';
const fixtures=new Map();
function fixture(role){if(fixtures.has(role))return fixtures.get(role);const bar=createBarDemo({admin:role==='admin'});bar.state.user.demo=false;bar.state.user.id='preview-'+role;bar.state.leagues[0].members[0].uid=bar.state.user.id;if(role==='admin')bar.state.leagues[0].admin=bar.state.user.id;bar.state.user.email='prova@example.test';const fanta=createDemoFantaApi({delay:0,user:bar.state.user});const slips=demoSlipServices(bar.state.user).snapshot().leagues[0],l=bar.state.leagues[0];l.nativeFantaLink={leagueId:'lega-quasi'};l.fantasyWalletScopes=slips.fantasyWalletScopes;l.fantasyRanking=slips.fantasyRanking;l.members[0].fantasyWallets=slips.members[0].fantasyWallets;l.rounds.push(...slips.rounds.map(r=>({...r,league:l.id})));const result={bar,fanta,slipsEnabled:true};fixtures.set(role,result);return result;}
const json=(data,status=200,headers={})=>new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json','cache-control':'no-store',...headers}});
export default async function handler(req){
 const url=new URL(req.url),pathname=url.pathname.replace(/^\/\.netlify\/functions\/preview-api/,'');
 const role=req.headers.get('cookie')?.match(/preview-role=(admin|member)/)?.[1];
 const cookie=value=>'preview-role='+value+'; Path=/; HttpOnly; SameSite=Lax'+(url.protocol==='https:'?'; Secure':'');
 if(pathname.startsWith('/__preview/')){const name=pathname.split('/').at(-1);return new Response(null,{status:302,headers:{location:'/#/bar/oggi','set-cookie':cookie(name==='admin'?'admin':'member')}});}
 const data=req.method==='POST'?await req.json().catch(()=>({})):{};
 if(pathname.startsWith('/api/')){
  const route=pathname.slice(5);if(route==='features')return json({barDemo:true,preview:true});
  if(route==='state'&&!role)return json({user:null,leagues:[],features:{barDemo:true}});
  if(route==='login'){return json({ok:true},200,{'set-cookie':cookie(/presidente|admin/.test(data.username)?'admin':'member')});}
  if(route==='logout')return json({ok:true},200,{'set-cookie':'preview-role=; Path=/; Max-Age=0'});
  if(['register','forgot-password','resend-verification'].includes(route))return json({ok:true,message:'Anteprima: invio email simulato, nessuna email spedita.'});
  if(!role)return json({error:'Accedi alla prova utente o presidente.'},401);
  const f=fixture(role);if(route==='create'||route==='join')return json({error:'Creazione e inviti reali sono esclusi da questa anteprima. Usa le leghe sintetiche già presenti.'},400);
  if(route==='notifications'||route==='push-subscribe')return json({ok:true,disabled:true});
  try{return json(await f.bar.api(route+(url.search||''),data));}catch(e){return json({error:e.message},400);}
 }
 if(pathname.startsWith('/fanta-api/')){
  const f=fixture(role||'member'),api=f.fanta,route=pathname.slice(11),league=url.searchParams.get('league')||data.league||'lega-quasi';
  try{
   if(route==='me'){const m=await api.me();return json({...m,access:role?'full':'demo'});}
   if(route==='leagues')return json((await api.leagues()).map(l=>({...l,role:role==='admin'?'admin':'member',slipsEnabled:f.slipsEnabled})));
   if(route==='home')return json(await api.home(league));
   if(route==='team'){const t=await api.team(league,url.searchParams.get('team')||undefined);t.canManageRoster=false;return json(t);}
   if(route==='league'){const l=await api.league(league);l.isAdmin=role==='admin';l.league.slipsEnabled=f.slipsEnabled;return json(l);}
   if(route==='round')return json(await api.round(league,Number(url.searchParams.get('number'))||null));
   if(route==='matchup')return json(await api.matchup(league,Number(url.searchParams.get('number')),url.searchParams.get('id')));
   if(route==='lineup')return json(await api.saveLineup(league,data.round,data));
   if(route==='league/slips'){if(role!=='admin')return json({error:'Operazione riservata al presidente'},403);f.slipsEnabled=!!data.enabled;f.bar.state.leagues[0].fantaSlipsEnabled=f.slipsEnabled;return json({enabled:f.slipsEnabled});}
   if(route==='settings')return json(await api.saveSettings(data));
   if(route==='auction/tick')return json(await api.auction(league));
   if(route==='auction/players')return json(await api.auctionPlayers(league));
   return json({error:'Operazione non prevista nei dati sintetici dell’anteprima.'},400);
  }catch(e){return json({error:e.message||'Errore nei dati di prova'},400);}
 }
 if(pathname.endsWith('public-football'))return json({matches:[],window:{liveIds:[]}});
 return json({error:'Rotta di anteprima non disponibile'},404);
}
