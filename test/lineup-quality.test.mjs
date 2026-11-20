import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {cleanLineupTeam,resolveLineupPlayer} from '../lib/lineup-quality.mjs';
import {enrichPresence} from '../lib/lineup-presence.mjs';
import {pinSeasonJerseys,recordLineupIssues} from '../lib/operations/lineup-quality.mjs';
import {normalizedPlayerLabel,playerDisplayName} from '../public/src/player-label.mjs';

const player=(id,name,club,number,seasonNumber,extra={})=>({id:'af:'+id,apiId:id,name,club,clubId:club,number,seasonNumber,role:'D',...extra});
test('forecasts reconcile club identities, preserve pinned shirt numbers and hide ambiguous entries',()=>{
 const owusu=player(436927,'A. Owusu','Juventus',8,41,{verifiedNumber:'41'}),teun=player(36899,'T. Koopmeiners','Juventus',8,8);
 const kambwala=player(288112,'Willy Kambwala Ndengushi','Como',53,53),ramon=player(386305,'Jacobo Ramón Naveros','Como',4,4);
 const source={kind:'probable',teams:[
  {team:'Juventus',players:[{name:'Koopmeiners T.',jersey:'8'}],bench:[{name:'A. Owusu',jersey:'8'}]},
  {team:'Como',players:[{name:'Ram&oacute;n J.',jersey:'4'}],bench:[{name:'Kambwala'},{name:'Willy Kambwala Ndengushi',jersey:'53'},{name:'Nome errato'}]},
 ]};
 const issues=[],result=enrichPresence(source,[owusu,teun,kambwala,ramon],{report:i=>issues.push(i)});
 assert.deepEqual(result.teams.map(t=>[...t.players,...t.bench].map(p=>[p.name,p.jersey])),
  [[['Koopmeiners T.','8'],['A. Owusu','41']],[['Ramón','4'],['Kambwala','53']]]);
 assert.ok(issues.some(i=>i.code==='conflicting-jersey'&&i.numbers['API-Football /players/squads']==='8'));
 assert.ok(issues.some(i=>i.code==='duplicate-player'));
 assert.ok(issues.some(i=>i.code==='unknown-player'));
 const namesakes=[player(1,'Mario Rossi','Como',1,1),player(2,'Marco Rossi','Como',2,2)];
 assert.equal(resolveLineupPlayer({name:'Rossi'},namesakes).reason,'ambiguous-player');
 assert.equal(resolveLineupPlayer({name:'Mario Rossi',apiId:3},namesakes).reason,'unknown-player-id');
});

test('unresolved jersey collisions are hidden and encodings and common names are preserved',()=>{
 const a=cleanLineupTeam({team:'Como',players:[{name:'Giocatore Uno',jersey:8}],bench:[{name:'Giocatore Due',jersey:'8'}]});
 assert.equal(a.players[0].jersey,'');assert.equal(a.bench[0].jersey,'');
 assert.equal(normalizedPlayerLabel('Jos&eacute; FranÃ§ois D&rsquo;Amico'),'José François D’Amico');
 assert.equal(normalizedPlayerLabel('A&#769;lex Valle'),'Álex Valle');
 assert.equal(normalizedPlayerLabel('Rad&#x1f;ek'),'Rad ek');
 assert.equal(playerDisplayName({name:'Jacobo Ramon',apiId:386305}),'Ramón');
});

test('verified numbers are pinned once per season and source anomalies are retained without duplicate rows',async()=>{
 const db=new PGlite(),connect=async()=>({query:(sql,args)=>db.query(sql,args),release(){}});
 try{
  await db.exec(`CREATE SCHEMA fanta;
   CREATE TABLE fanta.players(id text primary key,club_id text,data jsonb);
   CREATE TABLE fanta.jobs(id text primary key,data jsonb);
   INSERT INTO fanta.players VALUES ('af:3','Juventus','{}');`);
  const p=player(3,'An Example','Juventus',8,41);
  const official=[{lineups:{teams:[{team:'Juventus',players:[{apiId:3,name:'An Example',jersey:41}]}]}}];
  const first=Date.parse('2026-11-01T11:00Z'),options={connect,season:2026,now:first};
  assert.equal(await pinSeasonJerseys([p],{...options,official}),1);
  const read=async()=>(await db.query("SELECT data->'verifiedJersey' AS value FROM fanta.players")).rows[0].value;
  assert.deepEqual(await read(),{season:2026,clubId:'Juventus',number:'41'});
  assert.equal(await pinSeasonJerseys([{...p,number:8,seasonNumber:8}],options),0);
  assert.deepEqual(await read(),{season:2026,clubId:'Juventus',number:'41'});
  const issue={fixture:'s1',season:2026,source:'API-Football /players/squads',code:'duplicate-jersey',team:'Juventus',number:'8',players:[{name:'An Example',id:'3'}]};
  assert.equal(await recordLineupIssues([issue,issue],{connect,now:first}),1);
  assert.equal(await recordLineupIssues([issue],{connect,now:first+60000}),1);
  const {rows}=await db.query("SELECT data FROM fanta.jobs WHERE id LIKE 'lineup-quality:issue:%'");
  assert.equal(rows.length,1);assert.equal(rows[0].data.count,2);
  assert.equal(rows[0].data.firstSeen,new Date(first).toISOString());
  assert.equal(rows[0].data.lastSeen,new Date(first+60000).toISOString());
 }finally{await db.close();}
});
