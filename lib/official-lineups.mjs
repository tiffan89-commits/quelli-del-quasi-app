import {isDeepStrictEqual} from 'node:util';
import {normalizeTeam} from './calendar.mjs';
import {normalizePitchLayout} from '../public/src/pitch-layout.mjs';
// API-Football supplies the XI and substitutes, independently of match statistics.
export function officialLineups(raw,at=new Date().toISOString()){
 const rows=raw?.lineups;
 if(!Array.isArray(rows)||rows.length!==2)return null;
 const sides=['home','away'];
 const teams=sides.map(side=>{
  const expected=raw.teams?.[side],row=rows.find(r=>expected?.id!=null?Number(r.team?.id)===Number(expected.id):normalizeTeam(r.team?.name)===normalizeTeam(expected?.name));
  if(!row||row.startXI?.length!==11)return null;
  const convert=(x,starter)=>({id:'af:'+x.player.id,apiId:x.player.id,name:x.player.name,jersey:x.player.number??'',position:x.player.pos||'',grid:x.player.grid||null,probability:starter?100:0,probabilityKind:'official'});
  const players=row.startXI.map(x=>convert(x,true));
  if(players.some(p=>!p.name||!Number.isInteger(Number(p.apiId)))||new Set(players.map(p=>p.id)).size!==11)return null;
  return normalizePitchLayout({team:expected?.name||row.team.name,side,formation:row.formation||null,pitchOrder:'right-to-left',players,bench:(row.substitutes||[]).map(x=>convert(x,false)),ballots:[],unavailable:[]});
 });
 return teams.every(Boolean)?{kind:'official',source:'API-FOOTBALL',method:'official-api-v1',teams,updatedAt:at}:null;
}

export function sameOfficialLineups(a,b){
 if(a?.kind!=='official'||a.source!=='API-FOOTBALL')return false;
 const shape=l=>l.teams.map(t=>({team:normalizeTeam(t.team),formation:t.formation,layoutVersion:t.layoutVersion,pitchOrder:t.pitchOrder,players:t.players.map(p=>({id:String(p.apiId||p.id).replace(/^af:/,''),number:String(p.jersey??''),name:p.name,grid:p.grid,position:p.position})),bench:(t.bench||[]).map(p=>({id:String(p.apiId||p.id).replace(/^af:/,''),number:String(p.jersey??''),name:p.name}))}));
 return isDeepStrictEqual(shape(a),shape(b));
}
