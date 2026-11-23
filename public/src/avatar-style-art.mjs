import {dark,light} from './avatar-art.mjs';

const HAIR = {
 fade: {
  front:['M101 99q-8-31 6-47 14-16 41-14 28 2 32 28l-2 33-7-21-1-17q-22-10-56 2l-4 18Z','M102 71q1-13 12-18l-4 29-9 17Z','M116 53q16-10 36-7m-30 13q13-4 27-4'],
 },
 'side-part': {
  front:['M101 101q-8-38 9-54 25-24 56-7 17 9 16 39l-4 22-8-24-10-11q-13 16-34 13l-13-4Z','M163 51q21 7 15 50l-8-24-10-11Z','M110 62q20 6 41-15m-36 22q20 6 36-12'],
 },
 quiff: {
  front:['M102 102q-12-39 6-55l-7-18q20 5 38-4 28-14 46 4l-14 3q18 16 13 49l-7 21-7-27q-29 14-52-2Z','M170 39q16 14 12 43l-5 20-7-27-9 3Z','M115 47q19 3 37-10 10-7 18-5m-49 28q22 1 39-13'],
 },
 bob: {
  back:'M96 90q-4-49 44-51 47 2 45 48l4 74q-14 10-32 1h-36q-20 10-34-1Z',
  front:['M102 115q-14-56 14-69 25-15 48-1 25 12 15 66l-10-23q-23-4-30-24-8 19-26 24Z','M163 58q16 14 16 53l-10-23-13-12Z','M110 71q10-17 25-17m14 1q18 3 23 16'],
  locks:'M102 91q-9 35-4 69-12 8-17-2l6-42 9-22Zm76 0q9 35 4 69 12 8 17-2l-6-42-9-22Z',
 },
 pixie: {
  front:['M101 104q-8-31 9-50-1-7 6-16l7 9q13-16 33-10l-2 6 18 3 11 14q3 25-6 43l-7-25q-13 7-25-4l-18 10 2-10-14 9Z','M167 54q20 9 10 49l-7-25-10 3Z','M112 69q10-3 19-12m-7 14 21-18 7-5'],
 },
 pony: {
  back:'M154 51q12-24 33-12 20 13 17 46-1 27 10 39-8 14-22 2-11-12-10-35 1-24-15-20Z',
  front:['M101 99q-8-36 13-53 21-17 47-7 24 8 21 41l-5 19-10-23q-34-6-49 3l-8 2Z','M168 56q15 11 13 29l-4 14-10-23Z','M112 63q22-23 50-15m-38 21q19-13 35-10'],
 },
 braid: {
  back:'M96 103q-5-47 34-58 42-11 57 32l-8 62h-15l-4-31h-45l-5 33H96Z',
  front:['M102 102q-8-24 5-43 11-19 34-21 33-3 40 29l-2 37-9-22q-18-2-25-23-7 22-30 26Z','M158 54q21 3 21 50l-9-22Z','M110 73q10-16 26-20m19-1q11 7 16 21'],
  locks:'M170 91q12 16 9 40 12 8 7 20 11 8 6 20 10 8 7 17l-10 13-10-11 1-10q-10-3-8-16-10-6-5-18-9-8-5-20l2-25Z',
  accent:'M168 133l11 6m-10 10 15 7m-9 10 14 9m-8 6 12 7',
 },
 afro: {
  back:'M87 134q-15-7-12-24-12-15-3-28-5-20 11-30 1-20 22-24 12-16 34-11 20-7 35 8 20 1 23 21 17 7 15 26 11 16 0 29 4 19-13 28-10 15-30 12l-73 2q-18 5-23-9Z',
  front:['M100 107q-14-4-11-20-7-14 7-26-1-16 17-17 10-14 27-6 16-10 29 3 17 0 20 16 15 10 8 26 3 17-18 25-5-23-18-26-7 8-21 4-15 5-24-3-12 7-16 24Z','M174 61q19 11 12 34l-7 13-7-19-11-7Z','M95 57q4-13 16-14m6-10q9-7 18-3m11-2q10-5 19 2m7 10q10 3 13 11'],
 },
};

export function extraHair(style,color) {
 const art=HAIR[style];
 if(!art)return null;
 const shape=d=>d?'<path d="'+d+'" fill="'+color+'"/>':'';
 const high=light(color,.38);
 return {front:art.front,back:shape(art.back),locks:shape(art.locks)+(art.accent?'<path d="'+art.accent+'" fill="none" stroke="'+high+'" stroke-width="2.7"/>':'')};
}

const BEARD = {
 boxed:['M108 116l6 12 2 18 10 6 7-8h14l7 8 10-6 2-18 6-12 1 36-12 13h-42l-12-13Z','M121 156q7 5 15 5m12-1 12-5'],
 goatee:['M128 151q12 6 24 0l-2 13-10 9-10-9Z','M134 158l6 7 4-5'],
 'van-dyke':['M126 152q7 4 14 1 7 3 14-1l-3 13-11 13-11-13Z M117 138q9-5 23 2 14-7 23-2l-2 7q-10-3-21-1-11-2-21 1Z','M136 159l4 11'],
 handlebar:['M140 140q10-6 20-1 17 9 17-2 8 4 4 11-8 8-23 1-10-5-18-4-8-1-18 4-15 7-23-1-4-7 4-11 0 11 17 2 10-5 20 1Z','M110 146q7-1 14-4m32 0 14 4'],
 sideburns:['M104 103l10 7 1 31-7 4-6-17Z M176 103l-10 7-1 31 7 4 6-17Z','M109 116l1 16m61-16-1 16'],
};

export function extraBeard(style,color) {
 const art=BEARD[style];
 if(!art)return '';
 const [shape,high]=art;
 return '<path d="'+shape+'" fill="'+color+'" stroke-width="3"/><path d="'+high+'" fill="none" stroke="'+light(color,.38)+'" stroke-width="2.6"/>';
}

const FASHION = {
 'pleated-skirt': {hem:'M103 247h74l17 45q-23 8-54 6-31 2-54-6Z',lines:'M110 256l-8 36m20-36-4 39m21-39v40m19-40 4 39m8-39 8 36',belt:true},
 'denim-skirt': {hem:'M102 248h76l9 40q-47 12-94 0Z',lines:'M108 259q4 10 13 8m51-8q-4 10-13 8m-19-11v36',belt:true,buttons:true},
 'tennis-dress': {hem:'M102 247h76l15 43q-53 14-106 0Z',lines:'M110 256l-9 34m23-33-5 36m33-37 6 37m11-36 9 33',sport:true,trim:'M97 286q43 10 86 0'},
 'summer-dress': {hem:'M102 241h76l18 54q-23 8-56 8t-56-8Z',lines:'M119 258l-7 30m50-30 7 31',sleeveless:true,trim:'M94 291q46 13 92 0',dots:true},
 'wrap-dress': {hem:'M100 243h80l12 57q-31 6-63 0l-27-12-14 4Z',lines:'M154 255q-11 24-25 45m-12-42-10 25',wrap:true},
};

export function fashionArt(style,color,skin,trim) {
 const design=FASHION[style];
 if(!design)return null;
 const {hem,lines,belt,buttons,sport,sleeveless,wrap,dots}=design;
 const shade=dark(color,.28);
 const bareLegs='<path d="M104 280v40h25v-40Zm47 0v40h25v-40Z" fill="'+skin+'"/>';
 const socks=sport?'<path d="M103 303h26v18h-26Zm48 0h26v18h-26Z" fill="'+trim+'"/><path d="M105 308h22m26 0h22" stroke="'+color+'" stroke-width="2.5"/>':'';
 const pleats='<path d="'+lines+'" fill="none" stroke="'+shade+'" stroke-width="3"/>';
 const accents=design.trim?'<path d="'+design.trim+'" fill="none" stroke="'+trim+'" stroke-width="3"/>':'';
 const closure=buttons?'<path d="M140 264h.1m0 11h.1m0 11h.1" fill="none" stroke="'+trim+'" stroke-width="3.5"/>':'';
 const print=dots?'<path d="M112 267h.1m14 14h.1m16-14h.1m14 14h.1m16-14h.1m-58 14h.1m28 12h.1m28-12h.1" stroke="'+trim+'" stroke-width="4"/>':'';
 const legs=bareLegs+socks+'<path d="'+hem+'" fill="'+color+'"/>'+pleats+accents+closure+print;
 const top=belt?light(color,.7):color;
 const details=wrap?'<path d="M118 177l44 68m0-68-44 68" stroke="'+trim+'" fill="none" stroke-width="3"/><path d="M103 244q37 9 74 0v9q-37 9-74 0Z" fill="'+shade+'"/><path d="M161 250l14 1 5 19-13-5-7 8Z" fill="'+shade+'" stroke-width="2.8"/>':
  belt?'<path d="M98 247h84v9H98Z" fill="'+shade+'"/><path d="M136 248h8v6h-8Z" fill="'+trim+'" stroke-width="2"/>':
  '<path d="M105 244q35 7 70 0" stroke="'+trim+'" fill="none" stroke-width="3"/>';
 const neckline=sleeveless?'<path d="M118 178v15q22 7 44 0v-15" stroke="'+trim+'" fill="none" stroke-width="3.4"/>':'';
 return {top,legs,details:details+neckline,sleeveless,sport};
}
