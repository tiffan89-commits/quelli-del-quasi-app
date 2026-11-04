import {createBarDemo} from './bar-demo.mjs';
import {createDemoFantaApi} from './fanta/demo-api.mjs';
import {demoSlipServices} from './fanta/demo-slips.mjs';
import {TEAMS} from './fanta/squadre-finte.mjs';
import {roundFor,matchupFor} from './fanta/dati-finti-giornata.mjs';
let session=null;
export function resetDemoSession(){session=null;}
export function getDemoSession(){
 if(session?.bar.state.user)return session;
 const bar=createBarDemo({admin:true}),state=bar.state,oldId=state.user.id;
 state.user.id='demo-'+crypto.randomUUID();state.user.name='Il Quasi di prova';state.user.username='ospite.demo';
 const base=state.leagues[0];for(const m of base.members)if(m.uid===oldId)Object.assign(m,{uid:state.user.id,name:state.user.name,username:state.user.username});base.admin=state.user.id;
 for(const r of base.rounds){if(r.slip)r.slip.uid=state.user.id;for(const s of r.publicSlips||[])if(s.uid===oldId)s.uid=state.user.id;}
 for(const [i,t] of Object.values(TEAMS).entries()){if(i<2)continue;base.members.push({uid:'demo-member-'+t.id,name:t.manager,username:'ospite.'+t.id,initial:500,credits:480+i*5,points:7+i,avatar:{gender:i%2?'female':'male',teamColor:t.color}});}
 base.members[0].points=14;
 const template=structuredClone(base);
 const slipLeagues=demoSlipServices(state.user).snapshot().leagues;
 state.leagues=slipLeagues.map((f,i)=>{const l=i?structuredClone(template):base;l.id=i?'bar-demo-office':'bar-demo';l.name=f.name;l.nativeFantaLink=f.nativeFantaLink;l.fantasyWalletScopes=f.fantasyWalletScopes;l.fantasyRanking=f.fantasyRanking;l.fantaSlipsEnabled=true;l.admin=i?'demo-other':state.user.id;for(const r of l.rounds)r.league=l.id;
  for(const m of l.members)m.fantasyWallets={[f.nativeFantaLink.leagueId]:{initial:500,credits:m.uid===state.user.id?500:480}};f.fantasyRanking.groups[0].members=l.members.map(m=>({uid:m.uid,points:0,credits:m.uid===state.user.id?500:480,committed:0}));l.rounds.push(...f.rounds.map(r=>({...r,league:l.id})));return l;});
 const slips=demoSlipServices(state.user,null,{state});
 const applyScenario=value=>{for(const l of state.leagues)for(const r of l.rounds.filter(r=>r.number===11)){
   const future=value==='da-schierare',done=value==='calcolata';r.closed=!future;r.settled=done;
   const time=new Date(Date.now()+(future?2*864e5:done?-2*864e5:-7200000));if(future)time.setHours(20,45,0,0);r.kickoff=time.toISOString();
   if(r.source==='fantacalcio'){const data=roundFor(11,value);for(const m of r.matches){const item=data.matchups.find(x=>x.id===m.matchupId);m.status=future?'NS':done?'FT':'LIVE';m.kickoff=r.kickoff;delete m.score;delete m.liveScore;if(item&&!future){m[done?'score':'liveScore']=[item.home.goals,item.away.goals];m.fantasyPoints=[item.home.points,item.away.points];}}}
   else for(const [i,m]of r.matches.entries()){m.kickoff=new Date(Date.parse(r.kickoff)+i*18e5).toISOString();m.status=future?'NS':done||i<3?'FT':i===3?'LIVE':'NS';delete m.score;delete m.liveScore;if(m.status==='FT')m.score=[i%3,(i+1)%2];if(m.status==='LIVE'){m.liveScore=[1,0];m.minute='38';}}
  }state.calendar.rounds=structuredClone(state.leagues[0].rounds.filter(r=>r.source==='seriea'));};
 const fanta=createDemoFantaApi({delay:0,user:state.user,onSlips:(id,enabled)=>{const l=state.leagues.find(l=>l.nativeFantaLink?.leagueId===id);if(l)l.fantaSlipsEnabled=enabled;},onScenario:applyScenario});
 // Match sheets use exactly the same synthetic squads and performances as Fanta.
 const raw=bar.api;bar.api=async(route,body)=>{const result=await raw(route,body);return result;};
 const eventList=p=>Object.entries(p.events||{}).flatMap(([key,n])=>Array.from({length:n},()=>({label:({goals:'Gol',assists:'Assist',yellow:'Ammonizione',red:'Espulsione',ownGoals:'Autogol',conceded:'Gol subito',penSaved:'Rigore parato',penMissed:'Rigore sbagliato'})[key]||key})));
 const hydrate=async()=>{for(const l of state.leagues)for(const r of l.rounds.filter(r=>r.source==='fantacalcio'))for(const m of r.matches){const sheet=await fanta.matchup(l.nativeFantaLink.leagueId,r.number,m.matchupId);m.details={complete:sheet.official,provisional:!sheet.official,at:new Date().toISOString(),teams:[sheet.home,sheet.away].map(s=>({name:s.team.name,formation:s.formation,players:[...(s.starters||[]).map(p=>({...p,grade:p.vote,fantagrade:p.fantavote,events:eventList(p),starter:true})),...(s.bench||[]).map(p=>({...p,grade:p.vote,fantagrade:p.fantavote,events:eventList(p),starter:false}))]}))};}};
 // Only local calculations; refresh after a user changes the demo scenario or a lineup.
 const save=fanta.saveLineup;fanta.saveLineup=async(...args)=>{const result=await save(...args);await hydrate();return result;};
 const setScenario=fanta.setScenario;fanta.setScenario=async value=>{const result=await setScenario(value);await hydrate();return result;};
 session={bar,fanta,slips,ready:(async()=>{const h=await fanta.home('lega-quasi');for(const l of state.leagues)for(const r of l.rounds.filter(r=>r.number>=11)){r.kickoff=new Date(Date.parse(h.round.firstKickoff)+(r.number-11)*7*864e5).toISOString();r.date=r.kickoff.slice(0,10);for(const [i,m]of r.matches.entries())m.kickoff=new Date(Date.parse(r.kickoff)+(r.source==='seriea'?i*36e5:0)).toISOString();}state.calendar.rounds=structuredClone(state.leagues[0].rounds.filter(r=>r.source==='seriea'));await hydrate();})()};return session;
}
