import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import {PGlite} from '@electric-sql/pglite';import {DEFAULT_RULES} from '../fanta/rules.mjs';import {registerAccount} from '../lib/account.mjs';
const sql=n=>fs.readFile(new URL('../netlify/database/migrations/'+n+'.sql',import.meta.url),'utf8');
test('schema upgrade preserves 77 lineups, 35 historical results and all rosters; requested disposable usernames release their emails',async()=>{
 const db=new PGlite();try{
  for(const n of ['001_initial','003_native_fanta','004_imported_lineups','005_roster_entries'])await db.exec(await sql(n));
  await db.query('INSERT INTO fanta_state VALUES(1,$1)',[JSON.stringify({users:[{id:'a',username:'TestUser',email:'first@example.test'},{id:'b',username:'TestUser1234',email:'second@example.test'},{id:'c',username:'TestUserOther',email:'keep@example.test'}],sessions:[{uid:'a'},{uid:'c'}],accountTokens:[{uid:'b',mailId:'m1'}],mailOutbox:[{id:'m1'},{id:'m2'}],leagues:[],football:{details:'untouched'}})]);
  await db.query("INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,source_key) VALUES('legacy','Legacy',2026,'owner','LEGACY',$1,'lucas-bar:548867')",[JSON.stringify(DEFAULT_RULES)]);
  for(let i=0;i<10;i++)await db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES($1,'legacy',$1,'Mister')",['t'+i]);
  for(let r=1;r<=8;r++){
   await db.query("INSERT INTO fanta.rounds VALUES('legacy',$1,$1,'2026-09-01T15:00Z',$2)",[r,r<8]);
   for(let i=0;i<10;i++)if(r<8||i<7)await db.query("INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,source_data) VALUES('legacy',$1,$2,'4-4-2','[\"original-player\"]','[]',$3)",[r,'t'+i,JSON.stringify({players:[{name:'Originale',grade:6}]})]);
   for(let i=0;i<5;i++){const id='m'+r+'-'+i;await db.query("INSERT INTO fanta.matchups VALUES($1,'legacy',$2,$3,$4)",[id,r,'t'+(i*2),'t'+(i*2+1)]);if(r<8)await db.query("INSERT INTO fanta.results(matchup_id,historical,official,data) VALUES($1,true,true,$2)",[id,JSON.stringify({home:{points:72,goals:2},away:{points:66,goals:1}})]);}
  }
  await db.query("INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price) VALUES('legacy','t0','source','Originale','A',37)");
  const resultBefore=(await db.query('SELECT data FROM fanta.results ORDER BY matchup_id')).rows;
  for(const n of ['006_team_identity','007_competitions','008_account_cleanup'])await db.exec(await sql(n));
  assert.equal((await db.query('SELECT count(*)::int AS n FROM fanta.lineups')).rows[0].n,77);assert.equal((await db.query('SELECT count(*)::int AS n FROM fanta.results')).rows[0].n,35);assert.deepEqual((await db.query('SELECT data FROM fanta.results ORDER BY matchup_id')).rows,resultBefore);
  assert.equal((await db.query('SELECT max_members FROM fanta.leagues')).rows[0].max_members,10);assert.equal((await db.query('SELECT status FROM fanta.competitions')).rows[0].status,'active');assert.equal((await db.query('SELECT price FROM fanta.roster_entries')).rows[0].price,37);assert.equal((await db.query('SELECT DISTINCT competition_id FROM fanta.lineups')).rows[0].competition_id,'legacy:main');
  const state=(await db.query('SELECT payload FROM fanta_state')).rows[0].payload;assert.deepEqual(state.users.map(u=>u.username),['TestUserOther']);assert.equal(state.sessions.length,1);assert.deepEqual(state.mailOutbox,[{id:'m2'}]);assert.equal(state.football.details,'untouched');assert.equal((await db.query("SELECT data FROM fanta.jobs WHERE id='maintenance:remove-test-accounts-20261101'")).rows[0].data.removed,2);
  registerAccount(state,{username:'Reused',name:'Nuovo',email:'first@example.test',password:'Synthetic-new-password-123'},{RESEND_API_KEY:'unit-test-only',MAIL_FROM:'Test <test@example.test>',APP_BASE_URL:'https://example.test'});assert.ok(state.users.some(u=>u.email==='first@example.test'&&!u.username));
 }finally{await db.close();}
});
