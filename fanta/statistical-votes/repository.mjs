import {connection} from '../../lib/db.mjs';
import {barCalendarRows,barStorageMode} from '../../lib/storage-mode.mjs';
import {DEFAULT_CONFIG,MODEL,configDigest,voteConfig} from './config.mjs';
import {prematchSnapshot} from './context.mjs';
import {calibrateBaselines} from './individual.mjs';
import {digest,validTimestamp} from './math.mjs';
import {MULTI_GOAL_VOTE_POLICY} from './goal-impact.mjs';
import {hasMultipleAssists,MULTI_ASSIST_VOTE_POLICY} from './assist-impact.mjs';
export const currentModelKey=(config=DEFAULT_CONFIG)=>MODEL+':'+configDigest(config);
export function configuredVotes(env=process.env){if(!env.FANTA_VOTE_CONFIG)return voteConfig();let x;try{x=JSON.parse(env.FANTA_VOTE_CONFIG);}catch{throw Error('FANTA_VOTE_CONFIG deve contenere JSON valido');}return voteConfig(x);}
// Read only already-acquired pre-match quotes. No odds service, pricing or slip is modified.
export async function storedOdds(c,fixtureId,{sportsStorage=barStorageMode()}={}){
 const source=barCalendarRows(sportsStorage);
 const {rows:[row]}=await c.query(`SELECT jsonb_build_object('id',m->'id','apiFootballId',m->'apiFootballId','kickoff',m->'kickoff',
  'frozen',jsonb_build_object('1',m#>'{frozen,1}','X',m#>'{frozen,X}','2',m#>'{frozen,2}')) AS data
  FROM ${source} WHERE m->>'apiFootballId'=$1 LIMIT 1`,[String(fixtureId)]);
 return row?prematchSnapshot(row.data):null;
}
export async function fixtureBaseline(c,raw,config){
 const asOf=validTimestamp(raw.fixture?.date);if(!asOf)return null;
 const {contextDataVersion,...baselineConfig}=config,id=digest({key:currentModelKey(baselineConfig),asOf,policy:'freeze-at-first-calculation'}),saved=(await c.query('SELECT data FROM fanta.baselines WHERE id=$1',[id])).rows[0];if(saved)return {id,data:saved.data};
 const rows=(await c.query(`SELECT jsonb_build_object('id',data->'id','fixtureId',data->'fixtureId','role',data->'role','minutes',data->'minutes','final',data->'final','metrics',data->'metrics','fixture',data->'fixture') AS data FROM fanta.player_stats WHERE data->>'final'='true' AND data#>>'{fixture,kickoff}' IS NOT NULL AND data#>>'{fixture,kickoff}'<$1`,[asOf])).rows;
 const baseline=calibrateBaselines(rows.map(r=>r.data),{asOf,config});await c.query('INSERT INTO fanta.baselines(id,model,data) VALUES($1,$2,$3) ON CONFLICT DO NOTHING',[id,MODEL,JSON.stringify(baseline)]);return {id,data:baseline};
}
export function calculationFingerprint(input,{config,baseline,rules}={}){
 const clone=structuredClone(input);
 if(clone.provenance)delete clone.provenance.observedAt;
 const goals=input.events?.goals,goalPolicy=Number.isInteger(goals)&&goals>=2?MULTI_GOAL_VOTE_POLICY:null;
 return digest({model:MODEL,config:configDigest(config),input:clone,baseline:baseline?.id||null,rules,...(goalPolicy?{goalPolicy}:null),
  ...(hasMultipleAssists(input.events)?{assistPolicy:MULTI_ASSIST_VOTE_POLICY}:null)});
}
export async function appendVote(c,{fixtureId,input,vote,hash,official,modelKey,at}){return appendVotes(c,{fixtureId,votes:[{p:input,vote,hash}],official,modelKey,at});}
export async function appendVotes(c,{fixtureId,votes,official,modelKey,at}){
 const rows=votes.map(({p,vote,hash})=>({player_id:p.id,input_hash:hash,input:p,data:vote}));if(!rows.length)return 0;
 let changedLive=0;
 if(!official){const updated=await c.query(`UPDATE fanta.votes v SET input_hash=r.input_hash,input=r.input,data=r.data||jsonb_build_object('calculatedAt',$4::text,'definitive',false,'audit',jsonb_build_object('inputHash',r.input_hash,'reason','current-live-snapshot')),calculated_at=$4::timestamptz FROM jsonb_to_recordset($1::jsonb) AS r(player_id text,input_hash text,input jsonb,data jsonb) WHERE v.fixture_id=$2 AND v.player_id=r.player_id AND v.model_key=$3 AND NOT v.official AND v.input_hash IS DISTINCT FROM r.input_hash RETURNING v.id`,[JSON.stringify(rows),fixtureId,modelKey,at]);changedLive=updated.rows.length;}
 const inserted=await c.query(`INSERT INTO fanta.votes(fixture_id,player_id,version,official,input_hash,input,data,model_key,supersedes_id,calculated_at)
 SELECT $2,r.player_id,$3,$4,r.input_hash,r.input,r.data||jsonb_build_object('calculatedAt',$6::text,'definitive',$4::boolean,'audit',jsonb_build_object('inputHash',r.input_hash,'supersedes',prior.id,'reason',CASE WHEN prior.model_key IS DISTINCT FROM $5 THEN 'new-algorithm' WHEN prior.input_hash IS DISTINCT FROM r.input_hash THEN 'data-or-context-correction' ELSE 'final-status-confirmation' END)),$5,prior.id,$6::timestamptz
 FROM jsonb_to_recordset($1::jsonb) AS r(player_id text,input_hash text,input jsonb,data jsonb)
 LEFT JOIN LATERAL(SELECT id,input_hash,model_key,official FROM fanta.votes WHERE fixture_id=$2 AND player_id=r.player_id ORDER BY id DESC LIMIT 1) prior ON true
 WHERE prior.input_hash IS DISTINCT FROM r.input_hash OR prior.model_key IS DISTINCT FROM $5 OR prior.official IS DISTINCT FROM $4
 ON CONFLICT DO NOTHING RETURNING id`,[JSON.stringify(rows),fixtureId,MODEL,official,modelKey,at]);return changedLive+inserted.rows.length;
}

export async function auditStoredVotes(c,key,players=[]){
 const ids=players.filter(id=>/^af:\d+$/.test(id)).slice(0,10);if(!ids.length)return [];
 return (await c.query(`SELECT DISTINCT ON(v.player_id) jsonb_build_object('playerId',v.player_id,'name',v.data->'name','fixtureId',v.fixture_id,'modelKey',v.model_key,'vote',v.data->'vote','rawVote',v.data->'rawVote','fantavote',v.data->'fantavote','why',v.data->'why','narrativeVersion',v.data->'narrativeVersion','marquee',v.data#>'{context,marquee}','contextEvidence',v.input#>'{context,marqueeEvidence}') AS data FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE v.model_key=$1 AND v.player_id=ANY($2::text[]) AND f.status IN('FT','AET','PEN') ORDER BY v.player_id,f.kickoff DESC,v.id DESC`,[key,ids])).rows.map(r=>r.data);
}
