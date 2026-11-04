// Historical, offline-only data migration tool. Never imported by application entrypoints.
import {workbook} from './excel.mjs';
import {hashInput,ROLE} from '../../../fanta/votes.mjs';
import {connection} from '../../../lib/db.mjs';
import {normalizeTeam} from '../../../lib/calendar.mjs';
import {identityKey,persistentIdentity} from '../../../fanta/player-identities.mjs';
const norm=identityKey;
const sourceClub=x=>normalizeTeam(({ROM:'Roma',MIL:'Milan',INT:'Inter',BOL:'Bologna',UDI:'Udinese',JUV:'Juventus',NAP:'Napoli',LAZ:'Lazio',ATA:'Atalanta',FIO:'Fiorentina',TOR:'Torino',GEN:'Genoa',LEC:'Lecce',SAS:'Sassuolo',COM:'Como',PAR:'Parma',CAG:'Cagliari',MON:'Monza',VEN:'Venezia',FRO:'Frosinone'})[String(x).toUpperCase()]||x);
export function parseRosters(bytes){
 const w=workbook(bytes);if(w.name!=='ROSE'||w.rows.length!==27)throw Error('Formato rose non riconosciuto');
 const columns=[['A','B'],['D','E'],['G','H'],['J','K'],['M','N'],['P','Q'],['S','T'],['V','W'],['Y','Z'],['AB','AC']],roles={'FFF7DEAD':'P','FFA5C48D':'D','FF7CA8F0':'C','FFE48997':'A'};
 const teams=columns.map(([name,cost])=>{const title=w.rows[0][name];if(!title||norm(w.rows[0][cost])!=='costo'||norm(w.rows[26][name])!=='totale')throw Error('Intestazioni rose non valide');
  const players=w.rows.slice(1,26).map(row=>{const price=Number(row[cost]),role=roles[row.__colors[name]?.toUpperCase()];if(!row[name]||row[cost]===''||!Number.isInteger(price)||price<0||price>500||!role)throw Error('Giocatore, ruolo o costo non valido');return {name:row[name],role,price};});
  const total=players.reduce((n,p)=>n+p.price,0);if(total!==Number(w.rows[26][cost])||total>500||new Set(players.map(p=>norm(p.name))).size!==25||Object.entries({P:3,D:8,C:8,A:6}).some(([r,n])=>players.filter(p=>p.role===r).length!==n))throw Error('Totali o composizione della rosa non corrispondenti');return {name:title,players,total};
 });if(new Set(teams.map(t=>norm(t.name))).size!==10)throw Error('Squadre duplicate');return {teams,digest:hashInput(teams)};
}
const nameMatch=(a,b)=>{
 if(norm(a)===norm(b))return true;
 const x=String(a).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase(),y=String(b).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
 if(x.includes('\ufffd')){const re=new RegExp('^'+x.split('\ufffd').map(norm).join('[a-z]')+'$');if(re.test(norm(y)))return true;}
 const token=x.replace(/[^a-z\s.]/g,' ').split(/\s+/).filter(Boolean),initial=token.find(t=>/^[a-z]{1,4}\.$/.test(t)),surname=norm(token.filter(t=>t!==initial).join(' '));
 if(initial)return norm(y).endsWith(surname)&&y.trim()[0]===initial[0];
 return norm(y).endsWith(norm(x))&&norm(x).length>=4;
};
export function rosterMatch(p,players){
 const byClub=players.filter(n=>p.club&&sourceClub(n.club)===sourceClub(p.club)),eligible=byClub.filter(n=>p.role==='P'?n.role==='P':n.role!=='P'),exact=eligible.filter(n=>[n.name,n.fullName,...(n.aliases||[])].some(name=>norm(p.name)===norm(name))&&(!p.birth||!n.birth||p.birth===n.birth));
 return exact.length===1?exact[0]:null;
}
export async function linkStoredLineups({connect=connection,league='fanta-lucas-a'}={}){
 const c=await connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826511)');
  const players=(await c.query('SELECT p.id,p.name,p.role,c.name AS club FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id')).rows,rows=(await c.query('SELECT l.* FROM fanta.lineups l JOIN fanta.rounds r ON r.competition_id=l.competition_id AND r.number=l.round WHERE l.league_id=$1 AND r.deadline>now()',[league])).rows;
  let linked=0,changed=0;const roles=new Map();
  for(const row of rows){const source=row.source_data?.players||[],mapping=new Map();for(const p of source){const match=rosterMatch(p,players);if(match){mapping.set(p.id,match.id);roles.set(match.id,p.role);linked++;}}
   const resolve=id=>mapping.get(id)||id,starters=row.starters.map(resolve),bench=row.bench.map(resolve),source_data={...row.source_data,...(source.length?{players:source.map(p=>({...p,id:resolve(p.id)}))}:{})};
   if(hashInput([starters,bench,source_data])!==hashInput([row.starters,row.bench,row.source_data])){await c.query('UPDATE fanta.lineups SET starters=$4,bench=$5,source_data=$6 WHERE league_id=$1 AND round=$2 AND team_id=$3 AND competition_id=$7',[league,row.round,row.team_id,JSON.stringify(starters),JSON.stringify(bench),JSON.stringify(source_data),row.competition_id]);changed++;}
  }
  if(roles.size)await c.query('UPDATE fanta.players p SET role=x.role FROM jsonb_to_recordset($1::jsonb) AS x(id text,role text) WHERE p.id=x.id AND p.role<>x.role',[JSON.stringify([...roles].map(([id,role])=>({id,role})))]);
  await c.query('COMMIT');return {lineups:rows.length,linked,changed};
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
export async function seedStoredCatalog({connect=connection}={}){
 const c=await connect();try{
  const teams=(await c.query(`SELECT DISTINCT t FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m CROSS JOIN LATERAL jsonb_each(m#>'{details,matchInfo,teams}') q(key,t) WHERE t->>'id' IS NOT NULL`)).rows.map(x=>x.t);
  const clubs=[...new Map(teams.map(t=>[t.id,{id:'af:'+t.id,api_id:t.id,name:t.name}])).values()].sort((a,b)=>a.api_id-b.api_id),byName=new Map(clubs.map(t=>[normalizeTeam(t.name),t]));
  const cached=(await c.query("SELECT DISTINCT ON(player_id) metadata FROM football_player_catalog ORDER BY player_id,season DESC,metadata->>'checkedAt' DESC")).rows.map(r=>r.metadata);
  let players=cached.filter(p=>/^\d+$/.test(String(p.providerId))&&byName.has(p.team)&&ROLE[p.position]).map(p=>({id:'af:'+p.providerId,api_id:Number(p.providerId),club_id:byName.get(p.team).id,name:p.name,role:ROLE[p.position],data:{photoUrl:p.placeholder?null:'/api/player-photo?id='+encodeURIComponent(p.id)+'&v='+p.digest,active:true}}));
  const fresh=(await c.query(`SELECT DISTINCT ON(p#>>'{player,id}') p#>>'{player,id}' AS id,p#>>'{player,name}' AS name,t#>>'{team,id}' AS club_id,p#>>'{statistics,0,games,position}' AS position FROM fanta_state s CROSS JOIN LATERAL jsonb_array_elements(s.payload#>'{football,calendar,rounds}') r CROSS JOIN LATERAL jsonb_array_elements(r->'matches') m CROSS JOIN LATERAL jsonb_array_elements(m#>'{details,players}') t CROSS JOIN LATERAL jsonb_array_elements(t->'players') p WHERE m#>>'{details,source}'='API-FOOTBALL' ORDER BY p#>>'{player,id}',(r->>'number')::int DESC`)).rows;
  const merged=new Map(players.map(p=>[p.id,p]));for(const p of fresh){if(!/^\d+$/.test(p.id)||!ROLE[p.position]||!clubs.some(t=>t.id==='af:'+p.club_id))continue;const id='af:'+p.id,old=merged.get(id);merged.set(id,{...old,id,api_id:Number(p.id),club_id:'af:'+p.club_id,name:p.name,role:ROLE[p.position],data:old?.data||{active:true}});}players=[...merged.values()].sort((a,b)=>a.api_id-b.api_id);
  const digest=hashInput([clubs,players]),old=(await c.query("SELECT data->>'digest' AS digest FROM fanta.jobs WHERE id='seed:stored-catalog'")).rows[0];if(old?.digest===digest)return {cached:true,players:players.length};
  await c.query('BEGIN');
  await c.query(`INSERT INTO fanta.clubs SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,api_id int,name text) ON CONFLICT(id) DO UPDATE SET name=EXCLUDED.name`,[JSON.stringify(clubs)]);
  await c.query(`INSERT INTO fanta.players(id,api_id,club_id,name,role,data) SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(id text,api_id int,club_id text,name text,role text,data jsonb) ON CONFLICT(id) DO UPDATE SET club_id=coalesce(fanta.players.club_id,EXCLUDED.club_id),name=EXCLUDED.name,data=fanta.players.data||EXCLUDED.data WHERE (fanta.players.club_id,fanta.players.name,fanta.players.data->>'photoUrl') IS DISTINCT FROM (EXCLUDED.club_id,EXCLUDED.name,EXCLUDED.data->>'photoUrl')`,[JSON.stringify(players)]);
  await c.query("INSERT INTO fanta.jobs(id,data) VALUES('seed:stored-catalog',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify({digest,players:players.length})]);await c.query('COMMIT');return {players:players.length};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
export async function importRosters(parsed,{connect=connection,league='fanta-lucas-a'}={}){
 const c=await connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826511)');
  const existing=(await c.query('SELECT data FROM fanta.jobs WHERE id=$1',['rosters:'+parsed.digest])).rows[0];if(existing){await c.query('COMMIT');return {...existing.data,cached:true};}
  const l=(await c.query('SELECT id,source_key FROM fanta.leagues WHERE id=$1 FOR UPDATE',[league])).rows[0];if(!l||l.source_key!=='lucas-bar:548867')throw Error('Lega di destinazione non riconosciuta');
  const teams=(await c.query('SELECT id,name FROM fanta.teams WHERE league_id=$1',[league])).rows,players=(await c.query('SELECT p.id,p.name,p.role,p.club_id AS "clubId",c.name AS club FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id')).rows;
  const saved=(await c.query('SELECT l.*,r.deadline FROM fanta.lineups l JOIN fanta.rounds r ON r.competition_id=l.competition_id AND r.number=l.round WHERE l.league_id=$1 ORDER BY l.round DESC',[league])).rows,bindings=(await c.query('SELECT * FROM fanta.player_bindings WHERE league_id=$1',[league])).rows,previous=(await c.query('SELECT * FROM fanta.roster_entries WHERE league_id=$1',[league])).rows,entries=[],issues=[];
  for(const t of parsed.teams){const matches=teams.filter(n=>norm(n.name)===norm(t.name));if(matches.length!==1)throw Error('Squadra non identificata: '+t.name);const tid=matches[0].id,evidence=saved.filter(s=>s.team_id===tid).flatMap(s=>s.source_data?.players||[]);
   for(const p of t.players){const seen=[...new Map(evidence.filter(n=>n.role===p.role&&nameMatch(p.name,n.name)).map(n=>[norm(n.name)+':'+sourceClub(n.club),n])).values()],source=seen.length===1?seen[0]:null,prior=previous.filter(e=>e.team_id===tid&&[e.name,e.data.originalName].some(n=>norm(n)===norm(p.name))),old=prior.length===1?prior[0]:null,bound=persistentIdentity({...p,id:old?.source_id},bindings.filter(b=>b.team_id===tid),players),preserved=old?.player_id?players.find(x=>x.id===old.player_id):null;
    if(bound&&preserved&&bound.id!==preserved.id)throw Error('Associazione persistente in conflitto: '+p.name);
    const match=bound||preserved||(source?rosterMatch({...p,name:source.name,club:source.club},players):null);
    const id=old?.source_id||'roster:'+hashInput([league,tid,norm(source?.name||p.name),p.role]).slice(0,24);entries.push({league_id:league,team_id:tid,source_id:id,name:old?.name||source?.name||p.name,role:p.role,price:p.price,player_id:match?.id||null,data:{...old?.data,club:match?.club||source?.club||old?.data.club||'',originalName:p.name,aliases:[...new Set([...(old?.data.aliases||[]),...evidence.filter(n=>n.role===p.role&&nameMatch(p.name,n.name)).map(n=>n.id)])]}});
    if(!match)issues.push({team:t.name,name:p.name,role:p.role,issue:source?'Giocatore API da abbinare':'Club e giocatore API da abbinare'});
   }
  }
  const linked=entries.filter(e=>e.player_id);if(new Set(linked.map(e=>e.player_id)).size!==linked.length)throw Error('Calciatore assegnato a più squadre');
  if((await c.query('SELECT 1 FROM fanta.sales WHERE league_id=$1 AND NOT undone LIMIT 1',[league])).rows.length)throw Error('Esiste un’asta nativa: import da revisionare');
  await c.query(`INSERT INTO fanta.roster_entries SELECT * FROM jsonb_to_recordset($1::jsonb) AS x(league_id text,team_id text,source_id text,name text,role text,price int,player_id text,data jsonb) ON CONFLICT(team_id,source_id) DO UPDATE SET name=EXCLUDED.name,role=EXCLUDED.role,price=EXCLUDED.price,player_id=EXCLUDED.player_id,data=EXCLUDED.data WHERE (fanta.roster_entries.name,fanta.roster_entries.role,fanta.roster_entries.price,fanta.roster_entries.player_id,fanta.roster_entries.data) IS DISTINCT FROM (EXCLUDED.name,EXCLUDED.role,EXCLUDED.price,EXCLUDED.player_id,EXCLUDED.data)`,[JSON.stringify(entries)]);
  if(linked.length)await c.query(`UPDATE fanta.players p SET role=x.role FROM jsonb_to_recordset($1::jsonb) AS x(player_id text,role text) WHERE p.id=x.player_id AND p.role<>x.role`,[JSON.stringify(linked)]);
  const keep=entries.map(e=>e.source_id);await c.query('DELETE FROM fanta.roster_entries WHERE league_id=$1 AND NOT(source_id=ANY($2::text[]))',[league,keep]);
  await c.query('DELETE FROM fanta.rosters WHERE league_id=$1 AND NOT(player_id=ANY($2::text[]))',[league,linked.map(e=>e.player_id)]);
  if(linked.length)await c.query(`INSERT INTO fanta.rosters SELECT league_id,team_id,player_id,price FROM jsonb_to_recordset($1::jsonb) AS x(league_id text,team_id text,player_id text,price int) ON CONFLICT(league_id,player_id) DO UPDATE SET team_id=EXCLUDED.team_id,price=EXCLUDED.price`,[JSON.stringify(linked)]);
  for(const row of saved){if(Date.parse(row.deadline)<=Date.now())continue;const own=entries.filter(e=>e.team_id===row.team_id),mapping=new Map(own.flatMap(e=>[e.source_id,...e.data.aliases].map(id=>[id,e.player_id||e.source_id]))),snapshot=row.source_data?.players||[];
   for(const p of snapshot){const mapped=rosterMatch(p,players);if(mapped)mapping.set(p.id,mapped.id);}
   const resolve=id=>mapping.get(id)||id,starters=row.starters.map(resolve),bench=row.bench.map(resolve),source_data={...row.source_data,...(snapshot.length?{players:snapshot.map(p=>({...p,id:resolve(p.id)}))}:{})};
   if(hashInput([starters,bench,source_data])!==hashInput([row.starters,row.bench,row.source_data]))await c.query('UPDATE fanta.lineups SET starters=$4,bench=$5,source_data=$6 WHERE league_id=$1 AND round=$2 AND team_id=$3 AND competition_id=$7',[league,row.round,row.team_id,JSON.stringify(starters),JSON.stringify(bench),JSON.stringify(source_data),row.competition_id]);
  }
  await c.query("DELETE FROM fanta.import_issues WHERE league_id=$1 AND id LIKE 'roster:%'",[league]);
  for(let i=0;i<issues.length;i++)await c.query('INSERT INTO fanta.import_issues VALUES($1,$2,$3)',['roster:'+league+':'+i,league,JSON.stringify(issues[i])]);
  const report={teams:entries.length/25,players:entries.length,linked:linked.length,unmatched:issues.length,spending:parsed.teams.map(t=>({team:t.name,spent:t.total,credits:500-t.total})),digest:parsed.digest};
  await c.query("UPDATE fanta.leagues SET rules=jsonb_set(rules,'{_migrationStage}','\"rosters\"') WHERE id=$1",[league]);await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2)',['rosters:'+parsed.digest,JSON.stringify(report)]);await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
