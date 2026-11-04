// Historical, offline-only data migration tool. Never imported by application entrypoints.
import {createHash} from 'node:crypto';
import {connection} from '../../../lib/db.mjs';
import {DEFAULT_RULES,fail,validateLineup} from '../../../fanta/rules.mjs';
import {identityKey} from '../../../fanta/player-identities.mjs';
const norm=identityKey;
const club=x=>({'acmilan':'milan','asroma':'roma','intermilan':'inter','hellasverona':'verona','uslecce':'lecce',ata:'atalanta',bol:'bologna',cag:'cagliari',com:'como',cre:'cremonese',fio:'fiorentina',gen:'genoa',int:'inter',juv:'juventus',laz:'lazio',lec:'lecce',mil:'milan',nap:'napoli',par:'parma',pis:'pisa',rom:'roma',sas:'sassuolo',tor:'torino',udi:'udinese',ver:'verona'})[norm(x)]||norm(x);
export function matchImportedPlayer(source,players){
 const birth=p=>typeof p.birth==='object'?p.birth?.date:p.birth,eligible=players.filter(p=>source.club&&club(p.club)===club(source.club)&&p.role===source.role&&(!birth(source)||!birth(p)||birth(source)===birth(p))),name=norm(source.name),exact=eligible.filter(p=>[p.name,p.fullName,...(p.aliases||[])].some(n=>norm(n)===name));
 if(exact.length===1)return {player:exact[0]};
 const words=String(source.name||'').toLowerCase().replace(/[^\p{L}\s.]/gu,'').split(/\s+/).filter(Boolean),initial=words.find(x=>/^\p{L}\.$/u.test(x)),surname=words.filter(x=>x!==initial).join(' ');
 const candidates=initial?eligible.filter(p=>norm(p.name).endsWith(norm(surname))&&p.name.trim()[0]?.toLowerCase()===initial[0]):[];
 return {issue:exact.length>1||candidates.length>1?'Abbinamento ambiguo':'Nessun abbinamento sicuro',candidates:(candidates.length?candidates:eligible.filter(p=>norm(p.name).includes(name))).map(p=>({id:p.id,name:p.name,club:p.club,role:p.role,birth:p.birth||null}))};
}
export async function saveBetaImport({migrated,players,uid,leagueId='fanta-lucas-a',operation='test',connect,now=Date.now,env={}}){
 if(migrated.teams.length>12||migrated.teams.length<2)fail('Servono da 2 a 12 squadre');
 const c=await connect(),issues=[];let matched=0;
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826511)');
  if((await c.query('SELECT 1 FROM fanta.jobs WHERE id=$1',['import:'+operation])).rows.length){await c.query('COMMIT');return {cached:true};}
  // Never reset native results, lineups or a running auction on a repeated import.
  if((await c.query('SELECT 1 FROM fanta.leagues WHERE id=$1',[leagueId])).rows.length)throw Error('La lega nativa esiste già: serve una revisione della migrazione');
  await c.query('INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules,source_key,max_members) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[leagueId,'Fanta Lucas Bar Lega A',Number(env.FANTA_SEASON||2026),uid,'FANTA-'+createHash('sha256').update(operation+uid).digest('hex').slice(0,10).toUpperCase(),JSON.stringify(DEFAULT_RULES),'lucas-bar:548867',migrated.teams.length]);
  const names=new Map(),mapped=new Map(),assigned=new Set(),owned=new Map(),ownerTeam=env.FANTA_BETA_TEAM_NAME||'Fly Emigrates';if(migrated.teams.filter(t=>norm(t.name)===norm(ownerTeam)).length!==1)throw Error('La squadra di Francesco non è identificata in modo univoco');
  for(const t of migrated.teams){const id=leagueId+':'+t.sourceId;names.set(t.name,id);await c.query('INSERT INTO fanta.teams(id,league_id,user_id,name,manager) VALUES($1,$2,$3,$4,$5)',[id,leagueId,norm(t.name)===norm(ownerTeam)?uid:null,t.name,t.manager]);
   owned.set(id,[]);
   for(const p of t.roster){const match=matchImportedPlayer(p,players);if(!match.player){issues.push({team:t.name,...p,...match});continue;}if(!Number.isInteger(p.price)||p.price<0){issues.push({team:t.name,...p,issue:'Prezzo d’asta non disponibile',candidates:[match.player]});continue;}if(mapped.has(String(p.sourceId))||assigned.has(match.player.id)){issues.push({team:t.name,...p,issue:'Giocatore duplicato nella fonte'});continue;}await c.query('INSERT INTO fanta.rosters VALUES($1,$2,$3,$4)',[leagueId,id,match.player.id,p.price]);mapped.set(String(p.sourceId),match.player);assigned.add(match.player.id);owned.get(id).push(match.player);matched++;}
  }
  const cutoff=now(),start=Number(env.FANTA_BETA_START_ROUND||migrated.rounds.find(r=>!r.calculated)?.number||39),last=Number(env.FANTA_LAST_ROUND||38);let importedRounds=0,formations=0;
  if(![37,38].includes(last))throw Error('Ultima giornata non valida');
  for(const r of migrated.rounds){const seriea=r.serieARound||r.serieaRound||r.number;if(seriea>last)continue;const deadline=r.deadline||r.kickoff;if(!deadline||!Number.isFinite(Date.parse(deadline)))throw Error('Una giornata non ha una scadenza certa');const historical=r.number<start&&!!r.calculated&&Date.parse(deadline)<cutoff;
   await c.query('INSERT INTO fanta.rounds(league_id,number,seriea_round,deadline,official) VALUES($1,$2,$3,$4,$5)',[leagueId,r.number,seriea,deadline,historical]);
   const roundTeams=new Set();for(const [i,m]of r.matches.entries()){const homeId=names.get(m.home),awayId=names.get(m.away);if(!homeId||!awayId)throw Error('Squadra del calendario non identificata');if(homeId===awayId||roundTeams.has(homeId)||roundTeams.has(awayId))throw Error('Calendario ambiguo: squadra presente in più sfide della giornata');roundTeams.add(homeId);roundTeams.add(awayId);const id=leagueId+':'+r.number+':'+i;await c.query('INSERT INTO fanta.matchups(id,league_id,round,home_id,away_id) VALUES($1,$2,$3,$4,$5)',[id,leagueId,r.number,homeId,awayId]);
    const points=m.fantasyPoints||m.points,score=m.score,available=Array.isArray(score)&&score.length===2&&Array.isArray(points)&&points.length===2&&score.every(Number.isFinite)&&points.every(Number.isFinite);
    if(available){const data={home:{points:points[0],goals:score[0]},away:{points:points[1],goals:score[1]}};await c.query('INSERT INTO fanta.reference_results(matchup_id,data,digest) VALUES($1,$2,$3)',[id,JSON.stringify(data),createHash('sha256').update(JSON.stringify(data)).digest('hex')]);}
    if(historical){if(!available)throw Error('Risultato storico incompleto: non viene inventato');const publicTeam=(id,name)=>({id,name,manager:migrated.teams.find(t=>t.name===name)?.manager||'',color:'#d6f77b'});const data={id,home:{team:publicTeam(homeId,m.home),points:points[0],goals:score[0]},away:{team:publicTeam(awayId,m.away),points:points[1],goals:score[1]}};await c.query('INSERT INTO fanta.results(matchup_id,historical,official,data) VALUES($1,true,true,$2)',[id,JSON.stringify(data)]);}
   }
   const sourceSheets=(r.matches||[]).flatMap(m=>m.details?.teams||[]);
   for(const sheet of sourceSheets){const teamId=names.get(sheet.name);if(!teamId||!sheet.players?.length)continue;
    try{const resolve=p=>mapped.get(String(p.id))?.id||matchImportedPlayer(p,owned.get(teamId)).player?.id;const lineup=validateLineup({formation:sheet.formation,starters:sheet.players.filter(p=>p.starter).map(resolve),bench:sheet.players.filter(p=>!p.starter).map(resolve)},owned.get(teamId));
     await c.query('INSERT INTO fanta.lineups(league_id,round,team_id,formation,starters,bench,saved_at) VALUES($1,$2,$3,$4,$5,$6,$7)',[leagueId,r.number,teamId,lineup.formation,JSON.stringify(lineup.starters),JSON.stringify(lineup.bench),new Date(Math.min(cutoff,Date.parse(deadline)-1)).toISOString()]);formations++;
    }catch{issues.push({team:sheet.name,round:r.number,issue:'Formazione non importata: modulo, rosa o abbinamenti da verificare'});}
   }importedRounds++;
  }
  for(const [i,p]of issues.entries())await c.query('INSERT INTO fanta.import_issues VALUES($1,$2,$3)',[leagueId+':'+i,leagueId,JSON.stringify(p)]);
  await c.query("UPDATE fanta.competitions SET status='active',start_round=(SELECT min(seriea_round) FROM fanta.rounds WHERE competition_id=$1) WHERE id=$1 AND EXISTS(SELECT 1 FROM fanta.rounds WHERE competition_id=$1 AND official)",[leagueId+':main']);
  const report={teams:migrated.teams.length,players:matched,unmatched:issues.length,rounds:importedRounds,formations};await c.query('INSERT INTO fanta.jobs(id,data) VALUES($1,$2)',['import:'+operation,JSON.stringify(report)]);await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
