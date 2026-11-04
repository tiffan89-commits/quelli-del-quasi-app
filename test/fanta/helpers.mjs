import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {DEFAULT_RULES} from '../../fanta/rules.mjs';
export async function fixtureDb({cutover=true}={}){
 const db=new PGlite();await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/001_initial.sql',import.meta.url),'utf8'));await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/003_native_fanta.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/004_imported_lineups.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/005_roster_entries.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/006_team_identity.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/007_competitions.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/008_account_cleanup.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/009_statistical_votes.sql',import.meta.url),'utf8'));
 await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/010_identity_cache.sql',import.meta.url),'utf8'));
 if(cutover)await db.exec(await fs.readFile(new URL('../../netlify/database/migrations/011_native_pilot_market.sql',import.meta.url),'utf8'));
 let tail=Promise.resolve();const connect=async()=>{let release;const next=new Promise(r=>release=r),prior=tail;tail=prior.then(()=>next);await prior;return {query:(...args)=>db.query(...args),release};};
 const users=[{id:'u1',username:'frankwood',name:'Presidente sintetico',emailVerified:true,demo:false,adminOnly:false,email:'u1@example.test'},{id:'u2',username:'amico',name:'Amico sintetico',emailVerified:true,demo:false,email:'u2@example.test'}],sessions=users.map((u,i)=>({uid:u.id,token:createHash('sha256').update('token'+(i+1)).digest('hex'),expires:Date.now()+3600000}));
 await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify({users,sessions,leagues:[],rounds:[],chatSubscriptions:[]})]);
 await db.query('INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules) VALUES($1,$2,2026,$3,$4,$5)',['fanta-lucas-a','Lega sintetica','u1','TEST-INVITE',JSON.stringify(DEFAULT_RULES)]);
 for(const i of [1,2]){await db.query('INSERT INTO fanta.clubs VALUES($1,$2,$3)',['c'+i,i,'Club '+i]);await db.query('INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES($1,$2,$3,$4,$5)',['t'+i,'fanta-lucas-a','u'+i,'Squadra '+i,'Allenatore '+i]);}
 const roles=['P',...Array(4).fill('D'),...Array(4).fill('C'),...Array(2).fill('A'),'P','D','C','A'];
 const rosters={};for(const i of [1,2]){rosters['t'+i]=[];for(const [j,role]of roles.entries()){const id='p'+i+'-'+j;await db.query('INSERT INTO fanta.players VALUES($1,$2,$3,$4,$5,$6)',[id,i*100+j,'c'+i,'Giocatore '+i+' '+j,role,JSON.stringify({value:10,fm:6,played:5,status:{type:'ok',note:''}})]);await db.query('INSERT INTO fanta.rosters VALUES($1,$2,$3,1)',['fanta-lucas-a','t'+i,id]);rosters['t'+i].push({id,role,name:'Giocatore '+i+' '+j,price:1});}}
 await db.query(`INSERT INTO fanta.players VALUES('free',999,'c1','Libero sintetico','A','{"value":20}')`);
 await db.query(`INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline,official) VALUES('fanta-lucas-a',1,1,'2099-01-01T15:00:00Z',false)`);
 await db.query(`INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id) VALUES('m1','fanta-lucas-a',1,'t1','t2')`);
 return {db,connect,rosters,close:()=>db.close(),lineup:team=>({formation:'4-4-2',starters:rosters[team].slice(0,11).map(p=>p.id),bench:rosters[team].slice(11).map(p=>p.id)})};
}
export function apiFixture({status='FT',minutes=90}={}){
 const raw={fixture:{id:777,date:'2026-11-01T11:30:00Z',status:{short:status,elapsed:minutes}},league:{id:135,season:2026,round:'Regular Season - 1'},teams:{home:{id:10,name:'Club A'},away:{id:20,name:'Club B'}},goals:{home:1,away:0},lineups:[{team:{id:10},startXI:[{player:{id:1,pos:'G'}}]},{team:{id:20},startXI:[{player:{id:2,pos:'G'}}]}],events:[{type:'Goal',detail:'Normal Goal',time:{elapsed:20},player:{id:3,name:'Punta'},team:{id:10},assist:{id:4}}],players:[{team:{id:10},players:[{player:{id:1,name:'Portiere A'},statistics:[{games:{minutes,position:'G',substitute:false},goals:{saves:2},passes:{total:20,accuracy:14}}]},{player:{id:3,name:'Punta'},statistics:[{games:{minutes,position:'F',substitute:false},goals:{total:1},shots:{on:2}}]}]},{team:{id:20},players:[{player:{id:2,name:'Portiere B'},statistics:[{games:{minutes,position:'G',substitute:false},goals:{conceded:null,saves:3}}]}]}]};
 for(const group of raw.players){while(group.players.length<11){const id=group.team.id*100+group.players.length;group.players.push({player:{id,name:'Riserva sintetica '+id},statistics:[{games:{minutes,position:'D',substitute:false}}]});}}return raw;
}
