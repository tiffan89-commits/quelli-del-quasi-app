import {KITS} from './fanta/maglie.mjs';
import {esc,fixtureTime} from './fanta/formato.mjs';
const particles=/^(?:d[aeiou]|de|del|della|di|dos|das|van|von|der|den|el|al|la|le)$/i;
const abbreviated=word=>/^\p{L}\.$/u.test(word);
const familiarNames={'386305':'Ramón','288112':'Kambwala'};
const entities={amp:'&',apos:"'",quot:'"',lsquo:'‘',rsquo:'’',nbsp:' ',oslash:'ø',Oslash:'Ø',aelig:'æ',AElig:'Æ',szlig:'ß'};
const accents={acute:'\u0301',grave:'\u0300',circ:'\u0302',tilde:'\u0303',uml:'\u0308',cedil:'\u0327',ring:'\u030a',caron:'\u030c'};
export function normalizedPlayerLabel(value){
 let text=String(value??'').replace(/&(#(?:x[0-9a-f]+|[0-9]+)|[a-z][a-z0-9]+);/gi,(match,token)=>{
  if(token.startsWith('#')){
   const n=token[1]?.toLowerCase()==='x'?parseInt(token.slice(2),16):Number(token.slice(1));
   return n>0&&n<=0x10ffff&&!(n>=0xd800&&n<=0xdfff)?String.fromCodePoint(n):'';
  }
  return entities[token]??(accents[token.slice(1)]?token[0]+accents[token.slice(1)]:match);
 });
 text=text.replace(/[\u00c2-\u00f4][\u0080-\u00bf]+/g,chunk=>{
  try{return new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(chunk,c=>c.charCodeAt(0)));}
  catch{return chunk;}
 });
 return text.normalize('NFC').replace(/[\u0000-\u001f\u007f-\u009f]/g,' ').replace(/\s+/g,' ').trim();
}
function familiarName(p){
 const id=String(p.apiId||p.api_id||p.playerId||p.id||'').replace(/^(?:af:|apifootball:|api-football:)/,'');
 const label=normalizedPlayerLabel(p.name);
 return familiarNames[id]||(/^(?:Jacobo|J\.)\s+Ram[oó]n(?: Naveros)?$/iu.test(label)?'Ramón':normalizedPlayerLabel(p.knownAs));
}
export const playerDisplayName=p=>familiarName(p)||normalizedPlayerLabel(p.name);
export function playerSurname(player){
 const p=typeof player==='string'?{name:player}:player||{};
 const known=familiarName(p);if(known)return known;
 const family=p.surname||p.lastName||p.lastname||p.last_name;
 const words=normalizedPlayerLabel(family||p.name).split(/\s+/).filter(Boolean);
 if(!words.length)return "";
 if(!family){
  if(words.length>1&&abbreviated(words.at(-1)))words.pop();
  else if(words.length>1&&!abbreviated(words[0])&&!particles.test(words[0])&&!/^(Kolo Muani|Zambo Anguissa)$/i.test(words.join(" ")))words.shift();
  else if(words.length>1&&abbreviated(words[0]))words.shift();
 }
 const name=[words.shift()];
 while(words.length&&particles.test(name.at(-1)))name.push(words.shift());
 if(words.length&&abbreviated(name.at(-1)))name.push(words.shift());
 return name.join(' ').replace(/[^\p{L}\p{M}\p{N}\s.'’\u2010\u2011-]/gu,'');
}
export const playerJersey=p=>[
 p?.clubId&&p.verifiedJersey?.clubId===p.clubId&&(!p.season||p.season===p.verifiedJersey.season)?p.verifiedJersey.number:null,
 p?.jersey,p?.number,p?.seasonStats?.games?.number,
].find(n=>/^[1-9][0-9]?$/.test(String(n)))??'';

export const opponentLabel=n=>n?.opponent?`${n.home?'':'@ '}${KITS[({'AC Milan':'Milan','AS Roma':'Roma','Hellas Verona':'Verona'})[n.opponent]||n.opponent]?.code||String(n.opponent).slice(0,3).toUpperCase()}`:'–';

export function pitchFixture(player){
 const opponent=player.next?.opponent||player.opponent;
 const kickoff=player.next?.kickoff||player.kickoff;
 const label=opponent&&opponent!=='Da definire'?opponentLabel({opponent,home:player.next?.home??player.home}).replace('@ ','@'):'';
 const time=Number.isFinite(Date.parse(kickoff))?fixtureTime(kickoff):'';
 if(!label&&!time)return '';
 return `<span class="pitch-fixture" data-pitch-fixture>${label?`<small class="pitch-next-opponent">${esc(label)}</small>`:''}${time?`<small class="pitch-next-kickoff">${esc(time)}</small>`:''}</span>`;
}
