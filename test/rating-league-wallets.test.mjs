import test from 'node:test';import assert from 'node:assert/strict';import {parseHTML} from 'linkedom';
import {attachRatingRanks,evaluateRatingImpact,RATING_RANK_POLICY} from '../fanta/statistical-votes/rating-impact.mjs';
import {normalizeFixture,calculateVote} from '../fanta/votes.mjs';import {apiFixture,fixtureDb} from './fanta/helpers.mjs';
import {emptyState} from '../lib/db.mjs';import {newLeague,placeSlip,creditAccount,settle} from '../lib/game.mjs';
import {migrateFantasyWallets} from '../lib/bar-fanta-wallet.mjs';import {fantasyRanking} from '../lib/bar-fanta-rankings.mjs';
import {installLeagueWallets} from '../fanta/wallet-install.mjs';import {renderSlipV2} from '../public/src/v2/slip-v2.mjs';
import {playerRanking} from '../public/src/bar-fanta-rankings.mjs';
import {stateFor} from '../lib/game.mjs';import {enhanceState} from '../lib/community.mjs';
import {patchRegion} from '../public/src/live-channel.mjs';
const input=(ranks,loss=false)=>({onField:true,providerRating:7,final:true,ratingRanks:ranks,fixture:{teamSide:'home',score:{home:loss?0:1,away:1}}});
test('all four rating ranks keep the declared proportions, choose one absolute contribution and treat losing teams differently',()=>{
 for(let rank=1;rank<=4;rank++)for(const [key,weights]of Object.entries(RATING_RANK_POLICY)){
  const kind=key.startsWith('teamWorst')?'teamWorst':key,loss=key==='teamWorstLoss';
  assert.equal(evaluateRatingImpact(input({[kind]:rank},loss)).delta,weights[rank-1]);
 }
 assert.equal(evaluateRatingImpact(input({matchBest:1,teamBest:1})).delta,.5);
 assert.equal(evaluateRatingImpact(input({matchWorst:1,teamBest:1},true)).delta,-.5);
 assert.equal(evaluateRatingImpact({...input({matchBest:1}),providerRating:null}).delta,0);
 assert.equal(evaluateRatingImpact({...input({matchBest:1}),onField:false}).delta,0);
 assert.equal(evaluateRatingImpact({...input({teamWorst:1},true),final:false}).delta,-.3);
});
test('rating ties share ranks without arbitrary player-name ordering; bench and unplayed players are excluded',()=>{
 const players=Array.from({length:12},(_,i)=>({id:'af:'+i,teamId:i<6?1:2,onField:i!==11}));
 const raw={players:[1,2].map(team=>({team:{id:team},players:players.filter(p=>p.teamId===team).map((p,i)=>({player:{id:Number(p.id.slice(3))},statistics:[{games:{rating:i<2?8:7-i/10}}]}))}))};
 const out=attachRatingRanks(players,raw);assert.equal(out[0].ratingRanks.matchBest,1);assert.equal(out[1].ratingRanks.matchBest,1);assert.equal(out[2].ratingRanks.matchBest,5);assert.equal(out[11].ratingRanks.matchBest,null);
 for(const t of raw.players)for(const p of t.players)p.statistics[0].games.rating=7;
 assert.ok(attachRatingRanks(players,raw).every(p=>evaluateRatingImpact({...p,fixture:{}}).delta===0));
});
test('rating support enters the raw technical vote once, preserves scorer floors and the separate fantasy bonus',()=>{
 const raw=apiFixture();for(const [ti,t]of raw.players.entries())for(const [pi,p]of t.players.entries())p.statistics[0].games.rating=String(5+(ti*11+pi)/10);
 const p=normalizeFixture(raw).find(p=>p.apiId===3),vote=calculateVote(p);assert.equal(vote.ratingImpact.available,true);
 assert.equal(vote.breakdown.lines.filter(x=>x.key==='provider-rating-rank').length,1);
 assert.ok(Math.abs(vote.breakdown.start+vote.breakdown.lines.reduce((n,x)=>n+x.delta,0)-vote.vote)<1e-6);
 assert.ok(vote.vote>=6);assert.equal(vote.fantavote-vote.vote,3);
});
function walletState(){
 const s=emptyState(),u={id:'u',name:'Sintetico',username:'synthetic',emailVerified:true},l=newLeague(s,u,'Bar sintetico',true);s.users=[u];
 const round=(id,key,native,slips=[])=>({id,league:l.id,source:'fantacalcio',competitionKey:key,competitionName:key,fantasyLeagueName:native||key,nativeFanta:native?{leagueId:native,competitionId:key}:undefined,virtualBookmaker:true,number:8,title:'Giornata 8',kickoff:'2099-01-01T15:00Z',rules:{...l.rules,maxStake:500},matches:[{id:'m'+id,home:'Casa',away:'Ospite',odds:{1:2},status:'NS'}],slips});
 const a=round('a','A','native-a',[{uid:'u',stake:100,prize:200,creditsSettled:true}]),b=round('b','B','native-b',[{uid:'u',stake:50,creditsSettled:false}]);s.rounds=[a,b];l.members[0].fantasyWallet={initial:500,credits:550};l.members[0].competitionPoints={A:4,B:-1};return {s,u,l,a,b,round};
}
test('wallet split preserves all stakes/payouts, isolates rankings and is idempotent without touching avatars or Serie A funds',()=>{
 const {s,l,a,b}=walletState(),member=l.members[0];s.users[0].avatar={hair:'long'};s.playerRewards={u:[{ids:['crown']}]};const before=JSON.stringify({users:s.users,rewards:s.playerRewards,rounds:s.rounds,ledger:s.ledger});
 assert.equal(migrateFantasyWallets(s),1);assert.equal(creditAccount(l,a,'u').credits,600);assert.equal(creditAccount(l,b,'u').credits,450);assert.equal(member.credits,500);
 const stable=JSON.stringify(l);assert.equal(migrateFantasyWallets(s),0);assert.equal(JSON.stringify(l),stable);assert.equal(JSON.stringify({users:s.users,rewards:s.playerRewards,rounds:s.rounds,ledger:s.ledger}),before);
 const groups=fantasyRanking(s,l).groups;assert.equal(groups.find(g=>g.key==='native-a').members[0].points,4);assert.equal(groups.find(g=>g.key==='native-b').members[0].points,-1);
 const html=playerRanking({...l,fantasyRanking:{groups}},'fantacalcio','credits',s.users[0],String,String,'native-b');assert.match(html,/450 disponibili/);assert.doesNotMatch(html,/600 disponibili|Un solo saldo/);
});
test('different competitions of one fantasy league share its budget; another league has an independent one',()=>{
 const {s,l,u,a,b,round}=walletState();a.slips=[];b.slips=[];l.members[0].fantasyWallet.credits=500;
 const cup=round('cup','Cup','native-a');s.rounds.push(cup);migrateFantasyWallets(s);
 placeSlip(s,l,a,u,{stake:400,picks:{ma:'1'}});assert.throws(()=>placeSlip(s,l,cup,u,{stake:200,picks:{mcup:'1'}}),/insufficienti/);
 placeSlip(s,l,b,u,{stake:200,picks:{mb:'1'}});assert.equal(creditAccount(l,a,'u').credits,100);assert.equal(creditAccount(l,b,'u').credits,300);
});
test('the first enhanced snapshot exposes migrated wallets without requiring another state read',()=>{
 const {s,u}=walletState(),snapshot=structuredClone(stateFor(s,u));
 const view=enhanceState(s,u,snapshot),l=view.leagues[0];
 assert.equal(l.members[0].fantasyWallets['native-a'].credits,600);
 assert.equal(l.members[0].fantasyWallets['native-b'].credits,450);
 assert.equal(l.fantasyWalletScopes.A,'native-a');
});
test('live ranking patches preserve the styled metric selector and its handlers while updating scores',()=>{
 const {document,window}=parseHTML('<html><body><div class="card"><label class="ranking-metric">Ordina per<div class="quasi-select"><select id="ranking-metric"><option>Crediti</option></select><button role="combobox">Crediti</button></div></label><div data-ranking-user="u">490</div></div></body></html>');
 const selector=document.querySelector('select'),button=document.querySelector('button');let changed=0;selector.addEventListener('change',()=>changed++);
 patchRegion(document.querySelector('.card'),'<div class="card"><label class="ranking-metric">Ordina per<select id="ranking-metric"><option>Punti</option></select></label><div data-ranking-user="u">510</div></div>');
 assert.equal(document.querySelector('select'),selector);assert.equal(document.querySelector('button'),button);assert.equal(document.querySelector('[data-ranking-user]').textContent,'510');selector.dispatchEvent(new window.Event('change'));assert.equal(changed,1);
});
test('next round accepts a slip while the current round is closed and keeps round-specific drafts and confirmations',()=>{
 const {s,l,u,a,round}=walletState();a.closed=true;a.kickoff='2026-01-01T15:00Z';
 const next=round('next','A','native-a');next.matches[0].odds={1:2,X:3,2:4};next.number=9;s.rounds.push(next);migrateFantasyWallets(s);
 placeSlip(s,l,next,u,{stake:10,picks:{mnext:'1'}});assert.equal(next.slips.length,1);assert.equal(a.slips.length,1);
 const {document}=parseHTML('<html><body>'+renderSlipV2({round:next,picks:{mnext:'1'},stake:11,credits:creditAccount(l,next,'u').credits,esc:String,fmt:String,date:String})+'</body></html>');assert.equal(document.querySelector('#save-slip').hasAttribute('disabled'),false);
 assert.throws(()=>placeSlip(s,l,a,u,{stake:10,picks:{ma:'1'}}),/chiusa/);
});
test('production wallet installation writes only league balances once and preserves all other database fields',async()=>{
 const f=await fixtureDb();try{const {s}=walletState();s.users[0].avatar={outfit:'jersey'};s.playerRewards={u:[{ids:['test']}]};await f.db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);
  const first=await installLeagueWallets({connect:f.connect});assert.equal(first.members,1);
  const after=(await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
  for(const key of ['users','rounds','ledger','playerRewards'])assert.deepEqual(after[key],s[key]);
  const second=await installLeagueWallets({connect:f.connect});assert.equal(second.members,0);assert.deepEqual((await f.db.query('SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload,after);
 }finally{await f.close();}
});
