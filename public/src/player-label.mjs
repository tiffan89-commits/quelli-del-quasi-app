import {KITS} from './fanta/maglie.mjs';
import {esc,fixtureTime} from './fanta/formato.mjs';
const particles=/^(?:d[aeiou]|de|del|della|di|dos|das|van|von|der|den|el|al|la|le)$/i;
const abbreviated=word=>/^\p{L}\.$/u.test(word);
export function playerSurname(player){
 const p=typeof player==='string'?{name:player}:player||{};
 const family=p.surname||p.lastName||p.lastname||p.last_name;
 const words=String(family||p.name||'').trim().split(/\s+/).filter(Boolean);
 if(!words.length)return "";
 if(!family){
  if(words.length>1&&abbreviated(words.at(-1)))words.pop();
  else if(words.length>1&&!abbreviated(words[0])&&!particles.test(words[0])&&!/^(Kolo Muani|Zambo Anguissa)$/i.test(words.join(" ")))words.shift();
  else if(words.length>1&&abbreviated(words[0]))words.shift();
 }
 const name=[words.shift()];
 while(words.length&&particles.test(name.at(-1)))name.push(words.shift());
 if(words.length&&abbreviated(name.at(-1)))name.push(words.shift());
 return name.join(' ').replace(/&(?:apos|#0*39|#x0*27);?|[^\p{L}\p{M}\p{N}\s.-]/giu,'');
}
export const playerJersey=p=>[p?.jersey,p?.number,p?.seasonStats?.games?.number].find(n=>/^[1-9][0-9]?$/.test(String(n)))??'';

export const opponentLabel=n=>n?.opponent?`${n.home?'':'@ '}${KITS[({'AC Milan':'Milan','AS Roma':'Roma','Hellas Verona':'Verona'})[n.opponent]||n.opponent]?.code||String(n.opponent).slice(0,3).toUpperCase()}`:'–';

export function pitchFixture(player){
 const opponent=player.next?.opponent||player.opponent;
 const kickoff=player.next?.kickoff||player.kickoff;
 const label=opponent&&opponent!=='Da definire'?opponentLabel({opponent,home:player.next?.home??player.home}).replace('@ ','@'):'';
 const time=Number.isFinite(Date.parse(kickoff))?fixtureTime(kickoff):'';
 if(!label&&!time)return '';
 return `<span class="pitch-fixture" data-pitch-fixture>${label?`<small class="pitch-next-opponent">${esc(label)}</small>`:''}${time?`<small class="pitch-next-kickoff">${esc(time)}</small>`:''}</span>`;
}
