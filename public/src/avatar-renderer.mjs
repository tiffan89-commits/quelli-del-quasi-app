import {rewardById} from './reward-catalog.mjs';
import {hatArt,charmArt,outfitArt,INK,dark,light,lum,flat} from './avatar-art.mjs';
// Il Quasi in stile avventura grafica anni '90: testa grande, naso importante, contorno scuro caldo,
// ombre piatte sul lato destro (la luce arriva da sinistra, come negli spogliatoi). Stesse opzioni di prima.
const MIRROR='translate(280 0) scale(-1 1)';
export function renderAvatar(a){
 const female=a.character==='female',male=a.character==='male',skin=a.skin,hair=a.hairColor;
 const headwear=rewardById(a.rewardHat),charm=rewardById(a.rewardCharm),kit=rewardById(a.rewardOutfit);
 const color=rewardById(a.rewardColor)?.color||kit?.color||a.color;
 const outfit=kit?({2:'jacket',7:'scarf',9:'apron'})[kit.motif]||'jersey':a.outfit;
 const scale={slim:.87,regular:1,athletic:1.1,stocky:1.23}[a.body]||1;
 // Id stabile per i ritagli: due Quasi uguali producono lo stesso SVG.
 let h=0;for(const ch of JSON.stringify(a))h=(Math.imul(h,31)+ch.charCodeAt(0))|0;const id='qa'+(h>>>0).toString(36);
 const sport=outfit==='jersey'||outfit==='stripes',coat=kit?color:'#3d4b43';
 const trim=lum(color)>170?'#3a4a43':'#efe5c9';
 const top=outfit==='jacket'?coat:color,sleeve=outfit==='jacket'?coat:color;

 // Gambe: pantaloncini e calzettoni con la maglia, pantaloni con giacca e sciarpa.
 const shoe=`<path d="M97 318q-9 16 5 16h30q6-6-2-16Z" fill="#2e2622"/>${flat('M100 324q4-3 12-2',`none`,` stroke="#6b5a4e" stroke-width="2.5"`)}${sport?'<path d="m108 320 4 8m4-8 4 8m4-8 4 8" fill="none" stroke="#efe5c9" stroke-width="2"/>':''}`;
 const legs=sport
  ?`<path d="M104 288v18h25v-18Zm47 0v18h25v-18Z" fill="${skin}"/><path d="M103 302v19h26v-19Zm48 0v19h26v-19Z" fill="${color}"/><path d="M104 307h24m24 0h24" fill="none" stroke="${trim}" stroke-width="3"/><path d="M96 256h88l6 34q-24 6-44 2l-6-16-6 16q-20 4-44-2Z" fill="${lum(color)>150?'#2f3a37':'#efe5c9'}"/>${flat('M160 258h24l5 30q-10 2-20 2Z',lum(color)>150?'#232c29':'#d4c9ab')}<path d="M96 256h88l6 34q-24 6-44 2l-6-16-6 16q-20 4-44-2Z" fill="none"/>`
  :`<path d="M96 256h88l-2 64h-30l-12-40-12 40H98Z" fill="${outfit==='jacket'?'#33373f':'#3f5168'}"/>${flat('M162 258h22l-2 62h-18q4-30-2-62Z','#00000030')}<path d="M96 256h88l-2 64h-30l-12-40-12 40H98Z" fill="none"/><path d="M96 262h88" fill="none" stroke="#2a2420" stroke-width="5"/><path d="M134 259h12v7h-12Z" fill="#c9a24f" stroke-width="2"/>`;

 const torso=female?'M120 176q-16 2-22 12-6 12-2 30l8 20q-6 12-6 22h84q0-10-6-22l8-20q4-18-2-30-6-10-22-12-8 14-20 14t-20-14Z':'M118 176q-20 2-28 14-6 12-2 32l6 38h92l6-38q4-20-2-32-8-12-28-14-10 14-22 14t-22-14Z';
 const stripes=outfit==='stripes'?`<path d="M100 196h9v66h-9Zm18 0h9v66h-9Zm36 0h9v66h-9Zm18 0h9v66h-9Zm-40 0h9v66h-9Z" fill="${trim}" stroke="none"/>`:'';
 const scarf=kit?.secondary||'#efe5c9';
 const details=outfit==='jacket'
  ?`<path d="M122 178 140 236l18-58q-8 12-18 12t-18-12Z" fill="#efe5c9"/><path d="M136 191h8l2 8-4 32h-4l-4-32Z" fill="${color}" stroke-width="2.5"/><path d="M120 177 110 198l10 6-6 8 25 28-15-54Zm40 0 10 21-10 6 6 8-25 28 15-54Z" fill="${light(coat,.12)}" stroke-width="3"/><circle cx="148" cy="248" r="2.6" fill="#c9a24f" stroke-width="1.5"/><path d="M160 214l10-2 2 6-11 2Z" fill="${color}" stroke-width="2"/>`
  :outfit==='scarf'
  ?`<path d="M140 206v52" fill="none" stroke="${dark(color,.4)}" stroke-width="3"/><path d="M150 193l16-3 4 63-17 2Z" fill="${scarf}"/><path d="M153 211l13-2m-12 16 13-2m-12 16 13-2" fill="none" stroke="${trim}" stroke-width="4"/><path d="M156 256v6m5-6v6m5-7v6" fill="none" stroke-width="2.5"/><path d="M114 175q26 22 52 0 9 8 2 17-28 19-56 0-7-9 2-17Z" fill="${scarf}"/><path d="M118 185q22 15 44 0" fill="none" stroke="${trim}" stroke-width="4"/>`
  :outfit==='apron'?''
  :`<path d="M118 176q8 18 22 21 14-3 22-21l-6-1q-6 13-16 15-10-2-16-15Z" fill="${trim}" stroke-width="3"/>${kit?'':'<path d="M159 205h15v12q-7 8-15 0Z" fill="'+trim+'" stroke-width="2.5"/>'}`;

 // Braccio sinistro; il destro è lo stesso disegno specchiato.
 const longSleeve=!sport;
 const sleeveD=longSleeve?'M98 184q-20 2-24 22l-8 50q10 7 23 2l8-42Z':'M98 184q-20 2-24 22l-4 20q11 6 23 2l4-18Z';
 const arm=`${longSleeve?'':`<path d="M71 222 66 256q10 7 23 2l4-32Z" fill="${skin}"/>${flat('M86 228l-2 30q3 0 5-1l4-31Z',dark(skin,.22))}`}${flat(sleeveD,sleeve)}${flat(longSleeve?'M88 200l9 16-8 42q-3 1-6 0Z':'M88 200l9 10-4 18q-3 1-6 0Z',dark(sleeve,.28))}${flat('M80 196q-4 6-6 14',`none`,` stroke="${light(sleeve,.35)}" stroke-width="4"`)}<path d="${sleeveD}" fill="none"/><path d="M64 252q-9 14-1 25 9 8 22 1 8-7 5-21Z" fill="${skin}"/><path d="M70 268l3 8m5-9 3 8" fill="none" stroke-width="2.4"/>`;
 const armShift=female?'translate(5 0)':'';

 const freeCharm=a.accessory==='ticket'?{type:'charm',motif:5,color:'#eee7d0'}:a.accessory==='ball'?{type:'charm',motif:2,color:'#34433c'}:a.accessory==='whistle'?{type:'charm',motif:6,color:'#cfb86b'}:null;

 // Testa.
 const face=female?'M106 92q-2-42 34-42 36 2 34 42l-2 26q-4 26-18 38-8 6-14 6-8 0-16-6-14-12-16-38Z':'M104 94q-2-44 36-46 38 0 36 46l-2 26q-2 26-18 38-10 8-22 6-16-4-24-18-6-12-4-26Z';
 const browW=male?9:female?6:7.5;
 const brow=d=>`<path d="${d}" fill="none" stroke="${INK}" stroke-width="${browW+3.5}"/><path d="${d}" fill="none" stroke="${hair}" stroke-width="${browW}"/>`;
 // Occhi senza contorno pieno (sennò sembrano occhiali): palpebra superiore marcata, sotto solo un filo.
 const eye=(x,side)=>`<ellipse cx="${x}" cy="106" rx="7.5" ry="9.5" fill="#fbf6e6" stroke="none"/><circle cx="${x+2.5}" cy="107.5" r="3.6" fill="${INK}" stroke="none"/><circle cx="${x+3.6}" cy="106" r="1.1" fill="#fff" stroke="none"/><path d="M${x-9} 104Q${x-6} 95 ${x} 95.5Q${x+7} 96 ${x+9} 104" fill="none" stroke-width="3.8"/><path d="M${x-6} 113.5q6 3.5 12 0" fill="none" stroke-width="1.6"/>${female?`<path d="M${x-8*side} 99l${-5*side}-3m${4*side}-1l${-3*side}-5" fill="none" stroke-width="2.4"/>`:''}`;
 const hairHi=light(hair,.38),hairSh=dark(hair,.32);
 const backHair=a.hair==='long'?`<path d="M102 92q-8-48 38-50 46 2 38 50l12 104q-10 12-26 4l-4-50h-40l-4 50q-16 8-26-4Z" fill="${hair}"/>${flat('M170 90l8 100q-6 6-14 4l-2-44Z',hairSh)}`:a.hair==='bun'?`<circle cx="140" cy="36" r="17" fill="${hair}"/>${flat('M146 22q12 6 10 18-4 10-14 12 10-12 4-30Z',hairSh)}<path d="M132 30q6-6 14-2" fill="none" stroke="${hairHi}" stroke-width="3"/><circle cx="140" cy="36" r="17" fill="none"/>`:'';
 const frontHair={
  // Sotto un cappello il ciuffo resta senza punta, sennò spunta di lato.
  wave:[headwear?'M102 100q-8-34 10-46 4-20 30-24 26-2 36 12 16 14 10 58-4-20-14-30-12 8-28 0-14-6-24 8-6 8-10 22Z':'M102 100q-8-34 10-46 4-22 30-26 28-4 44 12-12-2-18 4 16 14 10 56-4-20-14-30-12 8-28 0-14-6-24 8-6 8-10 22Z','M166 46q16 14 12 52-6-20-14-28Z','M120 48q20-12 44-8'],
  short:['M102 94q-4-32 8-38l4-10 8 6 6-10 8 8 8-10 6 10 10-8 4 10 8-2v10q10 10 6 34-4-20-18-26-20-4-40 0-14 6-18 26Z','M164 54l8-2v10q10 10 6 32-4-18-14-24Z','M118 56l6-4m10 0 6-6m10 4 6-4'],
  curly:['M100 100a12 12 0 0 1-2-22 14 14 0 0 1 10-24 14 14 0 0 1 22-12 15 15 0 0 1 26 0 14 14 0 0 1 22 12 14 14 0 0 1 10 24 12 12 0 0 1-6 22q-4-22-18-28-20 8-40 0-14 8-24 28Z','M168 56a14 14 0 0 1 10 24 12 12 0 0 1-6 20q-2-14-10-24Z','M114 54q4-6 10-4m14-6q6-4 12 0m14 6q6 0 8 6m-50 6q4-4 8-2'],
  long:['M102 102q-4-48 38-52 42 4 38 52-6-22-18-32-8 14-28 12-14 0-20-6-6 12-10 26Z','M160 70q14 8 18 32-6-16-18-24Z','M118 58q14-8 34-6'],
  bun:['M102 100q-4-44 38-50 42 6 38 50-4-22-16-32-22-8-44 0-12 10-16 32Z','M162 68q12 8 16 32-4-16-14-26Z','M120 60q16-8 36-4'],
 }[a.hair];
 const hairFront=frontHair?`<path d="${frontHair[0]}" fill="${hair}"/>${flat(frontHair[1],hairSh)}<path d="${frontHair[2]}" fill="none" stroke="${hairHi}" stroke-width="4"/><path d="${frontHair[0]}" fill="none"/>`
  :`<ellipse cx="124" cy="64" rx="11" ry="5" transform="rotate(-24 124 64)" fill="${light(skin,.5)}" stroke="none"/>`;
 const hairLocks=a.hair==='long'?`<g fill="${hair}"><path d="M104 92q-12 52-4 104-8 8-14-2 2-56 14-104Z"/><path d="M176 92q12 52 4 104 8 8 14-2-2-56-14-104Z"/></g>`:'';
 const mouth=female?'<path d="M127 145q7-4 13-1 6-3 13 1-12 10-26 0Z" fill="#b2574c" stroke-width="2.5"/>':'<path d="M126 146q12 6 26-3" fill="none" stroke-width="3.5"/><path d="M152 143l3-2" fill="none" stroke-width="3"/>';
 const beard=a.beard==='stubble'?`${flat('M108 122q2 28 18 40 14 6 28 0 16-12 18-40-4 20-18 28-14 6-28 0-14-8-18-28Z',hair,' opacity=".35"')}${flat('M128 139q12-3 24 0v4q-12-2-24 0Z',hair,' opacity=".35"')}`
  :a.beard==='full'?`<path d="M106 118q-2 38 18 52 16 12 32 0 20-14 18-52-4 20-18 24-8-6-16-4-8-2-16 4-14-4-18-24Z" fill="${hair}"/>${flat('M160 140q12-6 14-22 2 30-14 46-8 6-16 6 12-10 16-30Z',hairSh)}<path d="M116 150q4 8 10 10m20 4q6-2 10-8" fill="none" stroke="${hairHi}" stroke-width="3"/><path d="M106 118q-2 38 18 52 16 12 32 0 20-14 18-52-4 20-18 24-8-6-16-4-8-2-16 4-14-4-18-24Z" fill="none"/><path d="M130 150q10 5 20-1" fill="none" stroke="#5a2f2a" stroke-width="3.5"/>`
  :a.beard==='moustache'?`<path d="M140 140q-10-6-19 0-8 6-14 0 3 12 17 8 10-2 16-4 6 2 16 4 14 4 17-8-6 6-14 0-9-6-19 0Z" fill="${hair}"/><path d="M128 140q6-2 10 0" fill="none" stroke="${hairHi}" stroke-width="2"/>`:'';
 const blush=`<g fill="#d9705a" stroke="none" opacity="${female?.3:.16}"><ellipse cx="116" cy="128" rx="8" ry="5"/><ellipse cx="164" cy="128" rx="8" ry="5"/></g>`;
 // Naso piccolo e a punta, da cartone: un cuneo con il contorno solo a sinistra e sotto.
 const nose=`${flat('M141 112l-9 18q7 4 14 0Z',dark(skin,.2))}<path d="M141 112l-9 18q6 4 13 1" fill="none" stroke-width="3"/>`;

 return `<svg class="quasi-avatar" viewBox="0 0 280 350" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Il tuo Quasi"><defs><clipPath id="${id}t"><path d="${torso}"/></clipPath><clipPath id="${id}f"><path d="${face}"/></clipPath></defs><g transform="translate(0 14)" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="140" cy="333" rx="66" ry="7" fill="#00000030" stroke="none"/>${backHair}<path d="M127 150v34q13 10 26 0v-34Z" fill="${skin}"/>${flat('M127 156q13 16 26 0v14q-13 12-26 0Z',dark(skin,.28))}<g transform="translate(140 0) scale(${scale} 1) translate(-140 0)">${legs}${shoe}<g transform="${MIRROR}">${shoe}</g><path d="${torso}" fill="${top}" stroke="none"/><g clip-path="url(#${id}t)" data-avatar-outfit="${kit?.id||outfit}">${stripes}${sport||outfit==='apron'?outfitArt(kit):''}${flat('M168 180q22 6 24 30l-4 54h-26q12-34 6-84Z',dark(top,.3),' opacity=".85"')}${flat('M92 200q4-16 26-22-14 12-18 34Z',light(top,.3))}</g><path d="${torso}" fill="none"/>${details}<g transform="${armShift}">${arm}</g><g transform="${MIRROR} ${armShift}">${arm}</g>${charmArt(charm||freeCharm)}</g>${hairLocks}<ellipse cx="104" cy="108" rx="9" ry="13" fill="${skin}"/><ellipse cx="176" cy="108" rx="9" ry="13" fill="${dark(skin,.12)}"/><path d="M102 102q-4 6 0 12m76-12q4 6 0 12" fill="none" stroke-width="2.5"/><path d="${face}" fill="${skin}" stroke="none"/><g clip-path="url(#${id}f)">${flat('M164 60q18 36 8 70-8 26-32 40h50V60Z',dark(skin,.2))}${flat('M110 70q4-14 16-18-10 10-12 22Z',light(skin,.25))}</g><path d="${face}" fill="none"/>${blush}${eye(124,1)}${eye(156,-1)}${nose}${mouth}${beard}${hairFront}${a.hair==='bun'?'<path d="M128 51q12-5 24 0" fill="none" stroke="#c9533f" stroke-width="5"/>':''}${brow('M112 90q10-8 22-2')}${brow(male?'M147 86q11-8 23 1':'M148 87q10-7 21 0')}${hatArt(headwear)}</g></svg>`;
}
