import {migrateStraightScoring} from '../lib/scoring.mjs';
import {isDeepStrictEqual} from 'node:util';
import {connection} from '../lib/db.mjs';
import {id,settle,creditAccount} from '../lib/game.mjs';
import {fantasyQuote} from '../lib/bar-fanta-odds.mjs';
import {migrateFantasyWallets} from '../lib/bar-fanta-wallet.mjs';
import {readBarRows,writeBarRows} from '../lib/operations/bar-rows.mjs';

// Keep the old Bar IDs and accepted prices: a slip is a contract, even after
// the calendar starts being maintained by the native Fanta engine.
export function projectNativeBar(s,native,{now=Date.now()}={}){
 migrateFantasyWallets(s);
 let changed=migrateStraightScoring(s,now)?1:0;const at=new Date(now).toISOString();s.ledger??=[];
 for(const link of native.links){const league=s.leagues.find(l=>l.id===link.bar_league_id);if(!league)continue;const target={leagueId:link.fanta_league_id,competitionId:link.competition_id,...(Number.isInteger(link.max_members)?{maxMembers:link.max_members}:{}),coachIds:[...new Set(native.teams.filter(t=>t.league_id===link.fanta_league_id&&t.user_id).map(t=>t.user_id))]};if(!isDeepStrictEqual(league.nativeFantaLink,target)){league.nativeFantaLink=target;changed++;}
  const assets=(native.assets||[]).filter(a=>a.league_id===league.id&&a.competition_key===link.competition_key),media={};for(const a of assets){media[a.team_id]??={name:a.data.name||native.teams.find(t=>t.id.endsWith(':'+a.team_id))?.name||''};media[a.team_id][a.kind]='/api/bar-team-asset?'+new URLSearchParams({league:league.id,competition:link.competition_key,team:a.team_id,kind:a.kind,v:a.data.digest});}if(Object.keys(media).length){league.nativeFantaTeams??={};if(!isDeepStrictEqual(league.nativeFantaTeams[link.competition_key],media)){league.nativeFantaTeams[link.competition_key]=media;changed++;}}
  const fixtures=native.rounds.filter(r=>r.competition_id===link.competition_id),teams=native.teams.filter(t=>t.league_id===link.fanta_league_id),team=id=>teams.find(t=>t.id===id);
  for(const round of fixtures){const deadline=round.deadline instanceof Date?round.deadline.toISOString():round.deadline;
   if(s.rounds.filter(r=>r.league===league.id&&r.competitionKey===link.competition_key&&r.number===round.number).length>1)throw Error('Duplicate Bar rounds require review before native synchronization');
   let bar=s.rounds.find(r=>r.league===league.id&&r.competitionKey===link.competition_key&&r.number===round.number);
   if(!bar&&Date.parse(deadline)<Date.parse(link.cutover))continue;
   // Completed rounds before the cutover are an immutable historical record.
   if(bar?.settled&&!bar.nativeFanta)continue;
   const before=bar&&structuredClone(bar),matches=native.matchups.filter(m=>m.competition_id===round.competition_id&&m.round===round.number);
   if(!matches.length)continue;
   if(!bar){bar={id:id(),league:league.id,source:'fantacalcio',competitionKey:link.competition_key,competitionName:link.name,fantasyLeagueName:link.name,season:link.season,number:round.number,serieARound:round.seriea_round,title:'Giornata '+round.number,kickoff:deadline,created:at,matches:[],slips:[],settled:false,virtualBookmaker:true,requiresOfficialScores:true,rules:{...structuredClone(league.rules),initial:500,maxStake:Math.min(league.rules.maxStake,50)}};s.rounds.push(bar);}
   const projected=matches.map(m=>{const home=team(m.home_id),away=team(m.away_id),old=bar.matches.find(x=>x.nativeId===m.id||x.home===home.name&&x.away===away.name),result=native.results.find(x=>x.matchup_id===m.id),complete=!!(result?.official||result?.data?.calculation?.complete),score=result?[result.data.home.goals,result.data.away.goals]:null,points=result?[result.data.home.points,result.data.away.points]:null,started=now>=Date.parse(deadline);
    const details={complete,provisional:!complete,teams:[home,away].map((t,index)=>{const lineup=native.lineups.find(l=>l.competition_id===round.competition_id&&l.round===round.number&&l.team_id===t.id);return {id:(index?old?.awayId:old?.homeId)||t.id,nativeTeamId:t.id,name:t.name,formation:lineup?.formation||null,players:lineup?[...lineup.starters,...lineup.bench].map(id=>{const vote=(native.votes||[]).find(v=>v.player_id===id&&v.round===round.seriea_round)?.data;return {...native.players.find(p=>p.id===id),id,starter:lineup.starters.includes(id),grade:vote?.vote??null,fantagrade:vote?.fantavote??null,events:Object.entries(vote?.events||{}).flatMap(([label,n])=>Number.isInteger(n)&&n>0?Array.from({length:Math.min(10,n)},()=>({label:({goals:'Gol',assists:'Assist',yellow:'Ammonizione',red:'Espulsione',penSaved:'Rigore parato',penMissed:'Rigore sbagliato',ownGoals:'Autogol',conceded:'Gol subiti'})[label]||label})):[])};}):[]};})};
    const next={...old,id:old?.id||m.id,nativeId:m.id,home:home.name,away:away.name,homeId:old?.homeId||home.id,awayId:old?.awayId||away.id,kickoff:deadline,source:'fantacalcio',status:complete?'FT':started?'LIVE':'NS',score:complete?score:null,liveScore:started&&score?score:null,fantasyPoints:points,officialConfirmed:complete,details};
    if(!isDeepStrictEqual(old?.liveScore,next.liveScore)||!isDeepStrictEqual(old?.score,next.score))next.scoreUpdatedAt=at;
    const oldDetails=old?.details&&{...old.details};if(oldDetails)delete oldDetails.at;details.at=isDeepStrictEqual(oldDetails,details)?old.details.at:at;
    if(!old?.odds||!started&&!bar.slips.length){const quote=fantasyQuote(s.rounds.filter(r=>r.competitionKey===link.competition_key),bar,next);next.odds=quote.odds;next.oddsModel=quote.model;}return next;});
   if(bar.slips.length&&(bar.matches.length!==projected.length||bar.matches.some(m=>!projected.some(x=>x.id===m.id))))throw Error('Native Bar calendar conflicts with saved slips');
   const changedScore=bar.nativeFanta&&bar.settled&&bar.matches.some(m=>{const n=projected.find(n=>n.id===m.id);return !isDeepStrictEqual(m.score,n?.score);});
   if(changedScore){bar.pointScoring??='legacy';for(const slip of bar.slips){const member=[...league.members,...(league.removedMembers||[])].find(m=>m.uid===slip.uid);if(!member)throw Error('Missing owner of settled slip');if(slip.pointsSettled){member.competitionPoints??={};member.competitionPoints[bar.competitionKey]=(member.competitionPoints[bar.competitionKey]||0)-(slip.points||0);}if(slip.creditsSettled)creditAccount(league,bar,slip.uid).credits=Math.round((creditAccount(league,bar,slip.uid).credits-(slip.prize||0))*100)/100;slip.pointsSettled=false;slip.creditsSettled=false;slip.settled=false;}bar.settled=false;s.ledger.push({id:id(),league:league.id,amount:0,uid:null,reason:'Ricalcolo del nostro Fanta · giornata '+round.number,created:at});}
   Object.assign(bar,{nativeFanta:{leagueId:link.fanta_league_id,competitionId:link.competition_id},matches:projected,kickoff:deadline,closed:now>=Date.parse(deadline),calculated:projected.every(m=>m.status==='FT'),sourceConflict:false});
   migrateFantasyWallets(s,league.id);
   if(bar.calculated)settle(s,league,bar);
   if(!isDeepStrictEqual(before,bar)){bar.sourceUpdatedAt=at;changed++;}
  }
 }return changed;
}

// One targeted transaction after the shared calculation, never per client.
export async function syncNativeBar({connect=connection,now=Date.now(),onlyLeagueIds=null,sportsStorage='snapshot'}={}){
 const c=await connect();try{await c.query('BEGIN');await c.query('SELECT pg_advisory_xact_lock(826501)');
  const links=(await c.query(`SELECT b.*,l.name,l.season,l.max_members,l.auto_lineups_from AS cutover FROM fanta.bar_links b JOIN fanta.leagues l ON l.id=b.fanta_league_id WHERE b.active AND l.source_key IS NULL AND l.rules->>'disabledAt' IS NULL AND ($1::text[] IS NULL OR l.id=ANY($1::text[]))`,[onlyLeagueIds])).rows;if(!links.length){await c.query('COMMIT');return {changed:0};}
  const leagueIds=links.map(l=>l.fanta_league_id),competitions=links.map(l=>l.competition_id),native={links};
  native.assets=(await c.query("SELECT league_id,competition_key,team_id,kind,data-'data' AS data FROM fanta.bar_assets WHERE league_id=ANY($1::text[])",[links.map(l=>l.bar_league_id)])).rows;
  for(const table of ['teams','rounds','matchups','lineups'])native[table]=(await c.query('SELECT * FROM fanta.'+table+' WHERE league_id=ANY($1::text[])',[leagueIds])).rows;
  native.results=(await c.query('SELECT r.* FROM fanta.results r JOIN fanta.matchups m ON m.id=r.matchup_id WHERE m.competition_id=ANY($1::text[])',[competitions])).rows;
  native.players=(await c.query('SELECT DISTINCT p.id,p.name,p.role,c.name AS club FROM fanta.players p JOIN fanta.clubs c ON c.id=p.club_id JOIN fanta.lineups l ON l.league_id=ANY($1::text[]) AND (l.starters?p.id OR l.bench?p.id)',[leagueIds])).rows;
  native.votes=(await c.query("SELECT DISTINCT ON(v.player_id,f.round) v.player_id,f.round,v.data FROM fanta.votes v JOIN fanta.fixtures f ON f.id=v.fixture_id WHERE f.round=ANY($1::int[]) AND f.season=$2 AND v.model_key=coalesce((SELECT data->>'key' FROM fanta.jobs WHERE id='votes:active-model'),v.model_key) ORDER BY v.player_id,f.round,v.id DESC",[[...new Set(native.rounds.filter(r=>Date.parse(r.deadline)>=Math.min(...links.map(l=>Date.parse(l.cutover)))-7*86400000).map(r=>r.seriea_round))],links[0].season])).rows;
  const linked=links.map(l=>l.bar_league_id);
  const rowStorage=sportsStorage==='rows';
  const state=rowStorage?await readBarRows(c,{leagueIds:linked}):(await c.query(`SELECT jsonb_build_object('leagues',(SELECT coalesce(jsonb_agg(l),'[]') FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'=ANY($1::text[])),'rounds',(SELECT coalesce(jsonb_agg(r),'[]') FROM jsonb_array_elements(payload->'rounds') r WHERE r->>'league'=ANY($1::text[])),'ledger','[]'::jsonb) AS data FROM fanta_state WHERE id=1`,[linked])).rows[0]?.data;
  const previous=rowStorage?structuredClone(state):null;
  const changed=state?projectNativeBar(state,native,{now}):0;
  if(changed&&rowStorage)await writeBarRows(c,previous,state);
  else if(changed){
   const {rows:[current]}=await c.query('SELECT payload FROM fanta_state WHERE id=1 FOR UPDATE');
   const payload=current?.payload;
   if(!payload)throw Error('Bar state unavailable');
   const linkedIds=new Set(links.map(l=>l.bar_league_id));
   const leagueUpdates=new Map(state.leagues.map(l=>[l.id,l]));
   payload.leagues=(payload.leagues??[]).map(l=>leagueUpdates.get(l.id)??l);
   payload.rounds=(payload.rounds??[]).filter(r=>!linkedIds.has(r.league)).concat(state.rounds);
   payload.ledger=(payload.ledger??[]).concat(state.ledger);
   await c.query('UPDATE fanta_state SET payload=$1::jsonb WHERE id=1',[JSON.stringify(payload)]);
  }
  await c.query('COMMIT');return {changed};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}finally{c.release();}
}
