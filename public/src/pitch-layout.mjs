export const PITCH_LAYOUT_VERSION=1;
const parts=formation=>{const p=String(formation||'').split('-').map(Number);return p.length&&p.every(n=>Number.isInteger(n)&&n>0&&n<=5)&&p.reduce((a,b)=>a+b,0)===10?[1,...p]:null;};
// Canonical view: goalkeeper below, attacking upwards; every line is left→right.
// Provider grid coordinates take precedence over the ordering of its JSON array.
export function explicitPitchRows(team){
 if(team.players?.length!==11)return null;
 const rows=new Map(),seen=new Set();
 for(const p of team.players){const m=/^([1-6]):([1-5])$/.exec(String(p.grid||''));if(!m||seen.has(m[0]))return null;seen.add(m[0]);const r=Number(m[1]),c=Number(m[2]);if(!rows.has(r))rows.set(r,[]);rows.get(r).push({p,c});}
 if(rows.get(1)?.length!==1||!seen.has('1:1'))return null;
 const out=[];for(let r=1;r<=rows.size;r++){const row=rows.get(r);if(!row)return null;row.sort((a,b)=>a.c-b.c);if(row.some((p,i)=>p.c!==i+1))return null;out.push(row.map(x=>x.p));}return out;
}
export function canonicalPitchRows(team){
 const explicit=explicitPitchRows(team);if(explicit)return explicit;
 const counts=parts(team.formation);if(!counts||team.players?.length!==11)return null;
 let cursor=0;return counts.map(n=>{const row=team.players.slice(cursor,cursor+n);cursor+=n;return team.pitchOrder==='right-to-left'?row.reverse():row;});
}
export function normalizePitchLayout(team,{defaultOrder='left-to-right'}={}){
 const explicit=explicitPitchRows(team),rows=explicit||canonicalPitchRows({...team,pitchOrder:team.pitchOrder||defaultOrder});if(!rows)return team;
 const source=explicit?(team.layoutVersion===PITCH_LAYOUT_VERSION?team.layoutSource||'grid':'grid'):'source-order';
 return {...team,formation:rows.slice(1).map(r=>r.length).join('-'),players:rows.flatMap((row,r)=>row.map((p,c)=>({...p,grid:`${r+1}:${c+1}`}))),pitchOrder:'left-to-right',layoutVersion:PITCH_LAYOUT_VERSION,layoutSource:source,...(source==='source-order'?{layoutSourceOrder:team.layoutSourceOrder||team.pitchOrder||defaultOrder}:{})};
}
