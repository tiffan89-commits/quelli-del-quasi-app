export function modeSwitch(mode, attribute='data-mode') {
  return `<div class="fanta-mode" role="group" aria-label="Modalità">${['bar','fanta'].map(value=>`<button type="button" class="fanta-mode-btn${mode===value?' is-active':''}" ${attribute}="${value}" aria-pressed="${mode===value}">${value==='bar'?'Bar':'Fanta'}</button>`).join('')}</div>`;
}
// The mother app owns this header; changing product never removes its DOM node.
export function retainAppHeader(root){
 const next=root.querySelector('.v2-top');if(!next)return;
 let host=document.getElementById('app-header');if(!host){host=document.createElement('div');host.id='app-header';root.before(host);}
 const current=host.querySelector('.v2-top');
 if(current&&!next.matches('.league-onboarding-top')&&!next.querySelector('.v2-league-chip')){next.remove();return;}
 if(current){current.className=next.className;if(current.innerHTML!==next.innerHTML)current.innerHTML=next.innerHTML;next.remove();}
 else host.append(next);
 document.documentElement.style.setProperty('--ux-header-height',host.offsetHeight+'px');
}
