import {KITS} from './fanta/maglie.mjs';
// Prefer the provider's explicit family name. Short display names remain untouched.
export function playerSurname(player){
 const p=typeof player==='string'?{name:player}:player||{};
 const family=p.surname||p.lastName||p.lastname||p.last_name;
 if(family)return String(family).trim();
 const name=String(p.name||'').trim().replace(/^(?:\p{Lu}\.\s*)+/u,'').replace(/\s+(?:\p{Lu}\.)+$/u,'');
 if(name==='Juan Jesus'||!name.includes(' '))return name;
 const words=name.split(/\s+/),parts=[words.pop()];
 while(words.length&&/^(?:d[aeiou]|de|del|della|di|dos|das|van|von|der|den|el|al|la|le)$/i.test(words.at(-1)))parts.unshift(words.pop());
 return parts.join(' ');
}
export const playerJersey=p=>p?.jersey||p?.number||p?.seasonStats?.games?.number||'';

export const opponentLabel=n=>n?.opponent?`${n.home?'':'@ '}${KITS[({'AC Milan':'Milan','AS Roma':'Roma','Hellas Verona':'Verona'})[n.opponent]||n.opponent]?.code||String(n.opponent).slice(0,3).toUpperCase()}`:'–';
