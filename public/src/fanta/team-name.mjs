import {esc} from './formato.mjs';

export const TEAM_NAME_MAX=24;
const length=text=>[...text].length;
export function shortenTeamName(name,limit){
 const words=String(name??'').trim().split(/\s+/),full=words.join(' ');
 if(length(full)<=limit)return full;
 for(let keep=words.length-1;keep>0;keep--){
  const suffix=words.slice(keep).map(word=>[...word][0]).join('');
  const label=words.slice(0,keep).join(' ')+' '+suffix+'.';
  if(length(label)<=limit)return label;
 }
 if(words.length>1){
  const tail=' '+[...words.at(-1)][0]+'.';
  return [...words[0]].slice(0,limit-length(tail)-1).join('')+'.'+tail;
 }
 return [...full].slice(0,limit-1).join('')+'.';
}

export function fitTeamName(name){
 const full=String(name??'');
 const visible=[[null,full],['medium',shortenTeamName(full,18)],['short',shortenTeamName(full,13)],['tiny',shortenTeamName(full,9)]];
 const labels=visible.map(([size,text])=>`<span${size?' class="team-name-'+size+'"':''} aria-hidden="true">${esc(text)}</span>`).join('');
 return `<span class="fanta-fit-team" title="${esc(full)}"><span class="sr-only">${esc(full)}</span>${labels}</span>`;
}
