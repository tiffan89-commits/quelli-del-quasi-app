import {normalizePersonName} from '../fanta/player-identities.mjs';
import {normalizedPlayerLabel,playerDisplayName} from '../public/src/player-label.mjs';

export const lineupPlayerId=p=>String(p?.apiId||p?.api_id||p?.playerId||p?.id||'').replace(/^(?:af:|apifootball:|api-football:)/,'');
export const validJersey=value=>/^[1-9][0-9]?$/.test(String(value))?String(value):'';
const parts=name=>normalizePersonName(normalizedPlayerLabel(name)).split(' ').filter(Boolean);
const fullNames=p=>[p.name,p.shirtName,p.fullName,...(p.aliases||[])].map(parts).filter(x=>x.length);
const names=p=>[...fullNames(p),...[p.surname,p.lastName].filter(Boolean).map(parts)];
const isInitial=token=>/^[a-z]$/.test(token);
const compact=tokens=>tokens.filter(n=>!isInitial(n)).join(' ');
function matchName(query,candidate){
 const sought=query.filter(t=>!isInitial(t)),actual=candidate.filter(t=>!isInitial(t));
 if(!sought.length||!actual.length)return false;
 if(sought.length===1&&sought[0].length<4&&sought.join(' ')!==actual.join(' '))return false;
 const first=query.find(isInitial),index=actual.findIndex((_,i)=>sought.every((t,j)=>t===actual[i+j]));
 if(index<0)return false;
 if(!first)return true;
 const initials=candidate.filter(isInitial);
 return initials.length?initials.includes(first):index===0&&actual.length===sought.length||index>0&&actual[0][0]===first;
}

export function resolveLineupPlayer(player,club){
 const id=lineupPlayerId(player);
 if(id){
  const matches=club.filter(p=>lineupPlayerId(p)===id);
  return {record:matches.length===1?matches[0]:null,reason:matches.length>1?'ambiguous-player':'unknown-player-id'};
 }
 const queries=fullNames(player);
 const exact=club.filter(p=>fullNames(p).some(n=>queries.some(query=>query.join(' ')===n.join(' '))));
 const candidates=exact.length?exact:club.filter(p=>names(p).some(n=>queries.some(query=>matchName(query,n))));
 return {record:candidates.length===1?candidates[0]:null,reason:candidates.length>1?'ambiguous-player':'unknown-player'};
}

export function forecastJersey(player,record,report){
 const fixed=validJersey(record?.verifiedNumber);
 const values=[['probabile',validJersey(player.jersey)],['API-Football /players/squads',validJersey(record?.number)],
  ['API-Football /players',validJersey(record?.seasonNumber)]].filter(([,number])=>number);
 const claims=new Map();
 for(const [,number] of values)claims.set(number,(claims.get(number)||0)+1);
 if(claims.size<2&&(!fixed||!claims.size||claims.has(fixed)))return fixed||values[0]?.[1]||'';
 const [best,votes]=[...claims.entries()].sort((a,b)=>b[1]-a[1])[0];
 const number=fixed||(votes>=2?best:'');
 report?.({code:'conflicting-jersey',team:record?.club,players:[{name:record?.name||player.name,id:lineupPlayerId(record??player)}],numbers:Object.fromEntries(values),displayed:number});
 return number;
}

// An unresolved collision removes the number, while preserving the player's name and identity.
export function cleanLineupTeam(team,report){
 const players=[],bench=[],seen=[];
 const clean=(input,output,section)=>{
  for(const p of input||[]){
   const id=lineupPlayerId(p),tokens=parts(p?.name),name=compact(tokens);
   if(!name){report?.({team:team.team,code:'missing-player-name',section,players:[{id}]});continue;}
   const initial=tokens.find(isInitial);
   const previous=seen.find(x=>id&&x.id?id===x.id
    :(!initial||!x.initial||initial===x.initial)&&(name===x.name||Boolean(id||x.id)&&(matchName(tokens,x.tokens)||matchName(x.tokens,tokens))));
   if(previous){report?.({team:team.team,code:'duplicate-player',section,players:[{id,name:p.name},{id:previous.id,name:previous.player.name}]});continue;}
   const {number:rawNumber,...data}=p,rawJersey=p.jersey??rawNumber;
   const label=playerDisplayName(p);
   if(/\ufffd|&[a-z][a-z0-9]+;/iu.test(label)){report?.({team:team.team,code:'invalid-player-label',section,players:[{id,name:p.name}]});continue;}
   const player={...data,name:label,jersey:validJersey(rawJersey)?rawJersey:''};
   if((p.jersey??p.number)&&!player.jersey)report?.({team:team.team,code:'invalid-jersey',section,players:[{id,name:p.name}],number:String(p.jersey??p.number)});
   seen.push({id,name,tokens,initial,player});output.push(player);
  }
 };
 clean(team.players,players,'XI');
 clean(team.bench,bench,'bench');
 const numbers=new Map();
 for(const {player} of seen)if(player.jersey){
  const number=String(player.jersey);
  if(!numbers.has(number))numbers.set(number,[]);
  numbers.get(number).push(player);
 }
 for(const [number,claimants] of numbers)if(claimants.length>1){
  report?.({team:team.team,code:'duplicate-jersey',number,players:claimants.map(p=>({id:lineupPlayerId(p),name:p.name}))});
  const confirmed=claimants.filter(p=>p.numberVerified===true);
  for(const p of claimants)if(confirmed.length!==1||p!==confirmed[0])p.jersey='';
 }
 return {...team,players,bench};
}
