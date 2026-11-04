const eye='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/><path class="password-eye-slash" d="m4 3 16 18"/></svg>';
function add(input){
 if(input.dataset.passwordToggle)return;
 input.dataset.passwordToggle='true';
 const wrap=document.createElement('span');wrap.className='password-field';input.before(wrap);wrap.append(input);
 const button=document.createElement('button');button.type='button';button.className='password-toggle';button.setAttribute('aria-label','Mostra password');button.setAttribute('aria-pressed','false');button.innerHTML=eye;
 button.onclick=e=>{e.preventDefault();const visible=input.type==='password';input.type=visible?'text':'password';button.setAttribute('aria-label',visible?'Nascondi password':'Mostra password');button.setAttribute('aria-pressed',String(visible));input.focus?.({preventScroll:true});};
 wrap.append(button);
}
function scan(root){if(root.nodeType!==1&&root!==document)return;if(root.matches?.('input[type="password"]'))add(root);root.querySelectorAll?.('input[type="password"]').forEach(add);}
scan(document);
new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)scan(node);}).observe(document.documentElement,{childList:true,subtree:true});
