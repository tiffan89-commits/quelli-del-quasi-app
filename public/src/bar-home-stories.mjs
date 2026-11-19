import {predictionStatus} from '../prediction.mjs';
import {rewardById,rewardMark} from './reward-catalog.mjs';
import {openSiteOverlay} from './site-overlay.mjs';

const icons={
 results:'<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6m-6 4h6m-6 4h4"/>',
 rewards:'<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8h14v-8M12 8v12m0-12C5 9 6 2 9 4c1 .7 3 4 3 4Zm0 0c7 1 6-6 3-4-1 .7-3 4-3 4Z"/>',
 crossings:'<path d="m3 17 6-6 4 4 7-8m-6 0h6v6"/>',
};
const score=(value,fmt)=>(value>0?'+':'')+fmt(value);
const points=value=>Math.round(value*100);
export function crossingsFor(league,uid,round,history){
 const members=league.members||[],mine=members.find(member=>member.uid===uid);
 const settled=league.community?.seriea?.history?.find(item=>item.id===round?.id);
 const ownTotal=history?.pointsTotal;
 if(!mine||!settled?.players||!Number.isFinite(mine.points)||!Number.isFinite(ownTotal)||points(mine.points)!==points(ownTotal))return {ahead:[],behind:[]};
 const earned=new Map(settled.players.map(player=>[player.uid,player.points]));
 const old=points(mine.points)-points(earned.get(uid)||0),current=points(mine.points);
 const ahead=[],behind=[];
 for(const member of members){
  if(member.uid===uid||!Number.isFinite(member.points)||member.joinedAt&&Date.parse(member.joinedAt)>Date.parse(round.kickoff))continue;
  const after=points(member.points),before=after-points(earned.get(member.uid)||0);
  if(after<current&&before>=old)ahead.push(member.name);
  if(after>current&&before<=old)behind.push(member.name);
 }
 return {ahead,behind};
}

export function matchSegments(round){
 return (round.matches||[]).map(match=>{
  const saved=round.slip?.picks?.[match.id];
  const outcome=match.status==='LIVE'?null:predictionStatus(match,saved,true);
  const state=outcome?(outcome.winning?'yes':'no'):'pending';
  const label=match.home+' – '+match.away+' · '+(match.void?'Annullata':outcome?(outcome.winning?'Presa':'Sbagliata'):match.score?'Nessuna scelta':'Da giocare');
  return {state,label};
 });
}

function readSeen(uid){
 try {const value=JSON.parse(localStorage.getItem('qdq:bar-stories:'+uid)||'[]');return new Set(Array.isArray(value)?value:[]);}catch{return new Set();}
}
function markSeen(uid,key){
 try {const seen=readSeen(uid);seen.delete(key);seen.add(key);localStorage.setItem('qdq:bar-stories:'+uid,JSON.stringify([...seen].slice(-128)));}catch{}
}

export function renderBarStories({league,user,round,history,short,fmt,esc}){
 const stories=[];
 if(round){
  const tally=history?.played?history.correct+'/'+history.total+' prese':'';
  const change=history?.positionChange;
  const stats=history?`<dl class="bar-story-stats"><div><dt>Prese</dt><dd>${tally||'In panchina'}</dd></div><div><dt>Punti giornata</dt><dd class="${history.points<0?'loss':'gain'}">${score(history.points,fmt)}</dd></div><div><dt>Bilancio crediti</dt><dd>${score(history.profit,fmt)} cr</dd></div><div><dt>Posizione</dt><dd>${history.position}°${change?' · '+(change>0?'↑ ':'↓ ')+Math.abs(change):''}</dd></div></dl>`:'';
  stories.push({id:'results',label:short||round.title,title:round.title,body:stats+`<button type="button" class="secondary" data-story-slip="${esc(round.id)}">Risultati e schedina <span aria-hidden="true">→</span></button>`});
 }
 const rewards=(history?.awards||[]).map(rewardById).filter(Boolean);
 if(rewards.length)stories.push({id:'rewards',label:'Bottino',title:'Il bottino della giornata',body:`<ul class="bar-story-rewards">${rewards.map(reward=>`<li>${rewardMark(reward)}<b>${esc(reward.name)}</b></li>`).join('')}</ul>`});
 const {ahead,behind}=crossingsFor(league,user.id,round,history);
 if(ahead.length||behind.length)stories.push({id:'crossings',label:'Sorpassi',title:'Sorpassi in classifica',body:[['Hai superato',ahead],['Ti hanno superato',behind]].filter(([,names])=>names.length).map(([heading,names])=>`<section><h3>${heading}</h3><ul>${names.map(name=>`<li>${esc(name)}</li>`).join('')}</ul></section>`).join('')});
 const seen=readSeen(user.id);
 return `<div class="bar-home-stories"${stories.length?'':' hidden'} aria-label="Storie del Bar">${stories.map(({id,label,title,body})=>{
  const key=league.id+':'+round.id+':'+id;
  return `<article class="bar-home-story-slot"><button type="button" class="bar-story-trigger story-${id}" id="bar-story-${id}" data-bar-story="${esc(key)}" aria-haspopup="dialog" aria-label="${esc(title)}${seen.has(key)?', già vista':''}"${seen.has(key)?' data-seen':''}><span><svg viewBox="0 0 24 24" aria-hidden="true">${icons[id]}</svg></span><small>${esc(label)}</small></button>
  <template data-story-card><h2>${esc(title)}</h2>${body}</template></article>`;
 }).join('')}</div>`;
}

export function openBarStory(trigger,{uid,onSlip}){
 const stories=[...trigger.closest('.bar-home-stories').querySelectorAll('[data-bar-story]')];
 const document=trigger.ownerDocument;
 const dialog=document.createElement('dialog');
 dialog.className='bar-story-dialog';
 dialog.setAttribute('aria-label','Storie del Bar');
 dialog.innerHTML=`<section class="bar-story-frame"><div class="bar-story-progress" aria-hidden="true"></div>
  <div class="bar-story-controls"><button type="button" data-story-pause aria-pressed="false">Pausa</button><button type="button" data-story-close aria-label="Chiudi storia" autofocus>×</button></div>
  <div class="bar-story-pages"><button type="button" data-story-back aria-label="Storia precedente">‹</button><article class="bar-story-copy" data-overlay-scroll></article><button type="button" data-story-next aria-label="Storia successiva">›</button></div></section>`;
 const close=openSiteOverlay(dialog,trigger),progress=dialog.querySelector('.bar-story-progress');
 const content=dialog.querySelector('.bar-story-copy'),pause=dialog.querySelector('[data-story-pause]');
 const duration=11000;
 let index=stories.indexOf(trigger),remaining=duration,started=0,timer=null,paused=false;
 const stop=()=>{clearTimeout(timer);timer=null;};
 const advance=()=>index+1<stories.length?show(index+1):close();
 function play(){
  const fill=progress.children[index]?.firstElementChild;
  if(!fill||paused)return;
  started=performance.now();
  fill.style.animationDuration=remaining+'ms';fill.style.animationPlayState='running';
  timer=setTimeout(advance,remaining);
 }
 function show(next){
  stop();index=next;remaining=duration;
  const button=stories[index],key=button.dataset.barStory;
  markSeen(uid,key);
  button.setAttribute('data-seen','');
  if(!button.getAttribute('aria-label').endsWith(', già vista'))button.setAttribute('aria-label',button.getAttribute('aria-label')+', già vista');
  content.replaceChildren(button.parentElement.querySelector('template').content.cloneNode(true));
  progress.innerHTML=stories.map((_,i)=>`<span class="${i<index?'is-done':i===index?'is-now':''}"><i></i></span>`).join('');
  dialog.querySelector('[data-story-back]').disabled=index===0;
  play();
 }
 pause.onclick=()=>{
  paused=!paused;
  pause.textContent=paused?'Riprendi':'Pausa';pause.setAttribute('aria-pressed',String(paused));
  const fill=progress.children[index].firstElementChild;
  if(paused){remaining=Math.max(0,remaining-(performance.now()-started));stop();fill.style.animationPlayState='paused';}
  else{started=performance.now();fill.style.animationPlayState='running';timer=setTimeout(advance,remaining);}
 };
 content.addEventListener('focusin',()=>{if(!paused)pause.click();});
 dialog.querySelector('[data-story-close]').onclick=close;
 dialog.querySelector('[data-story-back]').onclick=()=>{if(index>0)show(index-1);};
 dialog.querySelector('[data-story-next]').onclick=advance;
 dialog.addEventListener('click',event=>{const button=event.target.closest('[data-story-slip]');if(button){close();onSlip(button.dataset.storySlip);}});
 dialog.addEventListener('keydown',event=>{
  if(event.key==='ArrowRight'){event.preventDefault();advance();}
  if(event.key==='ArrowLeft'&&index>0){event.preventDefault();show(index-1);}
 });
 dialog.addEventListener('close',stop,{once:true});
 show(index);
}
