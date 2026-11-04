import {connection} from '../lib/db.mjs';
import {IDENTITY_SOURCE,VERIFIED_IDENTITIES,selectIdentityEntry} from './player-identities.mjs';
import {fantaProvider} from './provider.mjs';
import {identityKey} from './player-identities.mjs';
export async function inspectPlayerIdentities({connect=connection,env=process.env,verifyClubs=false,provider=fantaProvider({env,maxCalls:2})}={}){
 const c=await connect();let report;try{
  const leagues=(await c.query('SELECT id,name,source_key,season FROM fanta.leagues WHERE source_key=$1',[IDENTITY_SOURCE])).rows;
  if(leagues.length!==1)throw Object.assign(Error('League scope not unique'),{code:'IDENTITY_LEAGUE_SCOPE'});const league=leagues[0];
  const entries=(await c.query(`SELECT e.*,t.name AS team,p.api_id AS mapped_api_id,p.name AS mapped_name,p.club_id AS mapped_club_id FROM fanta.roster_entries e JOIN fanta.teams t ON t.id=e.team_id LEFT JOIN fanta.players p ON p.id=e.player_id WHERE e.league_id=$1`,[league.id])).rows;
  const players=(await c.query(`SELECT p.id,p.api_id,p.name,p.role,p.club_id,c.api_id AS club_api_id,c.name AS club,p.data->'aliases' AS aliases,p.data->'birth' AS birth FROM fanta.players p LEFT JOIN fanta.clubs c ON c.id=p.club_id WHERE p.api_id=ANY($1::int[])`,[VERIFIED_IDENTITIES.map(p=>p.apiId)])).rows;
  const clubs=(await c.query('SELECT id,api_id,name FROM fanta.clubs ORDER BY api_id')).rows;
  report={source:IDENTITY_SOURCE,league,at:new Date().toISOString(),targets:VERIFIED_IDENTITIES.map(spec=>({spec,entries:selectIdentityEntry(spec,entries),player:players.find(p=>p.api_id===spec.apiId)||null})),clubs};
 }finally{c.release();}
 if(verifyClubs){report.clubEvidence={calls:0,targets:[],errors:[]};for(const target of [{team:496,player:339883},{team:487,player:2799}])try{const data=await provider.get('players/squads?team='+target.team),row=data.response.find(r=>r.team.id===target.team),p=row?.players?.find(p=>p.id===target.player);report.clubEvidence.targets.push({teamId:target.team,club:row?.team.name,apiId:target.player,found:!!p,name:p?.name||null});}catch{report.clubEvidence.errors.push({teamId:target.team,apiId:target.player,error:'targeted-squad-verification-unavailable'});}report.clubEvidence.calls=provider.calls;}
 return report;
}
export async function repairPlayerIdentities({connect=connection,env=process.env,provider}={}){
 const audit=await inspectPlayerIdentities({connect,env,verifyClubs:true,...(provider?{provider}:{})}),c=await connect();
 const protectedSQL=`SELECT jsonb_build_object('lineups',(SELECT md5(coalesce(jsonb_agg(x ORDER BY competition_id,round,team_id)::text,'')) FROM fanta.lineups x WHERE league_id=$1),'results',(SELECT md5(coalesce(jsonb_agg(x ORDER BY matchup_id)::text,'')) FROM fanta.results x WHERE matchup_id IN(SELECT id FROM fanta.matchups WHERE league_id=$1)),'references',(SELECT md5(coalesce(jsonb_agg(x ORDER BY matchup_id)::text,'')) FROM fanta.reference_results x WHERE matchup_id IN(SELECT id FROM fanta.matchups WHERE league_id=$1)),'bar',(SELECT md5(payload::text) FROM fanta_state WHERE id=1),'votes',(SELECT md5(coalesce(jsonb_agg(jsonb_build_array(id,input_hash) ORDER BY id)::text,'')) FROM fanta.votes)) AS protected`;
 try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826511)');const league=audit.league.id;
  const before=(await c.query(protectedSQL,[league])).rows[0].protected,targets=[];
  for(const target of audit.targets){const spec=target.spec,entries=(await c.query(`SELECT e.*,t.name AS team FROM fanta.roster_entries e JOIN fanta.teams t ON t.id=e.team_id WHERE e.league_id=$1 FOR UPDATE OF e`,[league])).rows,matches=selectIdentityEntry(spec,entries);
   const issue=reason=>targets.push({name:spec.name,team:spec.team,apiId:spec.apiId,status:'conflict',reason});
   if(matches.length!==1){issue(matches.length?'ambiguous-roster-entry':'roster-entry-not-found');continue;}const entry=matches[0],pid='af:'+spec.apiId;
   const binding=(await c.query('SELECT * FROM fanta.player_bindings WHERE team_id=$1 AND source_key=$2',[entry.team_id,entry.source_id])).rows[0];
   if(entry.player_id&&entry.player_id!==pid||binding&&binding.player_id!==pid){issue('different-persistent-association-preserved');continue;}
   const owner=(await c.query('SELECT team_id FROM fanta.rosters WHERE league_id=$1 AND player_id=$2',[league,pid])).rows[0];if(owner&&owner.team_id!==entry.team_id){issue('player-already-owned-by-other-team');continue;}
   let player=(await c.query('SELECT * FROM fanta.players WHERE api_id=$1',[spec.apiId])).rows[0];if(player&&player.id!==pid){issue('noncanonical-provider-id');continue;}
   let club=player?.club_id||audit.clubs.find(x=>identityKey(x.name)===identityKey(entry.data.club))?.id||null;
   if(spec.apiClubId){const evidence=audit.clubEvidence?.targets.find(x=>x.apiId===spec.apiId);if(club!=='af:'+spec.apiClubId&&!evidence?.found){issue('club-verification-unavailable');continue;}club='af:'+spec.apiClubId;await c.query('INSERT INTO fanta.clubs(id,api_id,name) VALUES($1,$2,$3) ON CONFLICT(id) DO NOTHING',[club,spec.apiClubId,spec.club]);}
   const aliases=[...new Set([...(player?.data?.aliases||[]),entry.name,entry.data.originalName,spec.name,spec.apiName,...spec.aliases].filter(Boolean))].sort(),sourceIds=[...new Set([entry.source_id,...(entry.data.aliases||[])])].sort(),data={...player?.data,aliases,identityVerified:true,...(spec.apiClubId?{clubIdentity:{apiId:spec.apiClubId,source:'verified-squad-and-owner'}}:{})};
   const saved=await c.query(`INSERT INTO fanta.players(id,api_id,club_id,name,role,data) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET club_id=EXCLUDED.club_id,data=EXCLUDED.data WHERE (fanta.players.club_id,fanta.players.data) IS DISTINCT FROM(EXCLUDED.club_id,EXCLUDED.data)`,[pid,spec.apiId,club,player?.name||spec.apiName,entry.role,JSON.stringify(data)]);
   const evidence={source:IDENTITY_SOURCE,apiId:spec.apiId,sourceIds},bound=await c.query(`INSERT INTO fanta.player_bindings(league_id,team_id,source_key,player_id,imported_name,aliases,evidence) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(team_id,source_key) DO UPDATE SET aliases=EXCLUDED.aliases,evidence=EXCLUDED.evidence WHERE (fanta.player_bindings.aliases,fanta.player_bindings.evidence) IS DISTINCT FROM(EXCLUDED.aliases,EXCLUDED.evidence)`,[league,entry.team_id,entry.source_id,pid,entry.data.originalName||entry.name,JSON.stringify(aliases),JSON.stringify(evidence)]);
   const linked=await c.query('UPDATE fanta.roster_entries SET player_id=$3 WHERE team_id=$1 AND source_id=$2 AND player_id IS DISTINCT FROM $3',[entry.team_id,entry.source_id,pid]);
   const owned=await c.query('INSERT INTO fanta.rosters(league_id,team_id,player_id,price) VALUES($1,$2,$3,$4) ON CONFLICT(league_id,player_id) DO NOTHING',[league,entry.team_id,pid,entry.price]);
   const clubEvidence=audit.clubEvidence?.targets.find(x=>x.apiId===spec.apiId&&x.found),clubConflict=clubEvidence&&club&&club!=='af:'+clubEvidence.teamId?{preserved:club,squadEvidence:'af:'+clubEvidence.teamId}:null;
   targets.push({name:spec.name,team:spec.team,apiId:spec.apiId,playerId:pid,clubId:club,clubConflict,status:'linked',changed:[saved,bound,linked,owned].some(r=>(r.rowCount??r.affectedRows??0)>0)});
  }
  const after=(await c.query(protectedSQL,[league])).rows[0].protected;if(JSON.stringify(before)!==JSON.stringify(after))throw Error('Identity repair changed protected game/history data');
  const report={league,source:IDENTITY_SOURCE,targets,linked:targets.filter(x=>x.status==='linked').length,conflicts:targets.filter(x=>x.status==='conflict'),protectedUnchanged:true,clubEvidence:audit.clubEvidence};
  await c.query("INSERT INTO fanta.jobs(id,data) VALUES('maintenance:player-identities:v1',$1) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",[JSON.stringify(report)]);
  await c.query('COMMIT');return report;
 }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
}
