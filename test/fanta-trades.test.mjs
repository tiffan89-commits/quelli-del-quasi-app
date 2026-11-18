import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createFantaApi} from '../fanta/api.mjs';
import {DEFAULT_RULES} from '../fanta/rules.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {fixtureDb} from './fanta/helpers.mjs';

const league='fanta-lucas-a';

async function completeRosters(db){
 const counts={P:2,D:5,C:5,A:3};
 for(const team of [1,2]){
  for(const [role,limit] of Object.entries(DEFAULT_RULES.roster)){
   for(let i=counts[role];i<limit;i++){
    const id=`extra-${team}-${role}-${i}`;
    if(team===1&&role==='P'){
     await db.query("INSERT INTO fanta.roster_entries(league_id,team_id,source_id,name,role,price,data) VALUES($1,'t1',$2,'Portiere importato','P',2,'{\"imported\":true}')",[league,id]);
    }else{
     await db.query("INSERT INTO fanta.players(id,api_id,club_id,name,role) VALUES($1,$2,$3,$1,$4)",[id,1000+team*100+role.charCodeAt(0)*10+i,'c'+team,role]);
     await db.query('INSERT INTO fanta.rosters VALUES($1,$2,$3,1)',[league,'t'+team,id]);
    }
   }
  }
 }
 await db.query("UPDATE fanta.rosters SET price=12 WHERE player_id='p1-0'");
 await db.query("UPDATE fanta.rosters SET price=4 WHERE player_id='p2-0'");
}

test('league trade window, private requests, counteroffers and atomic roster and credit transfers',async t=>{
 const f=await fixtureDb();t.after(()=>f.close());
 await f.db.exec(await readFile(new URL('../netlify/database/migrations/024_fanta_trades.sql',import.meta.url),'utf8'));
 await completeRosters(f.db);
 const token=createHash('sha256').update('token3').digest('hex');
 const user={id:'u3',name:'Terzo allenatore',username:'spettatore',emailVerified:true};
 await f.db.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(payload,'{users}',payload->'users'||$1::jsonb),'{sessions}',payload->'sessions'||$2::jsonb)`,
  [JSON.stringify([user]),JSON.stringify([{uid:'u3',token,expires:Date.now()+60000}])]);
 await f.db.query("INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES('t3',$1,'u3','Squadra 3','Allenatore 3')",[league]);
 const api=createFantaApi({store:sqlFantaStore({connect:f.connect})});
 const call=async(actor,path,body,status=200)=>{
  const response=await api(new Request('https://example.test/fanta-api/'+path+(body?'':'?league='+league),{
   headers:{cookie:'sid=token'+actor},...(body?{method:'POST',body:JSON.stringify({league,...body})}:{}),
  }));
  const value=await response.json();
  assert.equal(response.status,status,JSON.stringify(value));
  return value;
 };
 const window=(actor,open,status)=>call(actor,'trades/window',{open},status);
 const request={id:randomUUID(),recipient:'t2',offer:['p1-0'],want:['p2-0'],credits:15};
 await call(1,'trades/propose',request,409);
 assert.equal((await call(2,'trades/status')).open,false);
 await window(2,true,403);
 await window(1,true);
 assert.equal((await call(2,'trades/status')).open,true);
 await call(1,'auction/start-now',{mode:'manual',type:'iniziale'},409);
 await call(1,'trades/propose',{...request,want:['p2-1']},409);
 await call(1,'trades/propose',{...request,credits:1000},409);
 const before=Object.fromEntries((await call(1,'trades')).teams.map(t=>[t.id,t.credits]));
 await call(1,'trades/propose',request);
 await call(1,'trades/propose',request);
 const overlap={...request,id:randomUUID()};
 await call(1,'trades/propose',overlap);
 assert.equal((await call(2,'trades/status')).pending,2);
 assert.equal((await call(1,'trades/status')).pending,0);
 assert.equal((await call(3,'trades')).requests.length,0);
 await call(3,'trades/accept',{id:request.id,revision:1},404);
 assert.equal((await call(1,'trades')).requests.length,2);
 const counter={id:request.id,revision:1,offer:['p2-0'],want:['p1-0'],credits:-15};
 await call(2,'trades/counter',counter,400);
 await call(2,'trades/counter',{...counter,credits:7});
 assert.equal((await call(1,'trades/status')).pending,1);
 await call(1,'trades/accept',{id:request.id,revision:1},409);

 const lineup=f.lineup('t1');
 await call(1,'lineup',{round:1,...lineup,competition:league+':main'});
 await call(1,'trades/accept',{id:request.id,revision:2});
 await call(1,'trades/accept',{id:request.id,revision:2},409);
 const view=await call(1,'trades');
 assert.deepEqual(view.requests.map(r=>r.status).sort(),['accepted','expired']);
 assert.ok((await call(2,'trades/status')).latestAccepted);
 const teams=Object.fromEntries(view.teams.map(t=>[t.id,t]));
 assert.ok(teams.t1.roster.some(p=>p.id==='p2-0'));
 assert.ok(teams.t2.roster.some(p=>p.id==='p1-0'));
 assert.equal(teams.t1.credits,before.t1+7);
 assert.equal(teams.t2.credits,before.t2-7);
 for(const team of [teams.t1,teams.t2])for(const [role,count] of Object.entries(DEFAULT_RULES.roster)){
  assert.equal(team.roster.filter(p=>p.role===role).length,count);
 }
 assert.equal((await f.db.query("SELECT source_data->>'needsRepair' AS value FROM fanta.lineups WHERE team_id='t1'")).rows[0].value,'true');
 assert.equal((await f.db.query("SELECT count(*)::int AS count FROM fanta.roster_changes WHERE kind='trade'")).rows[0].count,1);

 const imported={id:randomUUID(),recipient:'t2',offer:['extra-1-P-2'],want:['p1-0'],credits:-5};
 await call(1,'trades/propose',imported);
 await call(2,'trades/accept',{id:imported.id,revision:1});
 const saved=(await f.db.query("SELECT team_id,data FROM fanta.roster_entries WHERE source_id='extra-1-P-2'")).rows[0];
 assert.deepEqual(saved,{team_id:'t2',data:{imported:true}});
 const followup={...request,id:randomUUID(),want:['extra-2-P-2'],credits:0};
 await call(1,'trades/propose',followup);
 await call(2,'trades/reject',{id:followup.id,revision:1});
 const expiring={...followup,id:randomUUID()};
 await call(1,'trades/propose',expiring);
 await window(1,false);
 assert.equal((await call(2,'trades/status')).pending,0);
 await window(1,true);
 const history=(await call(2,'trades')).requests;
 assert.equal(history.find(r=>r.id===followup.id).status,'rejected');
 assert.equal(history.find(r=>r.id===expiring.id).status,'expired');
});
