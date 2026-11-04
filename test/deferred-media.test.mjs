import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const source=fs.readFileSync(new URL('../public/src/deferred-media.mjs',import.meta.url),'utf8');
function harness(){let now=0,io;const events={},timers=[],images=[];
 const document={nodeType:9,hidden:false,documentElement:{},addEventListener:(n,fn)=>events[n]=fn,querySelectorAll:()=>images};
 const ctx={document,window:{dispatchEvent(){}},CustomEvent:class{},Date:{now:()=>now},setInterval(){},setTimeout(fn){timers.push(fn);return timers.length;},IntersectionObserver:class{constructor(fn){io=fn;}observe(){}unobserve(){}},MutationObserver:class{observe(){}}};vm.runInNewContext(source,ctx);
 function image({closed=false,urgent=false}={}){const listeners={};const p={tagName:'DETAILS',open:!closed,parentElement:null};const img={isConnected:true,parentElement:p,dataset:{deferredSrc:'/local/photo',mediaPriority:urgent?'user':'idle'},complete:false,getClientRects:()=>[{}],closest:()=>urgent?{}:null,addEventListener:(n,fn)=>listeners[n]=fn,removeEventListener(){},done:()=>listeners.load?.()};images.push(img);return img;}
 return{image,scan(){vm.runInNewContext('scan(document)',ctx);io(images.map(target=>({target,isIntersecting:true})));},tick(t){now=t;const q=timers.splice(0);q.forEach(fn=>fn());},toggle:()=>events.toggle(),input:()=>events.pointerdown(),pending:()=>timers.length};
}
test('visible images wait for inactivity, cap concurrent downloads at two and closed sections stay unloaded',()=>{
 const h=harness(),a=h.image(),b=h.image(),c=h.image(),hidden=h.image({closed:true});h.scan();h.tick(100);assert.equal(a.src,undefined);h.tick(700);assert.equal(a.src,'/local/photo');assert.equal(b.src,'/local/photo');assert.equal(c.src,undefined);assert.equal(hidden.src,undefined);a.done();h.tick(800);assert.equal(c.src,'/local/photo');b.done();c.done();h.tick(900);assert.equal(hidden.src,undefined);assert.equal(h.pending(),0);hidden.parentElement.open=true;h.toggle();h.tick(1000);assert.equal(hidden.src,'/local/photo');
});
test('an explicitly opened match can load its visible photos without waiting for idle',()=>{const h=harness(),a=h.image({urgent:true});h.scan();h.tick(10);assert.equal(a.src,'/local/photo');assert.equal(a.fetchPriority,'high');});
test('photos of an explicitly opened match load up to six at a time, everything else stays at two',()=>{
 const h=harness(),urgent=Array.from({length:8},()=>h.image({urgent:true}));h.scan();h.tick(10);
 assert.equal(urgent.filter(i=>i.src==='/local/photo').length,6);
 const h2=harness(),idle=Array.from({length:5},()=>h2.image());h2.scan();h2.tick(100);h2.tick(800);
 assert.equal(idle.filter(i=>i.src==='/local/photo').length,2);
});
test('the lineup omits the club line when it repeats the team name but keeps it for mixed fantasy squads',async()=>{
 const {renderLineup}=await import('../public/src/lineup-pitch.mjs');
 const players=Array.from({length:11},(_,i)=>({name:'P'+i,club:i===0?'Inter':'Milan'}));
 const html=renderLineup({lineups:{kind:'probable',teams:[{team:'Milan',formation:'4-4-2',players,bench:[]}]}});
 assert.equal((html.match(/pitch-player-club/g)||[]).length,1);assert.match(html,/pitch-player-club">Inter/);
});
