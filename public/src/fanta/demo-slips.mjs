import {roundFor,matchupFor} from './dati-finti-giornata.mjs';
import {saveDemoSlip} from '../demo-save.mjs';
const odds={1:2.1,X:3.4,2:3.1,'1X':1.4,'X2':1.7,'12':1.3,Goal:1.8,'No Goal':2,'Over 2.5':1.9,'Under 2.5':1.9};
export function demoSlipServices(user={id:'demo-user',name:'Ospite della demo'},leagueId=null,{state:provided}={}){
 const uid=user.id||'demo-user';
 const leagues=(leagueId?[leagueId]:['lega-quasi','fanta-ufficio']).map(leagueId=>{
 const rules={initial:500,winners:['points','credits'],mode:'weighted',scoring:'difficulty-v2',correct:1,wrong:-1,maxStake:20};
 const rounds=[11,12,10].map((number,i)=>{const r=roundFor(number,'da-schierare'),past=number===10,kickoff=new Date(Date.now()+(past?-7:i*7+2)*864e5).toISOString();return {id:'demo-fanta-'+leagueId+'-'+number,title:'Giornata '+number,number,league:'demo-fanta-bar-'+leagueId,source:'fantacalcio',competitionKey:'demo-main',competitionName:'Campionato del bar',virtualBookmaker:true,nativeFanta:{leagueId,competitionId:'demo-main'},rules:past?{...rules,scoring:'difficulty-v1'}:rules,kickoff,closed:past,settled:past,matches:r.matchups.map(m=>({id:leagueId+'-'+m.id,matchupId:m.id,home:m.home.team.name,away:m.away.team.name,homeId:m.home.team.id,awayId:m.away.team.id,kickoff,status:past?'FT':'NS',...(past?{score:[m.home.goals,m.away.goals],fantasyPoints:[m.home.points,m.away.points]}:{}),odds:{...odds}}))};});
 const member={uid,name:user.name||'Ospite',credits:500,initial:500,points:0,avatar:{},fantasyWallets:{[leagueId]:{initial:500,credits:500}}},league={id:'demo-fanta-bar-'+leagueId,name:leagueId==='lega-quasi'?'Lega dei Quasi':'Fanta Ufficio',nativeFantaLink:{leagueId},fantasyWalletScopes:{'demo-main':leagueId},members:[member],rounds};
 league.fantasyRanking={groups:[{key:leagueId,leagueName:league.name,competitionKeys:['demo-main'],bookmakerCompetitions:1,members:[{uid,points:0,credits:500,committed:0}]}]};return league;});
 const state=provided||{user:{...user,id:uid,demo:true},leagues};
 return {snapshot:()=>state,refresh:async()=>false,save:async payload=>saveDemoSlip(state,payload)};
}
