import {isUnavailable} from '../public/src/fanta/presence-probability.mjs';
import {canonicalPitchRows,partialPitchRows,pitchPositionRole} from '../public/src/pitch-layout.mjs';

export const ESTIMATED_XI_MODEL='source-positions-xi-v2';
const key=p=>String(p.apiId||p.playerId||p.id||p.name||'').replace(/^af:/,'');
const absent=p=>p.active===false||isUnavailable(p.availability||p.status?.type);
const pct=p=>Number.isFinite(p.probability)?p.probability:null;
const position=p=>pitchPositionRole(p.footballPosition)||pitchPositionRole(p.position);
const sourceSupport=p=>p.consensus?.hits??0;
const byEstimate=(a,b)=>sourceSupport(b)-sourceSupport(a)||(pct(b)??-1)-(pct(a)??-1)||String(a.name).localeCompare(String(b.name),'it');
const withoutGrid=p=>{const {grid,...rest}=p;return rest;};

// Keep the source XI and its coordinates. Use football positions only to cover a vacancy.
export function selectEstimatedLineup(team){
 const base=team.players,selected=new Set(base.map(key)),changes=[],available=[];
 for(const p of team.bench||[]){
  const id=key(p);
  if(!id||selected.has(id)||absent(p))continue;
  selected.add(id);available.push(withoutGrid(p));
 }
 const candidates=available.filter(p=>sourceSupport(p)>0||pct(p)>0).sort(byEstimate);
 const rows=canonicalPitchRows(team)||partialPitchRows(team);
 const slots=rows?rows.flatMap((row,line)=>{
  const role=['P','D'][line]||(line===rows.length-1?'A':'C');
  return row.map((player,column)=>({player,role,grid:`${line+1}:${column+1}`}));
 }):base.map(player=>({player,role:position(player),grid:player.grid}));
 const promoted=new Set();
 const players=slots.flatMap(({player,role,grid})=>{
  if(player&&!absent(player))return [grid&&player.grid!==grid?{...player,grid}:player];
  const reserve=role&&candidates.find(p=>position(p)===role&&!promoted.has(key(p)));
  if(!reserve)return [];
  promoted.add(key(reserve));
  changes.push({out:player?key(player):null,in:key(reserve),outName:player?.name??null,inName:reserve.name,slot:grid||null,from:player?pct(player):null,to:pct(reserve),reason:player?'unavailable':'vacant-slot'});
  return [{...reserve,...(grid?{grid}:{})}];
 });
 return {...team,forecastBase:base,players,bench:available.filter(p=>!promoted.has(key(p))),xiModel:ESTIMATED_XI_MODEL,selectionChanges:changes};
}
