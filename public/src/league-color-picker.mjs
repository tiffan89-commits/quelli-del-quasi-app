import {validLeagueAccent} from './league-theme.mjs';

const presets=[
 ['#ff6757','Rosso'],['#ff982e','Arancione'],['#ffdb3d','Giallo'],
 ['#39e77d','Verde'],['#3ec4ff','Azzurro'],['#b88aff','Viola'],
];

export function leagueColorPicker(name,label,accent){
 const color=accent.toLowerCase();
 return `<fieldset class="league-identity-palette" style="--identity-color:${color}">
  <legend>Colore ${label}</legend>
  <input type="hidden" name="${name}" value="${color}">
  <div class="league-color-presets">${presets.map(([value,title])=>`<button type="button" data-color-preset="${value}" aria-pressed="${value===color}" aria-label="${title}" title="${title}" style="--swatch:${value}"><span></span></button>`).join('')}</div>
  <div class="league-color-custom">
   <button type="button" class="league-color-toggle" aria-expanded="false" aria-controls="identity-color-${name}"><span class="league-color-sample" aria-hidden="true"></span>Colore personalizzato</button>
   <div id="identity-color-${name}" class="league-color-controls" hidden>
    <div class="league-color-wheel" aria-hidden="true"><span></span></div>
    <label class="field">Luminosità<input type="range" min="0" max="100" step="any" aria-label="Luminosità ${label}"></label>
    <label class="field">Codice HEX<input type="text" value="${color}" required maxlength="7" pattern="#?[0-9a-fA-F]{6}" title="Inserisci sei cifre esadecimali, per esempio #3ec4ff" spellcheck="false" autocapitalize="off" autocomplete="off"></label>
   </div>
  </div>
 </fieldset>`;
}

function toHsv(hex){
 const [red,green,blue]=[1,3,5].map(index=>parseInt(hex.slice(index,index+2),16)/255);
 const value=Math.max(red,green,blue),delta=value-Math.min(red,green,blue);
 let hue=0;
 if(delta){
  if(value===red)hue=(green-blue)/delta;
  else if(value===green)hue=2+(blue-red)/delta;
  else hue=4+(red-green)/delta;
 }
 return {hue:(hue+6)%6,saturation:value?delta/value:0,value};
}

function toHex({hue,saturation,value}){
 const channel=offset=>{
  const position=(offset+hue)%6;
  const fraction=Math.max(0,Math.min(position,4-position,1));
  return Math.round(255*value*(1-saturation*fraction)).toString(16).padStart(2,'0');
 };
 return '#'+channel(5)+channel(3)+channel(1);
}

export function bindLeagueColorPicker(palette,onColor){
 const input=palette.querySelector('[type="hidden"]'),hex=palette.querySelector('[type="text"]');
 const toggle=palette.querySelector('.league-color-toggle'),controls=palette.querySelector('.league-color-controls');
 const wheel=palette.querySelector('.league-color-wheel');
 const marker=wheel.firstElementChild,brightness=palette.querySelector('[type="range"]');
 const buttons=[...palette.querySelectorAll('[data-color-preset]')];
 let hsv=toHsv(input.value);
 const paint=(color,updateHex=true)=>{
  input.value=color;
  if(updateHex)hex.value=color;
  brightness.value=hsv.value*100;
  const angle=hsv.hue*Math.PI/3;
  marker.style.left=`${50+50*hsv.saturation*Math.cos(angle)}%`;
  marker.style.top=`${50+50*hsv.saturation*Math.sin(angle)}%`;
  palette.style.setProperty('--identity-color',color);
  for(const button of buttons)button.setAttribute('aria-pressed',String(button.dataset.colorPreset===color));
  onColor();
 };
 const fromHex=()=>{
  const color=(hex.value.startsWith('#')?hex.value:'#'+hex.value).toLowerCase();
  if(!validLeagueAccent(color))return;
  hsv=toHsv(color);
  paint(color,false);
 };
 hex.addEventListener('input',fromHex);
 brightness.addEventListener('input',()=>{
  hsv.value=Number(brightness.value)/100;
  paint(toHex(hsv));
 });
 const setFromPointer=event=>{
  const {left,top,width,height}=wheel.getBoundingClientRect();
  const x=2*(event.clientX-left)/width-1,y=2*(event.clientY-top)/height-1;
  hsv.hue=(Math.atan2(y,x)*3/Math.PI+6)%6;
  hsv.saturation=Math.min(1,Math.hypot(x,y));
  if(hsv.value===0)hsv.value=1;
  paint(toHex(hsv));
 };
 // Dragging across the wheel must stay inside the picker instead of navigating back.
 wheel.addEventListener('touchstart',event=>event.stopPropagation(),{passive:true});
 wheel.addEventListener('pointerdown',event=>{
  if(!event.isPrimary||event.button!==0)return;
  wheel.setPointerCapture(event.pointerId);
  setFromPointer(event);
 });
 wheel.addEventListener('pointermove',event=>{
  if(wheel.hasPointerCapture(event.pointerId))setFromPointer(event);
 });
 for(const button of buttons)button.addEventListener('click',()=>{
  const color=button.dataset.colorPreset;
  hsv=toHsv(color);
  paint(color);
 });
 paint(input.value);
 const resetHex=()=>{hex.value=input.value;};
 toggle.addEventListener('click',()=>{
  controls.hidden=!controls.hidden;
  toggle.setAttribute('aria-expanded',String(!controls.hidden));
  if(controls.hidden)resetHex();
 });
 return resetHex;
}
