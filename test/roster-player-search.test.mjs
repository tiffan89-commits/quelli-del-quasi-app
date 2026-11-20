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
