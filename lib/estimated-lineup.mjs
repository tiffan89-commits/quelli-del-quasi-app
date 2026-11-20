import {isUnavailable} from '../public/src/fanta/presence-probability.mjs';
import {partialPitchRows} from '../public/src/pitch-layout.mjs';
export const ESTIMATED_XI_MODEL='presence-ranked-xi-v1';
const role=p=>{const r=String(p.role||p.position||'').toUpperCase();return /^(P|G|GK|GOALKEEPER)$/.test(r)?'P':/^(D|DEFENDER)$/.test(r)?'D':/^(C|M|MIDFIELDER)$/.test(r)?'C':/^(A|F|FW|ATTACKER|FORWARD)$/.test(r)?'A':null;};
const key=p=>String(p.apiId||p.playerId||p.id||p.name||'').replace(/^af:/,'');
const absent=p=>p.active===false||isUnavailable(p.availability||p.status?.type);
const pct=p=>Number.isFinite(p.probability)?p.probability:null;
const byEstimate=(a,b)=>(pct(b)??-1)-(pct(a)??-1)||String(a.name).localeCompare(String(b.name),'it');
const withoutGrid=p=>{const {grid,...rest}=p;return rest;};
// Optimize each compatible role, not the formation itself. A promoted player
// inherits the selected slot, including its flank. Ties keep the source XI.
export function selectEstimatedLineup(team){
 const base=team.players.map(p=>({...p})),players=base.map(p=>({...p})),selected=new Set(players.map(key)),seen=new Set(),changes=[];
 let available=(team.bench||[]).filter(p=>{const id=key(p);if(!id||seen.has(id)||selected.has(id)||absent(p))return false;seen.add(id);return true;}).map(withoutGrid);
 const replace=(i,candidate,reason)=>{const old=players[i];players[i]={...withoutGrid(candidate),...(old.grid?{grid:old.grid}:{})};available=available.filter(p=>key(p)!==key(candidate));if(!absent(old))available.push(withoutGrid(old));changes.push({out:key(old),in:key(candidate),outName:old.name,inName:candidate.name,slot:old.grid||null,from:pct(old),to:pct(candidate),reason});};
 for(const category of ['P','D','C','A']){
  const slots=players.map((p,i)=>({p,i})).filter(({p})=>role(p)===category).sort((a,b)=>Number(absent(b.p))-Number(absent(a.p))||(pct(a.p)??Infinity)-(pct(b.p)??Infinity)||a.i-b.i);
  for(const {i}of slots){const old=players[i],candidate=available.filter(p=>role(p)===category&&(absent(old)||pct(p)!==null)).sort(byEstimate)[0];
   if(candidate&&(absent(old)||pct(old)!==null&&pct(candidate)>pct(old)))replace(i,candidate,absent(old)?'unavailable':'higher-estimate');
  }
 }
 // A starter rejected by the catalog can leave a hole in a known formation.
 // Fill it only when that line identifies the role and a reserve has an estimate.
 available.sort(byEstimate);
 const rows=partialPitchRows({...team,players});
 rows?.forEach((row,line)=>{
  const roles=new Set(row.filter(Boolean).map(role));
  const category=line===0?'P':roles.size===1?[...roles][0]:null;
  if(!category)return;
  row.forEach((player,column)=>{
   if(player)return;
   const index=available.findIndex(p=>role(p)===category&&pct(p)>0);
   if(index<0)return;
   const [candidate]=available.splice(index,1),grid=`${line+1}:${column+1}`;
   players.push({...candidate,grid});
   changes.push({out:null,in:key(candidate),outName:null,inName:candidate.name,slot:grid,from:null,to:pct(candidate),reason:'vacant-slot'});
  });
 });
 return {...team,forecastBase:base,players:players.filter(p=>!absent(p)),bench:available,xiModel:ESTIMATED_XI_MODEL,selectionChanges:changes};
}
