export const PITCH_LAYOUT_VERSION=1;
const footballPositions={P:'P',G:'P',GK:'P',GOALKEEPER:'P',PORTIERE:'P',D:'D',DF:'D',DEFENDER:'D',DIFENSORE:'D',C:'C',M:'C',MF:'C',MIDFIELDER:'C',CENTROCAMPISTA:'C',A:'A',F:'A',FW:'A',ATTACKER:'A',FORWARD:'A',ATTACCANTE:'A'};
export const pitchPositionRole=position=>footballPositions[String(position||'').toUpperCase()]||null;
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
export function partialPitchRows(team){
 const counts=parts(team.formation),players=team.players||[];
 if(!counts||!players.length||players.length>=11)return null;
 const rows=counts.map(n=>Array(n).fill(null));
 for(const player of players){
  const coordinates=/^([1-6]):([1-5])$/.exec(String(player.grid||''));
  if(!coordinates)return null;
  const [,line,position]=coordinates,row=rows[Number(line)-1],slot=Number(position)-1;
  if(!row||slot>=row.length||row[slot])return null;
  row[slot]=player;
 }
 return rows;
}
export function normalizePitchLayout(team,{defaultOrder='left-to-right'}={}){
 const explicit=explicitPitchRows(team),rows=explicit||canonicalPitchRows({...team,pitchOrder:team.pitchOrder||defaultOrder});if(!rows)return team;
 const source=explicit?(team.layoutVersion===PITCH_LAYOUT_VERSION?team.layoutSource||'grid':'grid'):'source-order';
 return {...team,formation:rows.slice(1).map(r=>r.length).join('-'),players:rows.flatMap((row,r)=>row.map((p,c)=>({...p,grid:`${r+1}:${c+1}`}))),pitchOrder:'left-to-right',layoutVersion:PITCH_LAYOUT_VERSION,layoutSource:source,...(source==='source-order'?{layoutSourceOrder:team.layoutSourceOrder||team.pitchOrder||defaultOrder}:{})};
}

const playerKey=p=>String(p?.apiId??p?.id??'').replace(/^af:/,'');
const teamKey=name=>String(name||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Restore coordinates from the cached official XI, never from the statistics-array order.
export function recoverOfficialPitchLayout(lineups,sourceRows){
 if(!lineups?.teams?.length||!Array.isArray(sourceRows)||!sourceRows.length)return lineups;
 const validated=lineups.method==='official-api-v1';
 let recovered=0;
 const teams=lineups.teams.map(t=>{
  const pool=[...(t.players||[]),...(t.bench||[])],ids=new Set(pool.map(playerKey));
  const row=sourceRows.find(r=>r.startXI?.length===11&&(teamKey(r.team?.name)===teamKey(t.team)&&teamKey(t.team)||r.startXI.filter(x=>ids.has(String(x?.player?.id))).length>=9));
  if(!row)return t;
  const convert=(entry,probability)=>{
   const p=entry?.player,previous=pool.find(x=>playerKey(x)===String(p?.id));
   if(!p?.id||!p.name||validated&&!previous)return null;
   const number=validated?previous.jersey:p.number??previous?.jersey;
   return {...previous,id:'af:'+p.id,apiId:p.id,name:previous?.name||p.name,jersey:/^[1-9][0-9]?$/.test(String(number))?number:'',position:p.pos||'',grid:p.grid||null,probability,probabilityKind:'official'};
  };
  const players=row.startXI.map(p=>convert(p,100)).filter(Boolean),seen=new Set(players.map(playerKey));
  if(players.length!==11||seen.size!==11)return t;
  const bench=[];
  for(const entry of row.substitutes||[]){
   const p=convert(entry,0);if(!p||seen.has(playerKey(p)))continue;
   seen.add(playerKey(p));bench.push(p);
  }
  const jerseys=new Map();
  for(const p of [...players,...bench])if(p.jersey)jerseys.set(String(p.jersey),(jerseys.get(String(p.jersey))||0)+1);
  for(const p of [...players,...bench])if(jerseys.get(String(p.jersey))>1)p.jersey='';
  recovered++;
  return normalizePitchLayout({...t,formation:row.formation,players,bench,pitchOrder:'right-to-left'});
 });
 return recovered?{...lineups,kind:recovered===teams.length?'official':lineups.kind,teams}:lineups;
}
