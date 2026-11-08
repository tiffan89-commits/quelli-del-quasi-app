import test from 'node:test';
import assert from 'node:assert/strict';
import {applyMatchDifficulty,coachScore} from '../fanta/auto-coach.mjs';
import {currentRound} from '../fanta/round-selection.mjs';
import {roundView} from '../fanta/views.mjs';

test('computer coach adjusts equal player form for fixture difficulty, using odds or recent results',()=>{
 const players=[{club:'AC Milan',fm:6},{club:'AS Roma',fm:6}];
 const upcoming={round:12,home:'Milan',away:'Roma',status:'NS'};
 const [milan,roma]=applyMatchDifficulty(players,[{...upcoming,odds:{1:4,2:1.5}}],12);
 assert.ok(coachScore(milan)<coachScore(roma));
 const recent=[9,10,11].map(round=>({round,home:'Milan',away:'Roma',status:'FT',score:[2,0]}));
 const [strong,weak]=applyMatchDifficulty(players,[...recent,upcoming,{round:13,home:'Roma',away:'Milan',status:'FT',score:[8,0]}],12);
 assert.ok(coachScore(strong)>coachScore(weak));
 assert.equal(coachScore(players[0]),coachScore(players[1]));
});

test('an archived fixture without source results stays in the calendar without a fabricated score',()=>{
 const round={number:9,seriea_round:11,deadline:'2026-11-06T19:45:00Z',data:{archivedWithoutResults:true}};
 const upcoming={number:10,seriea_round:12,deadline:'2026-11-21T14:00:00Z'};
 const now=Date.parse('2026-11-08T14:00:00Z');
 const state={rounds:[round,upcoming],teams:[{id:'home',userId:'owner'},{id:'away'}],lineups:[],fixtures:[{round:11,kickoff:'2026-11-08T13:30:00Z',status:'1H'}],matchups:[{id:'m',round:9,home_id:'home',away_id:'away'}],results:[]};
 assert.equal(currentRound(state,now).number,10);
 const view=roundView(state,round,'owner',now);
 assert.equal(view.round.state,'archiviata');
 assert.equal(view.matchups[0].home.goals,null);
 assert.equal(view.matchups[0].away.points,null);
});
