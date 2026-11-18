let active=null,serial=0,installed=false;
export function syncStyledSelects(){document.querySelectorAll('select').forEach(s=>s._quasiSync?.());}
export function closeStyledSelect(){active?.close();}
export function bindStyledSelects(root=document){
 if(!installed){installed=true;document.addEventListener('pointerdown',e=>{if(active&&!active.panel.contains(e.target)&&!active.button.contains(e.target))active.close();});window.addEventListener('resize',closeStyledSelect);document.addEventListener('scroll',e=>{if(active&&!active.panel.contains(e.target))active.close();},true);}
 root.querySelectorAll('select').forEach(select=>{
  if(select.dataset.styled||select.hasAttribute('data-native-select')||select.multiple)return;select.dataset.styled='true';
  const wrapper=document.createElement('div');wrapper.className='quasi-select';select.before(wrapper);wrapper.append(select);
  const button=document.createElement('button'),panel=document.createElement('div'),id='quasi-select-'+(++serial);
  const label=select.getAttribute('aria-label')||[...(select.labels?.[0]?.childNodes||[])].filter(n=>n.nodeType===3).map(n=>n.textContent).join(' ').trim()||select.labels?.[0]?.querySelector('span')?.textContent||'Scegli';
  button.type='button';button.className='quasi-select-button';button.setAttribute('role','combobox');button.setAttribute('aria-label',label);button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-controls',id);button.setAttribute('aria-expanded','false');
  panel.id=id;panel.className='quasi-select-menu';panel.setAttribute('role','listbox');panel.setAttribute('aria-label',label);panel.setAttribute('popover','manual');panel.hidden=true;document.body.append(panel);wrapper.append(button);select.hidden=true;
  const value=document.createElement('span');value.className='quasi-select-value';
  const arrow=document.createElement('span');arrow.className='quasi-select-arrow';arrow.setAttribute('aria-hidden','true');
  button.append(value,arrow);
  let highlighted=0,options=[];
  const sync=()=>{value.textContent=select.selectedOptions[0]?.textContent||'Scegli';button.disabled=select.disabled;};select._quasiSync=sync;sync();
  const close=()=>{if(panel.hidePopover)try{panel.hidePopover();}catch{}panel.hidden=true;button.setAttribute('aria-expanded','false');button.removeAttribute('aria-activedescendant');if(active?.button===button)active=null;};
  const highlight=index=>{highlighted=Math.max(0,Math.min(options.length-1,index));options.forEach((o,i)=>o.classList.toggle('highlighted',i===highlighted));button.setAttribute('aria-activedescendant',options[highlighted]?.id||'');options[highlighted]?.scrollIntoView({block:'nearest'});};
  const choose=i=>{const option=select.options[i];if(!option||option.disabled)return;select.value=option.value;sync();close();button.focus({preventScroll:true});select.dispatchEvent(new Event('change',{bubbles:true}));};
  const open=()=>{active?.close();panel.replaceChildren();options=[...select.options].map((option,i)=>{const o=document.createElement('div');o.id=id+'-'+i;o.setAttribute('role','option');o.setAttribute('aria-selected',String(option.selected));o.setAttribute('aria-disabled',String(option.disabled));o.textContent=option.textContent;o.onclick=()=>choose(i);panel.append(o);return o;});panel.hidden=false;if(panel.showPopover)panel.showPopover();
   const rect=button.getBoundingClientRect(),width=Math.min(Math.max(rect.width,220),innerWidth-24),maxHeight=Math.min(300,innerHeight-32);panel.style.width=width+'px';panel.style.maxHeight=maxHeight+'px';panel.style.left=Math.max(12,Math.min(rect.left,innerWidth-width-12))+'px';const desired=Math.min(panel.scrollHeight,maxHeight),below=innerHeight-rect.bottom-19,above=rect.top-19,down=below>=desired||below>=above;const height=Math.min(desired,Math.max(0,down?below:above));panel.style.maxHeight=height+'px';panel.style.top=(down?rect.bottom+7:Math.max(12,rect.top-height-7))+'px';button.setAttribute('aria-expanded','true');active={button,panel,close};highlight(select.selectedIndex);};
  button.onclick=()=>button.getAttribute('aria-expanded')==='true'?close():open();
  let typed='',timer;button.onkeydown=e=>{const expanded=button.getAttribute('aria-expanded')==='true';if(['ArrowDown','ArrowUp','Home','End','Enter',' ','Escape'].includes(e.key)){e.preventDefault();if(e.key==='Escape'){close();return;}if(!expanded){open();return;}if(e.key==='Enter'||e.key===' '){choose(highlighted);return;}highlight(e.key==='Home'?0:e.key==='End'?options.length-1:highlighted+(e.key==='ArrowDown'?1:-1));}else if(e.key==='Tab')close();else if(e.key.length===1){typed+=e.key.toLocaleLowerCase('it');clearTimeout(timer);timer=setTimeout(()=>typed='',700);if(!expanded)open();const i=[...select.options].findIndex(o=>!o.disabled&&o.textContent.toLocaleLowerCase('it').startsWith(typed));if(i>=0)highlight(i);}};
  select.addEventListener('change',sync);
 });
 document.querySelectorAll('.quasi-select-menu').forEach(panel=>{if(!document.querySelector(`[aria-controls="${panel.id}"]`)){if(active?.panel===panel)active.close();panel.remove();}});
}
