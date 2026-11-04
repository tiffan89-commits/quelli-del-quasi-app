import {describePerformance,NARRATIVE_VERSION} from './narrative.mjs';
// Editorial refresh only: retain input, model, numerical results and revision history.
export async function refreshVoteNarratives(c,{key,limit=600,minMinutes=15}={}){
 const predicate=`v.model_key=$1 AND v.data->>'vote' IS NOT NULL AND v.data->>'narrativeVersion' IS DISTINCT FROM $2 AND NOT EXISTS(SELECT 1 FROM fanta.votes newer WHERE newer.fixture_id=v.fixture_id AND newer.player_id=v.player_id AND newer.id>v.id)`;
 const rows=(await c.query(`SELECT v.id,v.input,v.data FROM fanta.votes v WHERE ${predicate} ORDER BY v.id LIMIT $3`,[key,NARRATIVE_VERSION,limit])).rows;
 const patches=rows.map(({id,input,data})=>({id,why:describePerformance(input,{...data,shortFinal:input.final&&input.minutes!=null&&input.minutes<minMinutes,eventOnly:input.final&&(input.minutes==null||data.individual?.coverage===0)}),narrativeVersion:NARRATIVE_VERSION}));
 if(patches.length)await c.query(`UPDATE fanta.votes v SET data=v.data||jsonb_build_object('why',p.why,'narrativeVersion',p.narrative_version) FROM jsonb_to_recordset($1::jsonb) AS p(id bigint,why text,narrative_version text) WHERE v.id=p.id AND v.model_key=$2`,[JSON.stringify(patches.map(p=>({id:p.id,why:p.why,narrative_version:p.narrativeVersion}))),key]);
 const pending=(await c.query(`SELECT count(*)::int AS n FROM fanta.votes v WHERE ${predicate}`,[key,NARRATIVE_VERSION])).rows[0].n;
 return {version:NARRATIVE_VERSION,updated:patches.length,pending};
}
