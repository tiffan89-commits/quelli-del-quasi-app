import test from 'node:test';import assert from 'node:assert/strict';
import {DEFAULT_RULES,bonuses,defenseModifier,scoreLineup,validateLineup,goalsFor,standings} from '../fanta/rules.mjs';
import {normalizeFixture,calculateVote,validateAi,aiAdjustment,priceList} from '../fanta/votes.mjs';
import {auctionAction,advanceAuction,teamBudget,duration} from '../fanta/auction.mjs';
import {apiFixture} from './fanta/helpers.mjs';
const input={id:'p',role:'A',minutes:90,final:true,onField:true,events:{},metrics:{keyPasses:1,shotsTotal:2,shotsOn:1,dribbles:1,dribblesAttempts:2,duelsWon:3,duelsTotal:6,passesTotal:40,passAccuracy:80,saves:3}};
test('Fanta: fantasy bonuses are separate from technical event adjustments and keeper match support never becomes a fantasy bonus',()=>{
 for(const [key,value]of Object.entries(DEFAULT_RULES.bonus)){const p={...input,role:['conceded','penSaved'].includes(key)?'P':'A',events:{[key]:1}},v=calculateVote(p),without=calculateVote({...p,events:{}});assert.equal(v.fantavote-v.vote,value,key);if(key==='goals')assert.ok(v.vote>=6);else if(key==='penSaved')assert.ok(v.vote>=6.5);else if(key==='penMissed')assert.equal(v.eventImpact.penaltyMissedDelta,-.5);else if(key!=='conceded')assert.equal(v.vote,without.vote);}
 assert.equal(bonuses({cleanSheet:1},'P').length,0);
});
test('Fanta: modifier golden boundaries and fewer than four defenders',()=>{
 for(const [value,bonus]of [[5.99,0],[6,1],[6.49,1],[6.5,2],[6.99,2],[7,3]]){const ps=['P','D','D','D','D'].map((role,i)=>({id:String(i),name:'P'+i,role,vote:value,fantavote:value+3}));const m=defenseModifier(ps,'4-4-2');assert.equal(m.bonus,bonus,String(value));assert.equal(m.average,value);assert.equal(defenseModifier(ps.slice(0,4),'3-4-3').applies,false);}
 assert.equal(goalsFor(65.99),0);assert.equal(goalsFor(66),1);assert.equal(goalsFor(72),2);
});
test('Fanta: unlimited same-role substitutions preserve formation and bench order',()=>{
 const players=[{id:'g',role:'P',vote:6,fantavote:6,status:'voted'},{id:'a',name:'Out',role:'D',vote:null,status:'sv'},{id:'wrong',role:'C',vote:9,fantavote:9},{id:'first',name:'First',role:'D',vote:6,fantavote:6},{id:'second',role:'D',vote:8,fantavote:8}];
 const sheet=scoreLineup({formation:'4-4-2',starters:['g','a'],bench:['wrong','first','second']},players);assert.deepEqual(sheet.substitutions,[{out:'a',in:'first'}]);assert.equal(sheet.formation,'4-4-2');assert.equal(sheet.starters[1].replacedBy,'First');
});
test('Fanta: under fifteen minutes gets SV unless a bonus/malus supplies six; live first25 remains six',()=>{
 assert.equal(calculateVote({...input,minutes:14}).status,'sv');assert.equal(calculateVote({...input,minutes:14,events:{yellow:1}}).fantavote,5.5);assert.ok(Number.isFinite(calculateVote({...input,minutes:15}).vote));
 assert.equal(calculateVote({...input,final:false,minutes:25,metrics:{shotsOn:20}}).vote,6);
 const v=calculateVote({...input,metrics:{shotsOn:5,keyPasses:4}});assert.equal(Math.round((6+v.breakdown.lines.reduce((s,l)=>s+l.delta,0))*100)/100,v.vote);
});
test('Fanta: keeper conceded goals follow substitutions; pass accuracy is a count, not a percentage',()=>{
 const f=apiFixture();f.goals.home=2;f.events.push({type:'subst',time:{elapsed:30},team:{id:20},player:{id:2},assist:{id:5}},{type:'Goal',detail:'Penalty',time:{elapsed:40},team:{id:10},player:{id:3}});
 f.players[1].players.push({player:{id:5,name:'Sub keeper'},statistics:[{games:{position:'G',minutes:60,substitute:true}}]});const rows=normalizeFixture(f);
 assert.equal(rows.find(x=>x.apiId===2).events.conceded,1);assert.equal(rows.find(x=>x.apiId===5).events.conceded,1);assert.equal(rows.find(x=>x.apiId===1).metrics.passAccuracy,70);
 f.events.push({type:'Goal',detail:'Missed Penalty',time:{elapsed:50},team:{id:10},player:{id:3},comments:'Off Target'});let r=normalizeFixture(f);assert.equal(r.find(x=>x.apiId===3).events.penMissed,1);assert.equal(r.find(x=>x.apiId===5).events.penSaved,0);
 f.events.at(-1).comments='Saved by goalkeeper';r=normalizeFixture(f);assert.equal(r.find(x=>x.apiId===5).events.penSaved,1);
 f.events.at(-1).comments=null;r=normalizeFixture(f);assert.equal(r.find(x=>x.apiId===5).needsReview,true);
});
test('Fanta: the deterministic model never accepts AI corrections or makes AI requests',async()=>{let calls=0;assert.equal(validateAi({delta:.5}),null);assert.equal(await aiAdjustment(input,{env:{ANTHROPIC_API_KEY:'synthetic'},fetcher:()=>calls++}),null);assert.equal(calls,0);assert.equal(calculateVote(input,{ai:{delta:.5}}).vote,calculateVote(input).vote);});
test('Fanta: pricing is deterministic, role-specific, has minimum one and an explanation',()=>{const players=['P','D','C','A'].flatMap(role=>[1,2,3].map(n=>({id:role+n,role,played:n,avgFanta:6+n/10,matches:10})));const a=priceList(players);assert.deepEqual(a,priceList(players));assert.ok(a.every(p=>p.value>=1&&p.valueWhy));});
function auction(){return {league:{adminUid:'u1'},rules:structuredClone(DEFAULT_RULES),players:[{id:'p',name:'A',role:'A'}],teams:[{id:'t1',userId:'u1',roster:[]},{id:'t2',userId:'u2',roster:[]}],auction:{status:'running',mode:'live',caller:'t1',callDeadline:new Date(100000).toISOString(),order:['t1','t2'],log:[],version:1,lot:null}};}
test('Fanta: online auction uses exact 60/30 deadlines, rejects wrong turns and passed bidders, closes immediately for unanimous pass',()=>{
 let s=auction(),counter=0,id=()=>String(++counter);assert.equal(duration(60),60000);assert.equal(duration(30),30000);
 assert.throws(()=>auctionAction(s,'nominate',{playerId:'p'},'u2',{now:1000}),/turno/);
 s=auctionAction(s,'nominate',{playerId:'p',amount:1},'u1',{now:1000,id});const lot=s.auction.lot.id;assert.equal(Date.parse(s.auction.lot.endsAt),61000);
 s=auctionAction(s,'bid',{lotId:lot,amount:2},'u2',{now:2000,id});assert.equal(Date.parse(s.auction.lot.endsAt),32000);
 s=auctionAction(s,'pass',{lotId:lot},'u1',{now:3000,id});assert.equal(s.auction.lot.closing,true);assert.throws(()=>auctionAction(s,'bid',{lotId:lot,amount:3},'u1',{now:3500}),/passato/);
 advanceAuction(s,5000,{id});assert.equal(s.teams[1].roster[0].price,2);assert.equal(s.auction.lot,null);
});
test('Fanta: manual auction has no timer, reserves credits and supports a reversible audited sale',()=>{
 let s=auction();s.auction.mode='manual';const before=teamBudget(s.teams[0],s.rules).maxBid;
 assert.throws(()=>auctionAction(s,'table',{playerId:'p'},'u2',{now:1000}),/presidente/);
 s=auctionAction(s,'table',{playerId:'p'},'u1',{admin:true,now:1000});s=auctionAction(s,'assign',{playerId:'p',teamId:'t1',price:10},'u1',{admin:true,now:1000,id:()=> 'sale1'});assert.equal(s.teams[0].roster[0].price,10);assert.equal(teamBudget(s.teams[0],s.rules).maxBid,before-9);
 s=auctionAction(s,'undo',{saleId:'sale1'},'u1',{admin:true,now:1000});assert.equal(s.teams[0].roster.length,0);assert.equal(s.auction.log[0].undone,true);
});

test('Fanta: the bench is optional; every size from zero to the remaining roster is valid despite old limits',()=>{
 const players=Object.entries(DEFAULT_RULES.roster).flatMap(([role,n])=>Array.from({length:n},(_,i)=>({id:role+i,role}))),starters=['P0',...'D0 D1 D2 D3 C0 C1 C2 C3 A0 A1'.split(' ')],rest=players.filter(p=>!starters.includes(p.id)).map(p=>p.id);
 for(let n=0;n<=rest.length;n++){const input={formation:'4-4-2',starters,bench:rest.slice(0,n)};assert.deepEqual(validateLineup(input,players,{...DEFAULT_RULES,benchMax:1}),input);}
 assert.throws(()=>validateLineup({formation:'4-4-2',starters,bench:['P0']},players),/una sola volta/);assert.throws(()=>validateLineup({formation:'4-4-2',starters,bench:['other']},players),/tua rosa/);
});
