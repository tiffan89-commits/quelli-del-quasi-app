import {ACHIEVEMENTS} from './achievements.mjs';
import {ROOM_REWARDS,canonicalRoomRewardId} from './locker-rooms.mjs';
// 1,000 visual combinations generated from original motifs, plus shared achievements.
const palettes=[['Menta del recupero','#9fcba6'],['Oro del novantesimo','#d5ac54'],['Granata del VAR','#b65050'],['Azzurro trasferta','#5289b9'],['Viola del palo','#9668b1'],['Panna della domenica','#e9dfbe'],['Arancio contropiede','#e48d51'],['Bosco del mister','#4d7862'],['Rosa fuorigioco','#d88bab'],['Petrolio da derby','#357f82'],['Rame del rigore','#b47a51'],['Ghiaccio da trasferta','#9dcbd6'],['Notte di coppa','#4c5685'],['Limone della curva','#c6ce61'],['Mattone del bar','#aa6559'],['Lavanda tattica','#b9a0d4'],['Prugna del pareggio','#895579'],['Sabbia del campetto','#bfaa7c'],['Argento della panchina','#b8c4c2'],['Corallo del recupero','#db756a']];
const types={
 title:['Filosofo del palo','Ministro del quasi','Profeta del recupero','Analista del bancone','Oracolo della curva','Contabile dei sogni','Poeta del pareggio','Mago della schedina','Stratega del tovagliolo','Direttore del VAR'],
 charm:['Cornetto anti-palo','Quadrifoglio del recupero','Pallone dei miracoli','Tazzina del mister','Ferro del pareggio','Schedina benedetta','Fischietto del destino','Moneta del novantesimo','Scarpino della gloria','Matita del pronostico'],
 outfit:['Maglia diagonale','Maglia della curva','Giacca del dopopartita','Maglia stellata','Divisa del recupero','Completo a quadretti','Maglia zigzag','Sciarpa del derby','Divisa del campetto','Maglia del bancone'],
 color:['Vernice da curva','Tinta del mister','Pigmento del palo','Smalto da derby','Colore del recupero','Riflesso del novantesimo','Bagliore da coppa','Tono del campetto','Luce da trasferta','Sfumatura del quasi'],
 headwear:['Corona del bancone','Alloro del quasi','Berretto del mister','Visiera del recupero','Basco del tattico','Cappello da festa','Fascia della curva','Cilindro del pronostico','Diadema del derby','Coppola del bar'],
};
const epithets=['a sangue freddo','del lunedì sera','in trasferta','senza appello','del tempo perso','con vista sul palo','a piede invertito','dalla panchina','sotto la pioggia','col brivido','a luci spente','da primo anello','del terzo tempo','con riserva','delle grandi occasioni','a porta vuota','del minuto 93','in doppiopetto','da ultima chiamata','senza pronostico'];
const colorNames=['menta','oro','granata','blu','viola','panna','arancio','bosco','rosa','petrolio','rame','ghiaccio','notte','limone','mattone','lavanda','prugna','sabbia','argento','corallo'];
const shortMotifs={
 title:['Filosofo','Ministro','Profeta','Analista','Oracolo','Contabile','Poeta','Mago','Stratega','Direttore'],
 charm:['Cornetto','Quadrifoglio','Pallone','Tazzina','Ferro','Schedina','Fischietto','Moneta','Scarpino','Matita'],
 outfit:['Diagonale','Curva','Giacca','Stellata','Recupero','Quadretti','Zigzag','Sciarpa','Campetto','Grembiule'],
 headwear:['Corona','Alloro','Berretto','Visiera','Basco','Cappello','Fascia','Cilindro','Diadema','Coppola'],
};
const colorTones=['profondo','ombra','scuro','fumé','classico','tenue','chiaro','luminoso','vivo','acceso'];
const shortTitles=['gelido','notturno','ospite','deciso','smarrito','sfortunato','mancino','riserva','bagnato','audace','invisibile','ultrà','festaiolo','prudente','elegante','letale','tardivo','distinto','disperato','improvvisato'];
export const REWARD_SLOTS={title:'rewardTitle',charm:'rewardCharm',outfit:'rewardOutfit',color:'rewardColor',headwear:'rewardHat',room:'rewardRoom'};
export const REWARD_TYPES={title:'Titoli',charm:'Portafortuna',outfit:'Abbigliamento',color:'Colori',headwear:'Corone e copricapi',room:'Spogliatoi'};
export function stableHash(text){let h=2166136261;for(const c of String(text)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
const shade=(hex,n)=>'#'+hex.slice(1).match(/../g).map(v=>Math.max(0,Math.min(255,parseInt(v,16)+n)).toString(16).padStart(2,'0')).join('');
export const REWARD_CATALOG=Object.entries(types).flatMap(([type,motifs],t)=>motifs.flatMap((name,motif)=>palettes.map(([palette,color],edition)=>{
 const n=t*200+motif*20+edition,rarity=n%20<10?'common':n%20<16?'rare':n%20<19?'epic':'legendary';
 const tone=colorNames[edition],isColor=type==='color';
 const shortName=isColor ? tone[0].toUpperCase()+tone.slice(1) : shortMotifs[type][motif]+' '+(type==='title'?shortTitles[edition]:tone);
 return {id:'quasi-'+String(n+1).padStart(4,'0'),type,motif,color:isColor?shade(color,(motif-4)*4):color,secondary:shade(color,-45),name:type==='title'?name+' '+epithets[edition]:name+' · '+palette,shortName,rarity,...(isColor?{colorTone:colorTones[motif]}:{})};
})));
REWARD_CATALOG.push({id:'king-crown',type:'headwear',motif:10,color:'#edc25f',secondary:'#aa7135',name:'Corona · King del betting',shortName:'Corona regale',rarity:'legendary'},{id:'king-title',type:'title',motif:0,color:'#edc25f',name:'King del betting',shortName:'Re assoluto',rarity:'legendary'},{id:'almost-title',type:'title',motif:0,color:'#b6c4cf',name:'Sua Quasità · un errore dalla gloria',shortName:'Sua Quasità',rarity:'epic'});
REWARD_CATALOG.push(...ROOM_REWARDS,...ACHIEVEMENTS.map(a=>a.reward));
const index=new Map(REWARD_CATALOG.map(r=>[r.id,r]));
export const rewardById=id=>index.get(canonicalRoomRewardId(id))||null;
export const rarityLabel={common:'Da bar',rare:'Raro',epic:'Epico',legendary:'Leggendario'};
export function rewardMark(reward){const r=typeof reward==='string'?rewardById(reward):reward;if(!r)return '';const signs={title:'✦',charm:'✧',outfit:'◈',color:'●',headwear:'♛',room:'⌂'};return `<span class="reward-mark rarity-${r.rarity}" style="--reward-color:${r.color}">${signs[r.type]}</span>`;}
