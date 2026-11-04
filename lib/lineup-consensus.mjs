import {normalizeTeam} from './calendar.mjs';
import {normalizePitchLayout} from '../public/src/pitch-layout.mjs';
const words=n=>{let s=String(n||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();const trailing=s.match(/\s+((?:[a-z]{1,2}\.)+)$/);if(trailing)s=trailing[1]+' '+s.slice(0,-trailing[0].length);const t=s.replace(/[^a-z0-9]+/g,' ').trim().split(' ');if(t.length>1&&t.at(-1).length===1)t.unshift(t.pop());return t;};
function equivalent(a,b){const x=words(a),y=words(b),xc=x.filter(t=>t.length>1),yc=y.filter(t=>t.length>1);if(x.length>1&&y.length>1&&x[0].length===1&&y[0].length===1&&x[0]!==y[0])return false;if(x.join('')===y.join('')||xc.join('')===yc.join(''))return true;const short=x.length<=y.length?x:y,long=x.length<=y.length?y:x;if(short.length===1)return short[0].length>=3&&long.at(-1)===short[0];return x.at(-1)===y.at(-1)&&x[0][0]===y[0][0]&&x.at(-1).length>=3;}
export function consensusLineups(input){
 const sources=input.filter((s,i,a)=>s&&s.kind!=='official'&&s.teams?.length===2&&s.teams.every(t=>t.players.length===11)&&a.findIndex(x=>x?.source===s.source)===i);
 const official=input.find(s=>s?.kind==='official');if(official)return official;
 if(!sources.length)return null;
 const primary=sources[0];
 const teams=primary.teams.map(base=>{
  const predictions=sources.map(s=>s.teams.find(t=>normalizeTeam(t.team)===normalizeTeam(base.team))).filter(Boolean),pool=[];
  const resolve=p=>{let found=pool.filter(x=>words(x.name).join('')===words(p.name).join(''));if(!found.length)found=pool.filter(x=>equivalent(x.name,p.name));if(found.length===1)return found[0];const row={...p,key:pool.length,votes:new Set()};pool.push(row);return row;};
  const lists=predictions.map(t=>({team:t,starters:t.players.map(p=>resolve(p)),bench:(t.bench||[]).map(p=>resolve(p))}));
  lists.forEach((l,i)=>new Set(l.starters).forEach(p=>p.votes.add(i)));
  const total=predictions.length,prob=p=>Math.round(p.votes.size/total*100),serialize=p=>{const {key,votes,probability,probabilityKind,...rest}=p;return {...rest,probability:prob(p),probabilityKind:'consensus',consensus:{hits:votes.size,total}};};
  // Select the most supported complete XI, preserving a real formation and player order.
  const chosen=[...lists].sort((a,b)=>b.starters.reduce((s,p)=>s+p.votes.size,0)-a.starters.reduce((s,p)=>s+p.votes.size,0))[0];
  const starters=[...chosen.starters],ballots=[],seen=new Set();
  for(const t of predictions)for(const b of t.ballots||[]){const candidates=b.players.map(p=>pool.find(x=>equivalent(x.name,p.name))).filter(Boolean);if(candidates.length<2||new Set(candidates).size!==candidates.length)continue;const id=candidates.map(p=>p.key).sort((a,b)=>a-b).join(':');if(seen.has(id))continue;seen.add(id);
   // A pair that appears together in an XI is not a mutually exclusive duel.
   if(lists.some(l=>candidates.filter(p=>l.starters.includes(p)).length>1))continue;
   const selected=candidates.filter(p=>starters.includes(p));if(selected.length===1){const best=[...candidates].sort((a,b)=>b.votes.size-a.votes.size)[0];if(best.votes.size>selected[0].votes.size&&!starters.includes(best))starters[starters.indexOf(selected[0])]=best;}
   if(candidates.every(p=>prob(p)===0)||candidates.some(p=>prob(p)===100))continue;
   ballots.push({kind:'consensus',players:candidates.map(serialize),otherProbability:Math.max(0,100-candidates.reduce((s,p)=>s+prob(p),0))});
  }
  // Find alternatives not explicitly listed as ballots, only when sources exchange
  // one player for another and never start the two together (no arbitrary role duels).
  for(const a of starters.filter(p=>p.votes.size>0&&p.votes.size<total)){
   if(ballots.some(b=>b.players.some(p=>equivalent(p.name,a.name))))continue;
   const alternatives=pool.filter(b=>b!==a&&b.votes.size>0&&!starters.includes(b)&&lists.every(l=>!(l.starters.includes(a)&&l.starters.includes(b)))&&lists.some(l=>l.starters.includes(b)&&chosen.starters.filter(p=>!l.starters.includes(p)).length===1));
   if(alternatives.length===1){const b=alternatives[0];ballots.push({kind:'consensus',players:[serialize(a),serialize(b)],otherProbability:Math.max(0,100-prob(a)-prob(b))});}
  }
  const unavailable=[];for(const t of predictions)for(const p of t.unavailable||[])if(!unavailable.some(x=>equivalent(x.name,p.name)))unavailable.push({name:p.name,status:p.status});
  // Coordinates belong to the selected source's formation, never to the first
  // pooled occurrence of a player in another source/module. A replacement takes
  // the slot of the selected player; broad fantasy roles do not decide its flank.
  const players=starters.map((p,i)=>{const row=serialize(p),slot=chosen.team.players[i];delete row.grid;return {...row,...(slot?.grid?{grid:slot.grid}:{})};});
  return normalizePitchLayout({...base,formation:chosen.team.formation,pitchOrder:chosen.team.pitchOrder||'left-to-right',players,bench:pool.filter(p=>!starters.includes(p)).sort((a,b)=>b.votes.size-a.votes.size).map(serialize),ballots,unavailable,sourceCount:total});
 });
 return {kind:'probable',source:'Confronto probabili',sources:sources.map(s=>s.source),sourceCount:sources.length,method:'starter-votes-v1',teams};
}
// Public DTOs contain the count, never editorial names, URLs or private diagnostics.
export function publicLineups(lineups){
 if(!lineups)return lineups;
 const {source,sourceUrl,sources,...safe}=lineups;
 return {...safe,sourceCount:lineups.sourceCount||sources?.length||(source?1:0),teams:lineups.teams.map(t=>({...t,ballots:(t.ballots||[]).map(({note,...b})=>b),unavailable:(t.unavailable||[]).map(({note,...p})=>p)}))};
}
