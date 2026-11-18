import {saveDemoSlip} from './demo-save.mjs';
import {demoFixtures,demoMatchData,demoFootballMeta} from './fanta/demo-football.mjs';
// Entirely synthetic, memory-only demo. Never calls a server or a provider.
export function createBarDemo({admin=false}={}){
 const now=Date.now(),user={id:'demo-user',name:admin?'Presidente di prova':'Il Quasi di prova',username:admin?'presidente.test':'giocatore.test',demo:true,emailVerified:true,avatar:{},rewards:[],email:'ospite@example.invalid',remindersEnabled:false};
 const members=[{uid:user.id,name:user.name,username:user.username,credits:500,initial:500,points:0,avatar:{}},{uid:'demo-other',name:'Il Geometra',credits:480,initial:500,points:2,avatar:{}}];
 const pairs=[['Inter','Juventus'],['Milan','Napoli'],['Roma','Lazio'],['Atalanta','Bologna'],['Torino','Fiorentina'],['Como','Udinese'],['Genoa','Lecce'],['Parma','Cagliari'],['Sassuolo','Pisa'],['Verona','Cremonese']];
 const rules={initial:500,winners:['points','credits'],mode:'weighted',scoring:'difficulty-v2',correct:1,wrong:-1,maxStake:20,initialCredits:500};
 const rounds=[11,12,13].map((number,n)=>({id:'demo-seriea-'+number,league:'bar-demo',source:'seriea',eventBetting:true,title:'Giornata '+number,number,season:2026,closed:false,settled:false,pointsOnly:false,slip:null,publicSlips:[],rules,kickoff:new Date(now+(n*7+2)*864e5).toISOString(),matches:(demoFixtures(number).length?demoFixtures(number).map(f=>[f.teams.home.name,f.teams.away.name]):pairs).map(([home,away],i)=>({id:'demo-'+number+'-'+i,home,away,kickoff:new Date(now+(n*7+2)*864e5+i*36e5).toISOString(),status:'NS',odds:n===2?{}:{1:2.1,X:3.4,2:3.1,'1X':1.4,'X2':1.7,'12':1.3,'Goal':1.8,'No Goal':2,'Over 2.5':1.9,'Under 2.5':1.9}}))}));
 const league={id:'bar-demo',name:'Il Bar di prova',code:'DEMO-ONLY',admin:admin?user.id:'demo-other',members,rules,rounds,branding:{accent:'#7bc8f7',emblem:'BQ'},prizeWinners:[],chat:{unread:0},progression:{seriea:{initial:500,initialPoints:0,history:[3,-8,12,-7].map((profit,i)=>({id:'demo-history-'+i,title:'Giornata '+(7+i),competitionName:'Serie A',played:true,correct:6+i,total:10,points:2+i,profit,capital:[503,495,507,500][i],pointsTotal:[2,5,9,14][i],position:2,positionChange:0,awards:[]}))}},community:{seriea:{}}};
 const past={...structuredClone(rounds[0]),id:'demo-history-3',title:'Giornata 10',number:10,rules:{...rules,scoring:'difficulty-v1'},closed:true,settled:true,kickoff:new Date(now-7*864e5).toISOString(),matches:rounds[0].matches.map((m,i)=>({...m,id:'demo-past-'+i,status:'FT',kickoff:new Date(now-7*864e5+i*36e5).toISOString(),score:i===9?[0,0]:[1,0]}))};
 past.matches=demoFixtures(demoFootballMeta.round).map((f,i)=>({...rounds[0].matches[i],...demoMatchData(f),id:'demo-past-'+i,kickoff:f.kickoff}));past.kickoff=past.matches[0].kickoff;
 const resultPick=m=>m.score[0]>m.score[1]?'1':m.score[0]<m.score[1]?'2':'X';
 const mine={uid:user.id,picks:Object.fromEntries(past.matches.map((m,i)=>[m.id,i===9?(resultPick(m)==='1'?'2':'1'):resultPick(m)])),stake:10,points:8,prize:0,odds:1024,savedAt:new Date(now-8*864e5).toISOString()},winner={uid:'demo-other',picks:Object.fromEntries(past.matches.map(m=>[m.id,resultPick(m)])),stake:10,points:10,prize:10240,odds:1024,savedAt:mine.savedAt};past.slip=mine;past.publicSlips=[mine,winner];rounds.push(past);league.community.seriea={recap:{round:past.id,title:past.title,winners:['demo-other'],points:10,participants:2,almost:[]},history:[{id:past.id,title:past.title,players:[{...mine,correct:9,total:10},{...winner,correct:10,total:10}]}]};
 const state={user,leagues:[league],features:{barDemo:true},calendar:{season:2026,rounds:structuredClone(rounds)},standings:null};

 const chats=new Map(),seen=new Map();
 const room=l=>{if(!chats.has(l.id))chats.set(l.id,[{id:'demo-chat-'+l.id,seq:1,uid:'demo-other',name:'Il Geometra',text:'Benvenuto al bar! Qui le certezze durano una giornata.',created:new Date(now-300000).toISOString()}]);return chats.get(l.id);};
 return {state,async api(route,body={}){
  const [name,query]=route.split('?'),params=new URLSearchParams(query),l=state.leagues.find(l=>l.id===(body.league||params.get('league')))||state.leagues[0];
  const needAdmin=()=>{if(l.admin!==state.user.id)throw Error('Solo il presidente può farlo');};
  if(name==='state')return structuredClone(state);
  if(name==='logout'){state.user=null;return {ok:true};}
  if(name==='features')return {barDemo:true};
  if(name==='slip')return saveDemoSlip(state,body);
  if(name==='profile'){if(body.name){state.user.name=body.name.trim().slice(0,60);for(const l of state.leagues){const m=l.members.find(m=>m.uid===state.user.id);if(m)m.name=state.user.name;}}return {ok:true};}
  if(name==='profile-avatar'){state.user.avatar=structuredClone(body.avatar);if(typeof body.name==='string'&&body.name.trim())state.user.name=body.name.trim();for(const l of state.leagues){const m=l.members.find(m=>m.uid===state.user.id);if(m){m.avatar=structuredClone(body.avatar);m.name=state.user.name;}}return {avatar:structuredClone(body.avatar),name:state.user.name};}
  if(name==='profile-reminders'){state.user.remindersEnabled=!!body.enabled;return {ok:true};}
  if(name==='live')return {league:l.id,members:structuredClone(l.members),rounds:[]};
  if(name==='chat-config')return {configured:false,demo:true,notify:false,preference:'muted'};
  if(name==='chat'||name==='chat-messages'){const messages=room(l);return {messages:structuredClone(messages),latest:messages.at(-1)?.seq||0,hasOlder:false,revision:l.chat.revision||1,read:0};}
  if(name==='chat-read'){l.chat.unread=0;return {unread:0};}
  if(name==='chat-send'){const text=String(body.text||'').trim();if(!text||text.length>1200)throw Error('Scrivi un messaggio fino a 1200 caratteri');const key=l.id+':'+body.nonce;if(body.nonce&&seen.has(key))return {message:structuredClone(seen.get(key))};const messages=room(l),message={id:'demo-message-'+crypto.randomUUID(),seq:(messages.at(-1)?.seq||0)+1,uid:state.user.id,name:state.user.name,text,created:new Date().toISOString()};messages.push(message);if(body.nonce)seen.set(key,message);return {message:structuredClone(message)};}
  if(name==='chat-delete'){const m=room(l).find(m=>m.id===body.message);if(!m)throw Error('Messaggio non trovato');if(m.uid!==state.user.id)needAdmin();m.text='Messaggio eliminato';m.deleted=true;l.chat.revision=(l.chat.revision||1)+1;return {ok:true};}
  if(name==='league-profile'){needAdmin();l.branding={...l.branding,...body.branding};return {ok:true};}
  if(name==='rules'){needAdmin();l.rules={...l.rules,...body.rules};return {ok:true};}
  if(name==='league-prizes'){needAdmin();l.prizeWinners=[...body.winners];return {ok:true};}
  if(name==='member-remove'||name==='member-restore'){needAdmin();const m=l.members.find(m=>m.uid===body.uid);if(!m||m.uid===l.admin)throw Error('Partecipante non disponibile');m.removed=name==='member-remove';return {ok:true};}
  if(name==='account-email'||name==='email-update'||name==='verify-email-resend')return {ok:true,message:'Nella demo non vengono inviate email. Crea un account per usare questa funzione.'};
  if(name==='create'||name==='join')return {league:l.id,message:'La demo include due leghe di prova. Crea un account per creare o raggiungere una lega reale.'};
  throw Error('Questa funzione richiede un account reale. Nella demo nessuna email o notifica viene inviata.');
 }};
}
