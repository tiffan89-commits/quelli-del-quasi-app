import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {fixtureDb} from './fanta/helpers.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {rosterView} from '../public/src/fanta/squadra.mjs';
import {applyRosterBatch} from '../fanta/roster-editor.mjs';
import {appRoute,readAppRoute} from '../public/src/routes.mjs';

test('the editor groups staged releases first and additions second ahead of the role groups',()=>{
 const player={name:'Sintetico',club:'Lecce',role:'A',price:10,stats:{}};
 const roster=[{...player,id:'kept'},{...player,id:'added',role:'D',adding:true},{...player,id:'removed',role:'P',removing:true}];
 const {document}=parseHTML(rosterView({roster},{slots:{},bench:[]},()=>'<button>Svincola</button>'));
 assert.deepEqual([...document.querySelectorAll('.fanta-roster-row')].map(row=>row.className),['fanta-roster-row is-removing','fanta-roster-row is-adding','fanta-roster-row']);
 assert.deepEqual([...document.querySelectorAll('h4')].slice(0,2).map(el=>el.firstChild.textContent.trim()),['Da svincolare','Da aggiungere']);
 assert.equal(document.querySelector('.fanta-roster-stats,.fanta-roster-legend'),null);
 const route={mode:'fanta',page:'presidente',section:'rose',league:'l',rosterTeam:'team:1',rosterReview:true};
 assert.deepEqual(readAppRoute(appRoute(route)),{...route,round:null});
 const orders={mode:'fanta',page:'presidente',section:'rose',league:'l',rosterOrders:true};
 assert.deepEqual(readAppRoute(appRoute(orders)),{...orders,round:null});
});

test('twenty-five is an absolute cap, and a release alone may leave twenty-four',()=>{
 const roster=Array.from({length:25},(_,i)=>({id:`p${i}`,name:`Giocatore ${i}`,role:'A',price:2}));
 const free={id:'libero',role:'A',name:'Libero'},state={league:{kind:'custom'},auction:{status:'ended',version:1,log:[]},
  rules:{budget:500,roster:{A:35}},teams:[{id:'t',name:'Squadra',roster}],players:[...roster,free]};
 const add={kind:'add',teamId:'t',playerId:'libero',price:1},remove={kind:'remove',teamId:'t',playerId:'p0',previousPrice:2};
 assert.throws(()=>applyRosterBatch(state,[add]),/al massimo 25/);
 assert.equal(applyRosterBatch(state,[remove]).state.teams[0].roster.length,24);
 assert.equal(applyRosterBatch(state,[add,remove]).state.teams[0].roster.length,25);
});

test('the president can read a compact catalog and atomically save or retry releases, additions and prices',async t=>{
 const f=await fixtureDb();t.after(()=>f.close());
 const league='fanta-lucas-a',queries=[];
 const store=sqlFantaStore({connect:async()=>{
  const c=await f.connect();return {...c,query:(sql,params)=>{queries.push(sql);return c.query(sql,params);}};
 }});
 const api=createFantaApi({store,now:()=>Date.parse('2026-11-20T12:00Z')});
 const call=async(path,body,token='token1')=>{
  const response=await api(new Request(`https://example.test/fanta-api/roster/${path}?league=${league}`,{
   method:body?'POST':'GET',headers:{cookie:`sid=${token}`},...(body?{body:JSON.stringify({league,...body})}:{}),
  }));
  return {status:response.status,data:await response.json()};
 };
 await f.db.query(`INSERT INTO fanta.players VALUES
  ('free-d',998,'c1','Difensore libero','D','{"value":40}'),
  ('inactive',997,'c1','Non disponibile','C','{"active":false}')`);
 await f.db.query(`INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price)
  VALUES($1,'t2','unmapped','Storico senza ID','A',8)`,[league]);
 const initial=f.lineup('t1');
 await f.db.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench)
  VALUES($1,1,'t1',$2,$3,$4)`,[league,initial.formation,JSON.stringify(initial.starters),JSON.stringify(initial.bench)]);
 await f.db.query(`INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline) VALUES($1,2,2,'2020-01-01')`,[league]);
 await f.db.query(`INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench)
  VALUES($1,2,'t1',$2,$3,$4)`,[league,initial.formation,JSON.stringify(initial.starters),JSON.stringify(initial.bench)]);
 await f.db.query(`UPDATE fanta.teams SET branding='{"type":"design","design":{"shape":"hexagon"}}' WHERE id='t1'`);
 assert.equal((await call('editor',null,'token2')).status,403);
 const editor=await call('editor');
 assert.equal(editor.status,200,JSON.stringify(editor.data));
 assert.equal(editor.data.teams[0].team.branding.design.shape,'hexagon');
 assert.equal(editor.data.teams[0].roster.length,15);
 const catalog=await call('players');
 assert.equal(catalog.status,200,JSON.stringify(catalog.data));
 assert.deepEqual(catalog.data.map(p=>p.id).sort(),['free','free-d']);
 assert.equal(queries.some(sql=>sql.includes('fanta.votes')||sql.includes('fanta.matchups')),false);
 const change=(kind,teamId,playerId,fields={})=>({kind,teamId,playerId,...fields});
 const modifications={requestId:crypto.randomUUID(),changes:[
  change('add','t1','free',{price:12}),change('add','t1','free-d',{price:8}),
  change('remove','t1','p1-1',{previousPrice:1}),change('remove','t1','p1-9',{previousPrice:1}),
  change('price','t1','p1-0',{previousPrice:1,price:4}),change('price','t2','unmapped',{previousPrice:8,price:2}),
 ]};
 assert.equal((await call('batch',modifications,'token2')).status,403);
 assert.equal((await call('check',modifications,'token2')).status,403);
 const invalid=await call('batch',{requestId:crypto.randomUUID(),changes:[change('remove','t1','p1-1',{previousPrice:1}),change('add','t2','p1-0',{price:1})]});
 assert.equal(invalid.status,409,JSON.stringify(invalid.data));
 const invalidCheck=await call('check',{requestId:crypto.randomUUID(),changes:[change('remove','t1','p1-1',{previousPrice:9}),change('add','t2','p1-0',{price:1})]});
 assert.equal(invalidCheck.status,409);
 assert.deepEqual(invalidCheck.data.issues.map(issue=>issue.playerId),['p1-1','p1-0']);
 assert.deepEqual(await call('check',modifications),{status:200,data:{ok:true}});
 assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.roster_changes')).rows[0].n,0);
 assert.equal((await call('editor')).data.teams[0].roster.length,15);
 const results=await Promise.all([call('batch',modifications),call('batch',modifications)]);
 for(const result of results){
  assert.equal(result.status,200,JSON.stringify(result.data));
  const roster=result.data.teams[0].roster;
  assert.equal(roster.find(p=>p.id==='p1-0').price,4);
  assert.equal(roster.find(p=>p.id==='free').price,12);
  assert.equal(roster.find(p=>p.id==='free-d').price,8);
  assert.equal(roster.some(p=>p.id==='p1-1'||p.id==='p1-9'),false);
  assert.equal(result.data.teams[1].roster.find(p=>p.id==='unmapped').price,2);
 }
 assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.roster_changes')).rows[0].n,1);
 assert.deepEqual(await call('check',modifications),{status:200,data:{ok:true}});
 assert.deepEqual((await f.db.query('SELECT source_data FROM fanta.lineups ORDER BY round')).rows.map(row=>row.source_data.needsRepair??false),[true,false]);
 const stale=await call('batch',{requestId:crypto.randomUUID(),changes:[change('price','t1','p1-0',{previousPrice:1,price:5})]});
 assert.equal(stale.status,409);
 assert.equal((await call('editor')).data.teams[0].roster.find(p=>p.id==='p1-0').price,4);
 await f.db.query(`UPDATE fanta.leagues SET rules=jsonb_set(rules,'{roster,A}','3') WHERE id=$1`,[league]);
 const exceedsRules={requestId:crypto.randomUUID(),changes:[change('price','t1','p1-0',{previousPrice:4,price:500}),change('add','t1','p1-9',{price:1})]};
 assert.deepEqual(await call('check',exceedsRules),{status:200,data:{ok:true}});
 const finalCheck=await call('batch',exceedsRules);
 assert.equal(finalCheck.status,409);
 assert.match(finalCheck.data.issues[0].message,/Budget superato/);
 assert.match(finalCheck.data.issues[1].message,/Attaccanti in rosa: 4 su 3/);
 assert.equal((await f.db.query('SELECT count(*)::int n FROM fanta.roster_changes')).rows[0].n,1);
});

test('correction orders revert atomically, preserve imported rows and stay hidden after a retry',async t=>{
 const f=await fixtureDb();t.after(()=>f.close());
 const league='fanta-lucas-a',store=sqlFantaStore(f),api=createFantaApi({store});
 const call=async(path,body,token='token1')=>{
  const response=await api(new Request(`https://example.test/fanta-api/roster/${path}${path.includes('?')?'&':'?'}league=${league}`,{
   method:body?'POST':'GET',headers:{cookie:`sid=${token}`},...(body?{body:JSON.stringify({league,...body})}:{}),
  }));
  return {status:response.status,data:await response.json()};
 };
 await f.db.query(`INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price,player_id,data) VALUES
  ($1,'t1','imported:canonical','Nome importato','D',1,'p1-1','{"club":"Club originale","aliases":["Alias"]}'),
  ($1,'t2','imported:unmapped','Giocatore storico','A',7,NULL,'{"club":"Club storico","aliases":["Alias storico"]}')`,[league]);
 const log=[{id:'original-sale',player:{id:'p1-1'},team:'t1',price:1}];
 await f.db.query(`INSERT INTO fanta.auctions(id,league_id,data) VALUES($1,$1,$2) ON CONFLICT(league_id) DO UPDATE SET data=EXCLUDED.data`,[league,{status:'ended',log}]);
 await f.db.query(`INSERT INTO fanta.sales(id,auction_id,league_id,team_id,player_id,price,created_at)
  VALUES('original-sale',$1,$1,'t1','p1-1',1,'2020-01-01')`,[league]);
 const entries=async()=> (await f.db.query('SELECT * FROM fanta.roster_entries ORDER BY team_id,source_id')).rows;
 const rosters=async()=> (await f.db.query('SELECT * FROM fanta.rosters ORDER BY team_id,player_id')).rows;
 const existingEntries=await entries(),existingRosters=await rosters();
 const original={requestId:crypto.randomUUID(),changes:[
  {kind:'remove',teamId:'t1',playerId:'p1-1',previousPrice:1},
  {kind:'remove',teamId:'t2',playerId:'imported:unmapped',previousPrice:7},
  {kind:'add',teamId:'t1',playerId:'free',price:8},
  {kind:'price',teamId:'t1',playerId:'p1-0',previousPrice:1,price:4},
  {kind:'price',teamId:'t2',playerId:'p2-0',previousPrice:1,price:3},
 ]};
 const saved=await call('batch',original);assert.equal(saved.status,200,JSON.stringify(saved.data));
 assert.equal((await call('orders',null,'token2')).status,403);
 const history=await call('orders');assert.equal(history.status,200,JSON.stringify(history.data));
 const [order]=history.data.orders;
 assert.equal(order.changes.length,5);
 assert.deepEqual(Object.keys(order).sort(),['changes','createdAt','id']);
 assert.deepEqual((await call('orders?before='+order.id)).data.orders,[]);
 assert.equal((await call('orders/undo',{order:order.id},'token2')).status,403);
 assert.equal((await call('orders/undo',{order:'9223372036854775808'})).status,400);
 assert.equal((await call('batch',{requestId:crypto.randomUUID(),changes:[{kind:'price',teamId:'t1',playerId:'p1-0',previousPrice:4,price:5}]})).status,200);
 const changed=await rosters();
 const conflict=await call('orders/undo',{order:order.id});assert.equal(conflict.status,409,JSON.stringify(conflict.data));
 assert.deepEqual(await rosters(),changed);
 const [latest]=(await call('orders')).data.orders;
 assert.equal((await call('orders/undo',{order:latest.id})).status,200);
 const undone=await call('orders/undo',{order:order.id});assert.equal(undone.status,200,JSON.stringify(undone.data));
 assert.deepEqual(await entries(),existingEntries);
 assert.deepEqual(await rosters(),existingRosters);
 assert.equal((await f.db.query("SELECT released FROM fanta.sales WHERE id='original-sale'")).rows[0].released,false);
 assert.equal((await f.db.query("SELECT data FROM fanta.auctions WHERE league_id=$1",[league])).rows[0].data.log[0].released,false);
 assert.deepEqual((await call('orders')).data.orders,[]);
 assert.equal((await call('orders/undo',{order:order.id})).status,200);
 assert.equal((await call('batch',original)).status,200);
 assert.deepEqual(await rosters(),existingRosters);

 const legacy={requestId:crypto.randomUUID(),changes:[{kind:'remove',teamId:'t2',playerId:'imported:unmapped',previousPrice:7}]};
 assert.equal((await call('batch',legacy)).status,200);
 const [older]=(await call('orders')).data.orders;
 await f.db.query(`UPDATE fanta.roster_changes SET data=(data - 'restore') #- '{changes,0,before,unmapped}' #- '{changes,0,before,club}' WHERE id=$1`,[older.id]);
 const restored=await call('orders/undo',{order:older.id});assert.equal(restored.status,200,JSON.stringify(restored.data));
 const player=restored.data.teams.find(row=>row.team.id==='t2').roster.find(item=>item.id==='imported:unmapped');
 assert.equal(player.price,7);assert.equal(player.name,'Giocatore storico');assert.equal(player.unmapped,true);
 assert.deepEqual((await call('orders')).data.orders,[]);
});
