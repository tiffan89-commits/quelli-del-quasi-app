import {LOGO_SHAPES,LOGO_PATTERNS,LOGO_SYMBOLS,LOGO_COLORS,normalizeLogo,logoSvg,teamLogo} from './team-logo.mjs';
import {esc} from './formato.mjs';
const LIMIT=250*1024;
export async function readLogoFile(file){
 if(!file||file.size>LIMIT)throw Error('Scegli un’immagine fino a 250 KB.');
 if(!['image/png','image/jpeg','image/webp','image/gif'].includes(file.type))throw Error('Scegli un file PNG, JPG, WebP o GIF.');
 let image;try{image=await createImageBitmap(file);if(!image.width||!image.height||image.width>4096||image.height>4096||image.width*image.height>8000000)throw Error('L’immagine ha dimensioni troppo grandi.');const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d'),scale=Math.min(472/image.width,472/image.height);ctx.drawImage(image,(512-image.width*scale)/2,(512-image.height*scale)/2,image.width*scale,image.height*scale);const data=canvas.toDataURL('image/webp',.9);if(data.length>Math.ceil(LIMIT*4/3)+100)throw Error('L’immagine è troppo complessa. Scegli un file più leggero.');return data;}finally{image?.close();}
}
export function openLogoEditor({team,teamNameDeadline=null,onSave}){
 if(document.querySelector('dialog.fanta-logo-editor[open]'))return;
 const dialog=document.createElement('dialog');dialog.className='fanta-logo-editor';dialog.setAttribute('aria-label','Modifica nome e stemma della squadra');
 const previous=document.activeElement,oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';
 const canRename=()=>teamNameDeadline==null||Date.parse(teamNameDeadline)>Date.now();
 let name=team.name,design=normalizeLogo(team.branding?.design,team.name),image=null,section=canRename()?'name':'shape',colorSlot='primary',saving=false,readingImage=false,logoChanged=false,closed=false;
 const cleanName=value=>value.trim().replace(/\s+/g,' '),normalizedName=()=>cleanName(name),nameChanged=()=>normalizedName()!==cleanName(team.name);
 const tabs=[['name','Nome'],['shape','Forma'],['pattern','Stile'],['colors','Colori'],['symbol','Disegni'],['text','Testi'],['import','Importa']];
 dialog.innerHTML=`<div class="logo-editor-top"><button type="button" data-logo-close class="fanta-close" aria-label="Chiudi editor della squadra">×</button><div><small data-logo-team-label>${esc(team.name)}</small><h1>Il tuo stemma</h1></div><button type="button" data-logo-reset aria-label="Azzera lo stemma">Azzera</button></div><div class="logo-editor-preview"></div><div class="logo-editor-tools"><div class="logo-editor-tabs" role="tablist">${tabs.map(([id,label])=>`<button type="button" role="tab" data-logo-tab="${id}" aria-selected="${section===id}">${label}</button>`).join('')}</div><div class="logo-editor-options"></div></div><div class="logo-editor-bottom"><p role="status" class="logo-editor-status">Un simbolo serio. Quasi.</p><button type="button" class="primary" data-logo-save disabled>Salva</button></div>`;
 const preview=dialog.querySelector('.logo-editor-preview'),options=dialog.querySelector('.logo-editor-options'),status=dialog.querySelector('.logo-editor-status'),save=dialog.querySelector('[data-logo-save]');
 const showPreview=()=>{
  const label=normalizedName()||team.name;
  dialog.querySelector('[data-logo-team-label]').textContent=label;
  preview.innerHTML=image?`<img src="${image}" alt="Anteprima del logo importato">`:logoChanged?logoSvg(design,label):teamLogo({...team,name:label},{eager:true});
  save.disabled=!(logoChanged||nameChanged())||saving||readingImage;
 };
 const markLogo=()=>{logoChanged=true;status.textContent='Pronto a farsi riconoscere.';showPreview();};
 const tile=(key,value,label)=>`<button type="button" class="logo-option ${design[key]===value?'is-active':''}" data-logo-key="${key}" data-logo-value="${value}" aria-pressed="${design[key]===value}">${logoSvg({...design,[key]:value},label)}<span>${label}</span></button>`;
 const showOptions=()=>{
  dialog.querySelectorAll('[data-logo-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.logoTab===section)));
  if(section==='name')options.innerHTML=`<div class="logo-text-fields"><label style="grid-column:1/-1">Nome della squadra<input data-logo-team-name maxlength="50" value="${esc(name)}" ${canRename()?'':'readonly'} aria-describedby="logo-team-name-rule"></label></div><p id="logo-team-name-rule" class="fanta-note">${canRename()?'Puoi cambiarlo fino al primo calcio d’inizio.':'Il nome è bloccato dopo il calcio d’inizio della prima partita della stagione di Fanta.'}</p>`;
  if(section==='shape')options.innerHTML=`<div class="logo-option-grid">${LOGO_SHAPES.map(([v,n])=>tile('shape',v,n)).join('')}</div>`;
  if(section==='pattern')options.innerHTML=`<div class="logo-option-grid">${LOGO_PATTERNS.map(([v,n])=>tile('pattern',v,n)).join('')}</div><div class="logo-border-options">${['simple','double'].map((v,i)=>`<button type="button" data-logo-key="border" data-logo-value="${v}" aria-pressed="${design.border===v}">${i?'Doppio bordo':'Bordo semplice'}</button>`).join('')}</div>`;
  if(section==='symbol')options.innerHTML=`<div class="logo-option-grid">${LOGO_SYMBOLS.map(([v,n])=>tile('symbol',v,n)).join('')}</div>`;
  if(section==='colors')options.innerHTML=`<div class="logo-color-slots">${[['primary','Base'],['secondary','Contrasto'],['ink','Dettagli']].map(([v,n])=>`<button type="button" data-logo-color-slot="${v}" aria-pressed="${colorSlot===v}"><i style="background:${design[v]}"></i>${n}</button>`).join('')}</div><div class="logo-swatches">${LOGO_COLORS.map(v=>`<button type="button" data-logo-key="${colorSlot}" data-logo-value="${v}" style="background:${v}" aria-label="Colore ${v}" aria-pressed="${design[colorSlot]===v}"></button>`).join('')}</div>`;
  if(section==='text')options.innerHTML=`<div class="logo-text-fields"><label>Sigla<input data-logo-text="text" maxlength="5" value="${esc(design.text)}" placeholder="FLY"></label><label>Motto o nome breve<input data-logo-text="caption" maxlength="18" value="${esc(design.caption)}" placeholder="Quasi imbattibili"></label><label>Anno<input data-logo-text="year" inputmode="numeric" maxlength="4" value="${esc(design.year)}" placeholder="2026"></label></div>`;
  if(section==='import')options.innerHTML='<label class="logo-upload-tile"><strong>Il tuo logo, da un file</strong><span>PNG, JPG, WebP o GIF · massimo 250 KB</span><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-logo-file><span class="secondary">Scegli immagine</span></label><p class="fanta-note">L’immagine viene adattata al riquadro, mantenendo le proporzioni.</p>';
 };
 const close=()=>{if(saving||closed)return;closed=true;dialog.close();dialog.remove();document.body.style.overflow=oldOverflow;if(previous?.isConnected)previous.focus();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 dialog.addEventListener('click',e=>{const b=e.target.closest('button');if(!b||saving)return;if(b.hasAttribute('data-logo-close'))close();if(b.dataset.logoTab){section=b.dataset.logoTab;showOptions();}if(b.dataset.logoColorSlot){colorSlot=b.dataset.logoColorSlot;showOptions();}if(b.dataset.logoKey){design=normalizeLogo({...design,[b.dataset.logoKey]:b.dataset.logoValue},normalizedName()||team.name);image=null;markLogo();showOptions();}if(b.hasAttribute('data-logo-reset')){design=normalizeLogo({},normalizedName()||team.name);image=null;markLogo();showOptions();}});
 dialog.addEventListener('input',e=>{
  if(e.target.matches('[data-logo-team-name]')){name=e.target.value;status.textContent='';showPreview();return;}
  const key=e.target.dataset.logoText;if(key){design=normalizeLogo({...design,[key]:e.target.value},normalizedName()||team.name);image=null;markLogo();}
 });
 dialog.addEventListener('change',async e=>{if(!e.target.matches('[data-logo-file]')||readingImage)return;readingImage=true;save.disabled=true;status.textContent='Prepariamo il tuo logo…';try{image=await readLogoFile(e.target.files[0]);markLogo();}catch(err){status.textContent=err.message;e.target.value='';}finally{readingImage=false;showPreview();}});
 save.onclick=async()=>{
  if(saving||readingImage||!(logoChanged||nameChanged()))return;
  if(nameChanged()&&!canRename()){
   name=team.name;status.textContent='La prima partita è iniziata. Il nome della squadra è bloccato.';showOptions();showPreview();return;
  }
  if(nameChanged()&&normalizedName().length<2){status.textContent='Inserisci almeno due caratteri.';return;}
  const input=logoChanged?(image?{type:'image',image}:{type:'design',design}):{};
  if(nameChanged())input.name=normalizedName();
  saving=true;save.disabled=true;save.setAttribute('aria-busy','true');save.textContent='Salvataggio in corso…';
  try{await onSave(input);saving=false;close();}catch(err){status.textContent=err.message;saving=false;save.removeAttribute('aria-busy');save.textContent='Salva';showPreview();}
 };
 document.body.append(dialog);showPreview();showOptions();dialog.showModal();dialog.querySelector('[data-logo-close]').focus();return {close};
}
