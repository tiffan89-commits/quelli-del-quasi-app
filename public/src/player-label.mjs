import {KITS} from './fanta/maglie.mjs';
import {esc,fixtureTime} from './fanta/formato.mjs';
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
const storedName=p=>normalizedPlayerLabel(p?.shirtName)||normalizedPlayerLabel(p?.knownAs);
export const playerDisplayName=p=>storedName(p)||normalizedPlayerLabel(p?.name);
export function playerSurname(player){
 const p=typeof player==='string'?{name:player}:player;
 return storedName(p)||normalizedPlayerLabel(p?.name).replace(/^(?:\p{L}\. )+|(?: \p{L}\.)+$/gu,'');
}
const shirtNameLimit=13;
const surnameParticle=/^(?:da|das|de|dei|degli|del|della|den|der|di|do|dos|du|el|al|la|le|van|von|ten|ter)$/iu;
const fitsShirt=name=>[...name.toUpperCase()].length<=shirtNameLimit;
export function playerShirtName(p){
 const name=playerSurname(p);
 // An initial stored in the catalog can distinguish players with the same surname.
 if(fitsShirt(name)||name===normalizedPlayerLabel(p?.knownAs)||/^\p{L}\. /u.test(normalizedPlayerLabel(p?.shirtName)))return name;
 const family=normalizedPlayerLabel(p?.surname||p?.lastName||p?.lastname||p?.last_name);
 const words=name.split(' '),lowerName=name.toLowerCase(),lowerFamily=family.toLowerCase();
 if(lowerName===lowerFamily)return name;
 // Use the family name only when it agrees with the catalog label. A legal
 // surname can differ from the established sporting name.
 let familyStart=words.length-1;
 if(family&&lowerName.endsWith(' '+lowerFamily))familyStart=words.length-family.split(' ').length;
 else while(familyStart>0&&surnameParticle.test(words[familyStart-1]))familyStart--;
 if(familyStart===0)return name;
 const surname=words.slice(familyStart).join(' ');
 const initial=words[0].match(/^\p{L}\p{M}*/u)?.[0];
 const abbreviated=initial?initial+'. '+surname:surname;
 return fitsShirt(abbreviated)?abbreviated:surname;
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
