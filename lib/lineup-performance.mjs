import {connection} from './db.mjs';
import {databaseReadCache} from './read-cache.mjs';
const id=p=>String(p?.apiId??p?.playerId??p?.id??'').replace(/^(af:|apifootball:)/,'');
export async function storedLineupVotes(fixtureId,{connect=connection,cache=databaseReadCache()}={}){
 const c=await connect();try{
  const revision=(await c.query('SELECT revision::text FROM fanta.cache_revision WHERE id=1')).rows[0]?.revision||'missing';
  return await cache.read('lineup-votes-v1:'+fixtureId,revision,async()=> (await c.query(`SELECT DISTINCT ON(v.player_id) v.player_id,v.data->'status' AS status,v.data->'vote' AS grade,v.data->'fantavote' AS fantagrade,v.data->'minutes' AS minutes,v.data->'events' AS events FROM fanta.votes v WHERE v.fixture_id=$1 AND v.model_key=coalesce((SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model'),v.model_key) ORDER BY v.player_id,v.id DESC`,[fixtureId])).rows,{ttl:60000});
 }finally{c.release();}
}
export function attachLineupPerformance(match,votes=[]){
 if(!match.lineups||!['1H','HT','2H','LIVE','FT','AET','PEN','ET','BT','P'].includes(match.status))return match;
 const events=match.details?.sourceEvents||[],stats=match.details?.players||[];
 const enrich=p=>{
  const playerId=id(p),vote=votes.find(v=>id({id:v.player_id})===playerId),entry=events.find(e=>e.type==='subst'&&String(e.assist?.id)===playerId),exit=events.find(e=>e.type==='subst'&&String(e.player?.id)===playerId),row=stats.flatMap(t=>t.players||[]).find(r=>String(r.player?.id)===playerId),counts={};
  for(const e of events){const own=String(e.player?.id)===playerId;if(e.type==='Goal'&&!/disallow|cancel|missed|shootout/i.test(e.detail||'')){if(own){const k=/own/i.test(e.detail||'')?'ownGoals':'goals';counts[k]=(counts[k]||0)+1;}if(String(e.assist?.id)===playerId&&!/own/i.test(e.detail||''))counts.assists=(counts.assists||0)+1;}if(own&&e.type==='Card'){const k=/red|second yellow/i.test(e.detail||'')?'red':'yellow';counts[k]=(counts[k]||0)+1;}}
  for(const [k,n]of Object.entries(vote?.events||{}))if(Number.isFinite(n))counts[k]=Math.max(counts[k]||0,n);
  const clock=e=>e?Number(e.time?.elapsed||0)+Number(e.time?.extra||0):null;
  return {...p,...(vote?{status:vote.status,grade:vote.grade,fantagrade:vote.fantagrade}:{}),minutes:vote?.minutes??row?.statistics?.[0]?.games?.minutes??null,events:counts,substitution:{in:clock(entry),out:clock(exit)}};
 };
 return {...match,lineups:{...match.lineups,started:true,teams:match.lineups.teams.map(t=>({...t,started:true,players:t.players.map(enrich),bench:(t.bench||[]).map(enrich)}))}};
}
