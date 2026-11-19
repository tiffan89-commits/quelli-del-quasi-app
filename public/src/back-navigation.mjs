import {bindSwipeBack} from './match-page.mjs';
import {readAppRoute} from './routes.mjs';

export const BACK_ICON='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg>';
export const backButton=(attributes,label='Indietro')=>`<button type="button" class="secondary screen-back" data-screen-back aria-label="${label}" ${attributes}>${BACK_ICON}</button>`;
const bound=new WeakSet();

function matchesPreviousRoute(button,history){
 const previous=readAppRoute(history?.state?.qdqPreviousRoute||''),current=readAppRoute();
 if(!previous||!current||previous.league&&current.league&&previous.mode===current.mode&&previous.league!==current.league)return false;
 const {barPage,page,go,mode,presidentOperation,auctionExit}=button.dataset;
 const barTarget=barPage||page;
 if(barTarget==='barleague'&&current.mode==='bar'&&current.page==='admin'&&!current.section&&previous.mode==='fanta'){
  return previous.page==='lega'&&!previous.section;
 }
 if(auctionExit&&current.mode==='fanta'&&current.page==='asta'&&current.section==='asta'){
  return !previous.section&&(previous.mode==='bar'?previous.page==='admin':previous.page==='presidente');
 }
 const destination=presidentOperation===''?'admin':barTarget?({barleague:'lega',lega:'oggi'})[barTarget]||barTarget:go;
 return !!destination&&previous.mode===(mode||current.mode)&&previous.page===destination&&!previous.section;
}

export function bindScreenBack(surface){
 if(!surface?.querySelector('[data-screen-back]')||bound.has(surface))return;
 bound.add(surface);
 const history=surface.ownerDocument.defaultView?.history;
 surface.addEventListener('click',event=>{
  const button=event.target.closest('[data-screen-back]');
  if(!button||button.disabled||!matchesPreviousRoute(button,history))return;
  event.preventDefault();event.stopImmediatePropagation();history.back();
 },{capture:true});
 bindSwipeBack(surface,()=>{
  surface.querySelector('[data-screen-back]:not(:disabled)')?.click();
 },'both',event=>{
  if(surface.matches('.os-drill')||event.target.closest('dialog,[role="dialog"]')||surface.ownerDocument.querySelector('dialog[open]'))return false;
  const paging=surface.matches('.os-root:not(.os-split):not([data-os-flow])')&&surface.scrollWidth>surface.clientWidth+2;
  return !paging||!!event.target.closest('[data-os-header]');
 });
}
