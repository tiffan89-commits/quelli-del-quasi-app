import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {ensurePilot} from '../fanta/pilot.mjs';
import {DEFAULT_RULES} from '../fanta/rules.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {roundRobin,materializeCalendar} from '../fanta/competitions.mjs';
import {writeAutoLineups} from '../fanta/auto-lineups.mjs';
import {syncNativeBar} from '../fanta/bar.mjs';

// Entirely synthetic, in memory. Never load .env or a production database.
export async function createNativePreview(state){
 const db=new PGlite(),dir=new URL('../netlify/database/migrations/',import.meta.url);
 for(const file of (await fs.readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await db.exec(await fs.readFile(new URL(file,dir),'utf8'));
 await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify(state)]);
 let tail=Promise.resolve();const connect=async()=>{let release;const next=new Promise(r=>release=r),prior=tail;tail=prior.then(()=>next);await prior;return {query:(...args)=>db.query(...args),release};};
 const env={FANTA_ENABLED:'true',FANTA_BETA_USERS:'frankwood',FANTA_BETA_OWNER:'frankwood',FANTA_SEASON:'2026'},start=Date.now()+6*3600000;
 const clubs=['Inter','Milan','Juventus','Napoli','Lazio','Roma','Atalanta','Fiorentina','Bologna','Torino','Como','Udinese','Genoa','Parma','Lecce','Sassuolo','Verona','Pisa','Cremonese','Cagliari'];
 for(const [i,name]of clubs.entries())await db.query('INSERT INTO fanta.clubs(id,api_id,name) VALUES($1,$2,$3)',['local-club:'+i,990000+i,name]);
 for(let round=10;round<=12;round++)for(let i=0;i<10;i++)await db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id,data) VALUES($1,$2,2026,$3,$4,'NS',$5,$6,$7)",['local-fixture:'+round+':'+i,990000+round*10+i,round,new Date(start+(round-10)*7*86400000+i*3600000).toISOString(),'local-club:'+i*2,'local-club:'+(i*2+1),JSON.stringify({teams:{home:{name:clubs[i*2]},away:{name:clubs[i*2+1]}}})]);
 let n=0;const rows=[];for(const[role,count]of[['P',45],['D',110],['C',110],['A',90]])for(let i=0;i<count;i++){const id=++n;rows.push({id:'local-player:'+id,api_id:990000+id,club_id:'local-club:'+(i%20),name:'Calciatore di prova '+role+' '+(i+1),role,data:{value:role==='A'?20:role==='C'?10:role==='D'?7:8,fm:6+(i%8)/10,played:8,status:{type:'ok'}}});}
 await db.query('INSERT INTO fanta.players SELECT * FROM jsonb_to_recordset($1::jsonb) x(id text,api_id int,club_id text,name text,role text,data jsonb)',[JSON.stringify(rows)]);
 const pilot=await ensurePilot({connect,env}),owner=state.users.find(u=>u.username==='frankwood');
 await db.query("INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,max_members,auto_lineups_from) VALUES('fanta-lucas-a','Lega nativa · prova locale',2026,$1,'LOCAL-NATIVE',$2,10,$3)",[owner.id,JSON.stringify(DEFAULT_RULES),new Date(start-86400000).toISOString()]);
 await db.query("INSERT INTO fanta.teams(id,league_id,user_id,name,manager,color,branding) SELECT replace(id,$1,'fanta-lucas-a'),'fanta-lucas-a',user_id,name,manager,color,branding FROM fanta.teams WHERE league_id=$1",[pilot.id]);
 await db.query("INSERT INTO fanta.rosters SELECT 'fanta-lucas-a',replace(team_id,$1,'fanta-lucas-a'),player_id,price FROM fanta.rosters WHERE league_id=$1",[pilot.id]);
 const teams=(await db.query("SELECT id FROM fanta.teams WHERE league_id='fanta-lucas-a' ORDER BY id")).rows.map(t=>t.id),plan=roundRobin(teams,{twice:true}).map((matches,i)=>({number:i+1,matches})),comp={id:'fanta-lucas-a:main',league_id:'fanta-lucas-a',start_round:10,data:{plan}};
 await db.query("INSERT INTO fanta.competitions(id,league_id,name,status,start_round,data) VALUES('fanta-lucas-a:main','fanta-lucas-a','Campionato locale','active',10,$1)",[JSON.stringify(comp.data)]);await materializeCalendar(db,comp,2026);await writeAutoLineups(db,{leagueIds:['fanta-lucas-a']});
 if(process.env.PREVIEW_BAR_NATIVE==='1'){
  const bar=state.leagues.find(l=>l.members.some(m=>m.uid===owner.id));
  await db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,'fanta-lucas-a','fanta-lucas-a:main','local-native')",[bar.id]);
  await syncNativeBar({connect});
  const saved=(await db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
  state.rounds=saved.rounds;Object.assign(bar,saved.leagues.find(l=>l.id===bar.id));
 }
 let authDigest='';async function syncAuth(){const auth={users:state.users,sessions:state.sessions},digest=JSON.stringify(auth);if(digest===authDigest)return;const c=await connect();try{await c.query('UPDATE fanta_state SET payload=payload||$1::jsonb WHERE id=1',[digest]);authDigest=digest;}finally{c.release();}}
 const api=createFantaApi({store:sqlFantaStore({connect}),env});return {syncAuth,api,close:()=>db.close()};
}
