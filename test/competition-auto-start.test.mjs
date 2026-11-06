import test from 'node:test';import assert from 'node:assert/strict';
import {fixtureDb} from './fanta/helpers.mjs';import {sqlFantaStore} from '../fanta/store.mjs';import {createFantaApi} from '../fanta/api.mjs';
import {activateCompletedLeague} from '../fanta/competition-activation.mjs';

async function setup(){
 const f=await fixtureDb();await f.db.query('DELETE FROM fanta.matchups');await f.db.query('DELETE FROM fanta.rounds');await f.db.query('DELETE FROM fanta.rosters');await f.db.query('UPDATE fanta.leagues SET max_members=2');
 const roles=[...Array(3).fill('P'),...Array(8).fill('D'),...Array(8).fill('C'),...Array(6).fill('A')];
 for(let i=1;i<=2;i++)for(const [j,role]of roles.entries()){
  const id=i===2&&j===24?'final-player':'auto-'+i+'-'+j;
  await f.db.query('INSERT INTO fanta.players VALUES($1,$2,$3,$1,$4,$5)',[id,7000+i*100+j,'c'+i,role,JSON.stringify({value:1,active:true})]);
  if(id!=='final-player')await f.db.query("INSERT INTO fanta.rosters VALUES('fanta-lucas-a',$1,$2,1)",['t'+i,id]);
 }
 for(const round of [11,12])for(let i=0;i<10;i++)await f.db.query("INSERT INTO fanta.fixtures(id,api_id,season,round,kickoff,status,home_id,away_id) VALUES($1,$2,2026,$3,$4,'NS','c1','c2')",['activation-fixture-'+round+'-'+i,8000+round*10+i,round,round===11?'2099-01-01T15:00Z':'2099-01-08T15:00Z']);
 const store=sqlFantaStore(f),api=createFantaApi({store}),call=async(route,body)=>{const r=await api(new Request('https://example.test/fanta-api/'+route,{method:body?'POST':'GET',headers:{cookie:'sid=token1'},...(body?{body:JSON.stringify({league:'fanta-lucas-a',...body})}:{})}));return {status:r.status,data:await r.json()};};
 return {...f,store,call};
}

test('the final assigned player closes the auction and starts the main competition with no admin start action',async()=>{
 const f=await setup();try{
  assert.equal((await f.call('auction/start-now',{mode:'manual',type:'iniziale'})).status,200);
  assert.equal((await f.call('auction/table',{playerId:'final-player'})).status,200);
  const bought=await f.call('auction/assign',{playerId:'final-player',teamId:'t2',price:10});assert.equal(bought.status,200);assert.equal(bought.data.status,'ended');assert.equal(bought.data.competitionActivation.status,'active');
  const comp=(await f.db.query("SELECT * FROM fanta.competitions WHERE id='fanta-lucas-a:main'")).rows[0];assert.equal(comp.status,'active');assert.equal(comp.start_round,11);assert.equal(comp.data.plan.length,28);assert.equal(comp.data.autoStarted,true);
  const home=await f.call('home?league=fanta-lucas-a');assert.equal(home.data.competition.status,'active');assert.ok(home.data.nextLineup.deadline);
  const team=await f.call('team?league=fanta-lucas-a');assert.equal(team.data.round.locked,false);assert.equal(team.data.round.number,1);
  const count=(await f.db.query('SELECT count(*)::int n FROM fanta.matchups')).rows[0].n;assert.equal(count,2);
  await f.call('auction/close',{});const repeated=await f.store.league('u1','fanta-lucas-a',(s,c)=>activateCompletedLeague(c,s),{write:true});assert.equal(repeated.status,'unchanged');assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.matchups')).rows[0].n,count);
 }finally{await f.close();}
});

test('closing an incomplete roster does not activate the competition',async()=>{
 const f=await setup();try{await f.call('auction/start-now',{mode:'manual',type:'iniziale'});await f.call('auction/close',{});assert.equal((await f.db.query("SELECT status FROM fanta.competitions WHERE id='fanta-lucas-a:main'")).rows[0].status,'draft');assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.rounds')).rows[0].n,0);}finally{await f.close();}
});

test('if calendar activation fails, the last purchase is rolled back with it',async()=>{
 const f=await setup();try{
  await f.call('auction/start-now',{mode:'manual',type:'iniziale'});await f.call('auction/table',{playerId:'final-player'});
  const broken=sqlFantaStore({connect:async()=>{const c=await f.connect();return {...c,query:(sql,args)=>{if(sql.startsWith("UPDATE fanta.competitions SET status='active'"))throw Error('injected failure');return c.query(sql,args);}};}}),api=createFantaApi({store:broken});
  const r=await api(new Request('https://example.test/fanta-api/auction/assign',{method:'POST',headers:{cookie:'sid=token1'},body:JSON.stringify({league:'fanta-lucas-a',playerId:'final-player',teamId:'t2',price:10})}));assert.equal(r.status,503);
  assert.equal((await f.db.query("SELECT count(*)::int n FROM fanta.rosters WHERE player_id='final-player'")).rows[0].n,0);assert.equal((await f.db.query("SELECT status FROM fanta.competitions WHERE id='fanta-lucas-a:main'")).rows[0].status,'draft');
 }finally{await f.close();}
});
