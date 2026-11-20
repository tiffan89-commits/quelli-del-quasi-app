import {isDeepStrictEqual} from 'node:util';
import {normalizeTeam} from './calendar.mjs';
import {normalizePitchLayout} from '../public/src/pitch-layout.mjs';
import {cleanLineupTeam} from './lineup-quality.mjs';
// API-Football supplies the XI and substitutes, independently of match statistics.
export function officialLineups(raw,at=new Date().toISOString(),{report}={}){
 const rows=raw?.lineups;
 if(!Array.isArray(rows)||rows.length!==2)return null;
 const sides=['home','away'];
 const teams=sides.map(side=>{
  const expected=raw.teams?.[side],row=rows.find(r=>expected?.id!=null?Number(r.team?.id)===Number(expected.id):normalizeTeam(r.team?.name)===normalizeTeam(expected?.name));
  if(!row||row.startXI?.length!==11)return null;
  const convert=(x,starter)=>{
   const p=x?.player;
   if(!p?.name||!Number.isSafeInteger(Number(p.id))||Number(p.id)<1){
    report?.({code:'invalid-official-player',team:expected?.name||row.team.name,section:starter?'XI':'bench',players:[{id:p?.id,name:p?.name}]});
    return null;
   }
   return {id:'af:'+p.id,apiId:p.id,name:p.name,jersey:p.number??'',position:p.pos||'',grid:p.grid||null,probability:starter?100:0,probabilityKind:'official'};
  };
  const players=row.startXI.map(x=>convert(x,true)).filter(Boolean);
  const team=cleanLineupTeam({team:expected?.name||row.team.name,side,formation:row.formation||null,pitchOrder:'right-to-left',players,bench:(row.substitutes||[]).map(x=>convert(x,false)).filter(Boolean),ballots:[],unavailable:[]},report);
  return team.players.length===11?normalizePitchLayout(team):null;
 });
 return teams.every(Boolean)?{kind:'official',source:'API-FOOTBALL',method:'official-api-v1',teams,updatedAt:at}:null;
}

export function sameOfficialLineups(a,b){
 if(a?.kind!=='official'||a.source!=='API-FOOTBALL')return false;
 const shape=l=>l.teams.map(t=>({team:normalizeTeam(t.team),formation:t.formation,layoutVersion:t.layoutVersion,pitchOrder:t.pitchOrder,players:t.players.map(p=>({id:String(p.apiId||p.id).replace(/^af:/,''),number:String(p.jersey??''),name:p.name,grid:p.grid,position:p.position})),bench:(t.bench||[]).map(p=>({id:String(p.apiId||p.id).replace(/^af:/,''),number:String(p.jersey??''),name:p.name}))}));
 return isDeepStrictEqual(shape(a),shape(b));
}
