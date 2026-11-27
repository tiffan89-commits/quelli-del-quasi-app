import test from 'node:test';
import assert from 'node:assert/strict';
import {claimWork,completeWork,refreshPlan} from '../lib/operations/calendar.mjs';
import {patchQuote} from '../lib/api-football-odds.mjs';
import {estimateSerieAOdds} from '../lib/seriea-odds-estimate.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {mergeLiveSnapshot} from '../public/src/live-channel.mjs';
import {slipWaitingForPrevious,roundAvailability} from '../public/src/slip-state.mjs';
import {availabilityFromCards} from '../fanta/availability-discipline.mjs';
import {availabilityFromNews,readAvailabilityFeed} from '../fanta/availability-news.mjs';
import {collectAvailability} from '../fanta/player-availability.mjs';
import {presenceProbability,statusForFixture} from '../public/src/fanta/presence-probability.mjs';

const now=Date.parse('2026-11-23T22:00Z');
const start='2026-11-27T19:45:00.000Z';
test('the opening job runs after the last final, survives a retry, and schedules a single follow-up check',()=>{
 const fixtures=Array.from({length:10},(_,i)=>({id:'p'+i,round:12,kickoff:'2026-11-23T19:45:00.000Z',status:i<9?'FT':'2H'}));
 fixtures.push({id:'upcoming',round:13,kickoff:start,status:'NS'});
 const plan={fixtures,jobs:[]};
 assert.ok(!claimWork(plan,{now}).jobs.some(j=>j.kind==='round-opening'));
 assert.ok(!claimWork(refreshPlan(plan,[{id:'p9',status:'TIMED_OUT'}],{now}),{now}).jobs.some(j=>j.kind==='round-opening'));
 const final=refreshPlan(plan,[{id:'p9',status:'FT'}],{now});
 const run=claimWork(final,{now,nonce:'first'});
 const job=run.jobs.find(j=>j.kind==='round-opening');
 assert.deepEqual(job.fixtureIds,['upcoming']);
 assert.ok(!claimWork(run.plan,{now}).jobs.some(j=>j.kind==='round-opening'));
 const retry=completeWork(run.plan,job,{ok:false,error:'database unavailable'},{now});
 const again=claimWork(retry,{now:now+300000,nonce:'second'});
 const complete=completeWork(again.plan,again.jobs.find(j=>j.id===job.id),{ok:true,checkAvailabilityAgain:true},{now:now+300000});
 const followup=complete.jobs.find(j=>j.availabilityOnly);
 const confirmation=claimWork(complete,{now:Date.parse(followup.at),nonce:'third'});
 assert.equal(confirmation.jobs.find(j=>j.kind==='round-opening').id,followup.id);
 assert.ok(!claimWork(complete,{now:Date.parse(start)}).jobs.some(j=>j.kind==='round-opening'));
});

test('estimates favour the team in form and preserve book prices, then the socket opens the priced slip',t=>{
 t.mock.timers.enable({apis:['Date'],now});
 const fixture={id:'next',home:'Como',away:'Parma',kickoff:start,status:'NS'};
 const history=Array.from({length:5},(_,i)=>({...fixture,kickoff:new Date(now-(i+1)*86400000).toISOString(),score:[3,0]}));
 const model=estimateSerieAOdds([fixture],history,now).get(fixture.id);
 assert.equal(Object.keys(model).length,10);
 assert.ok(model['1'].value<model['2'].value);
 assert.ok(Object.values(model).every(q=>q.estimated&&q.value>1));
 const book={value:3.12,provider:'API-FOOTBALL',estimated:false,acquiredAt:new Date(now).toISOString()};
 const priced=patchQuote({frozen:{X:book},odds:{X:book.value}},model,{refresh:true});
 assert.equal(priced.frozen.X,book);
 assert.ok(priced.frozen['1'].estimated);
 assert.equal(patchQuote(priced,{'1':book}).odds['1'],book.value);

 const previous={number:12,matches:[{id:'last',status:'LIVE'}]};
 const next={id:'r13',number:13,league:'l',kickoff:start,matches:[{...fixture}],slips:[]};
 const league={id:'l',admin:'admin',members:[{uid:'u',credits:5}],rounds:[next]};
 const client={leagues:[league],calendar:{rounds:[previous,{number:13,matches:[{...fixture}]}]}};
 assert.equal(slipWaitingForPrevious(next,client.calendar.rounds,now),true);
 const server={leagues:[league],rounds:[{...next,matches:[{...fixture,...priced}]}],football:{calendar:{rounds:[
  {number:12,matches:[{id:'last',status:'FT',score:[1,0]}]},
  {number:13,matches:[{...fixture,...priced}]},
 ]}}};
 const event=liveSnapshot(server,{id:'u',emailVerified:true},'l');
 assert.equal(event.rounds[0].matches[0].oddsEstimated['1'],true);
 assert.equal(event.rounds[0].matches[0].frozen,undefined);
 mergeLiveSnapshot(client,event);
 assert.equal(slipWaitingForPrevious(next,client.calendar.rounds,now),false);
 assert.equal(roundAvailability(next,now),'aperta');
});

test('cards only infer accumulated suspensions from complete records and collapse duplicate reds',()=>{
 const event=(player,detail)=>({type:'Card',detail,team:{id:1},player:{id:player},time:{elapsed:79}});
 const history=[];
 for(let round=1;round<=5;round++)for(let i=0;i<10;i++){
  const home=2*i+1,away=home+1,events=i?[]:[event(1,'Yellow Card')];
  if(!i&&round===5)events.push(event(2,'Red Card'),event(2,'Red Card'));
  history.push({id:round+':'+i,round,status:'FT',kickoff:new Date(now+round*86400000).toISOString(),
   home_id:'af:'+home,away_id:'af:'+away,events,statistics:[home,away].map(id=>({
    team:{id},statistics:[{type:'Yellow Cards',value:Number(id===1)}],
   }))});
 }
 const confirmed=availabilityFromCards(history,5);
 assert.equal(confirmed.completeCards,true);
 assert.deepEqual(confirmed.reports.map(r=>r.playerId).sort(),[1,2]);
 const partial=availabilityFromCards(history.slice(1),5);
 assert.equal(partial.completeCards,false);
 assert.deepEqual(partial.reports.map(r=>r.playerId),[2]);
});

test('news requires corroboration, scopes a confirmed absence to the next fixture and forces 0%',()=>{
 const player={id:'af:3',api_id:3,name:'Assane Diao',surname:'Diao',club_id:'af:41',team:'Como 1907'};
 const reports=[
  {title:'Como, Diao salta la prossima per infortunio',source:'Corriere',group:'amodei'},
  {title:'Diao salterà la gara per infortunio, assenza per il Como',source:'Tuttosport',group:'amodei'},
 ];
 assert.equal(availabilityFromNews([player],reports).length,0);
 const independent={title:'Como, Diao non ci sarà a causa di una lesione',source:'Sky',group:'sky'};
 const uncertain={...independent,title:'Como, Diao rischia di saltare la gara per un infortunio'};
 assert.equal(availabilityFromNews([player],[...reports,uncertain]).length,0);
 const news=availabilityFromNews([player],[...reports,independent]);
 assert.equal(news.length,1);
 const [update]=collectAvailability([{id:'af:123',api_id:123,home_id:'af:41',away_id:'af:42'}],[player],[],[],{news});
 assert.equal(update.status.type,'injured');
 assert.equal(presenceProbability({status:statusForFixture(update.status,'af:123')}).pct,0);
 assert.equal(statusForFixture(update.status,'af:124').type,'ok');
 const feed='<rss version="2.0"><channel><item><title><![CDATA[Como, Diao salta la sfida per infortunio]]></title><description>Assente</description><pubDate>'+new Date(now).toUTCString()+'</pubDate></item></channel></rss>';
 assert.equal(readAvailabilityFeed(feed,now).length,1);
 assert.equal(readAvailabilityFeed(feed,now+4*86400000).length,0);
});
