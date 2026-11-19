import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseHTML} from 'linkedom';
import {fixtureDb} from './fanta/helpers.mjs';
import {readLeagueParticipants} from '../lib/league-participants.mjs';
import {membershipTransaction} from '../lib/db.mjs';
import {changeBarStorage} from '../runtime/bar-storage.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {createFantaApi} from '../fanta/api.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {sha} from '../lib/game.mjs';
import {renderLeagueHub,renderParticipantRows} from '../public/src/league-workspace.mjs';

const league='fanta-lucas-a',bar='linked-bar',root='https://quasi.test';

for(const sportsStorage of ['snapshot','rows'])test(`Bar and Fanta share the member-only participant list and logos (${sportsStorage})`,async t=>{
 const f=await fixtureDb();t.after(f.close);
 const link={id:bar,name:'Lega collegata',admin:'u1',code:'CODE',rules:{initial:500},members:['u1','u2'].map(uid=>({uid})),nativeFantaLink:{leagueId:league}};
 await f.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',$1)",[JSON.stringify([link])]);
 await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,$2,$3,'native:test')",[bar,league,league+':main']);
 await f.db.query("UPDATE fanta_state SET payload=jsonb_set(jsonb_set(payload,'{users}',payload->'users'||$1::jsonb),'{sessions}',payload->'sessions'||$2::jsonb)",[JSON.stringify([{id:'outsider',name:'Esterno',emailVerified:true,email:'outsider@example.test'}]),JSON.stringify([{uid:'outsider',token:sha('token3'),expires:Date.now()+60000}])]);
 await f.db.query("UPDATE fanta_state SET payload=jsonb_set(payload,'{leagues}',payload->'leagues'||$1::jsonb)",[JSON.stringify([{id:'a-other',name:'Altro Bar',admin:'outsider',members:[{uid:'outsider'}]}])]);
 await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES('a-other',$1,$2,'native:other')",[league,league+':main']);
 const branding={type:'image',imageUrl:'/fanta-api/team/logo/image?league='+league+'&team=t1'};
 await f.db.query("UPDATE fanta.teams SET branding=$1 WHERE id='t1'",[JSON.stringify(branding)]);
 const image=Buffer.from([1,2,3,4]);
 await f.db.query("INSERT INTO fanta.team_logos(team_id,mime,data,digest) VALUES('t1','image/png',$1,'test-logo')",[image]);
 await f.db.query("INSERT INTO fanta.teams(id,league_id,name,manager) VALUES('bot',$1,'Rosa libera','Computer')",[league]);
 if(sportsStorage==='rows'){
  for(const name of ['017_live_storage_backfill','018_live_storage_accounts','019_live_storage_read_views','020_live_storage_round_cache','021_live_storage_league_order','022_live_storage_cutover','023_live_storage_membership_view']){
   await f.db.exec(await readFile(new URL('../netlify/database/migrations/'+name+'.sql',import.meta.url),'utf8'));
  }
  await changeBarStorage('enable',{connect:f.connect});
 }
 const options={connect:f.connect,sportsStorage},events=[];
 const api=createApi({participantsReader:(token,id,mode,opts)=>readLeagueParticipants(token,id,mode,{...options,...opts}),membershipTransact:fn=>membershipTransaction(fn,options),env:{}});
 const get=(id,mode,token='token1')=>api(new Request(root+'/api/league-participants?'+new URLSearchParams({league:id,mode}),{headers:{cookie:'sid='+token}}));
 const remove=(token,uid)=>api(new Request(root+'/api/member-remove',{method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league:bar,uid})}),{leagueUpdate:event=>events.push(event)});
 assert.equal((await get(bar,'bar','unknown')).status,403);
 assert.equal((await get(bar,'bar','token3')).status,403);
 assert.equal((await get(league,'fanta','token3')).status,403);
 assert.equal((await get('other','fanta')).status,403);
 const barResponse=await get(bar,'bar'),fantaResponse=await get(league,'fanta');
 assert.equal(barResponse.status,200,await barResponse.clone().text());
 assert.equal(fantaResponse.status,200,await fantaResponse.clone().text());
 assert.equal(barResponse.headers.get('cache-control'),'no-store');
 const [a,b]=await Promise.all([barResponse.json(),fantaResponse.json()]);
 const summary=x=>x.members.map(m=>[m.uid,m.email,m.team?.id]);
 assert.deepEqual(summary(a),summary(b));
 assert.doesNotMatch(JSON.stringify(b),/outsider@example\.test/);
 assert.deepEqual(summary(b),[['u2','u2@example.test','t2'],['u1','u1@example.test','t1'],[undefined,undefined,'bot']]);
 const logo=a.members.find(m=>m.uid==='u1').team.branding.imageUrl;
 const logoResponse=await api(new Request(root+logo,{headers:{cookie:'sid=token2'}}));
 assert.equal(logoResponse.status,200,await logoResponse.clone().text().catch(()=>''));assert.deepEqual(Buffer.from(await logoResponse.arrayBuffer()),image);
 assert.equal(logoResponse.headers.get('cache-control'),'private, no-store');
 assert.equal((await remove('token2','u1')).status,403);
 assert.equal((await remove('token1','u2')).status,200);
 assert.equal((await get(bar,'bar','token2')).status,403);
 assert.equal((await get(league,'fanta','token2')).status,403);
 assert.equal((await api(new Request(root+logo,{headers:{cookie:'sid=token2'}}))).status,404);
 assert.deepEqual(events,[{league:bar,fantaLeague:league,change:'members',recipients:['u1','u2']}]);
});

test('one hub and compact participant rows have member-only actions, inline badges and independent zoom controls',()=>{
 const data={bar:{id:bar,code:'CODE',name:'Lega collegata'},fanta:{id:league,kind:'native',auction:'scheduled',isCoach:true,isAdmin:true},isAdmin:true,members:[
  {uid:'u1',name:'Presidente',email:'u1@example.test',isAdmin:true,isMe:true,team:{id:'t1',name:'Prima squadra'}},
  {uid:'u2',name:'Allenatore',email:'u2@example.test',team:{id:'t2',name:'Seconda squadra'}},
  {team:{id:'bot',name:'Libera'}},
 ]};
 const top=mode=>parseHTML(renderLeagueHub(data,mode)).document;
 const labels=mode=>[...top(mode).querySelectorAll('.lega-tile b')].map(node=>node.textContent);
 assert.deepEqual(labels('bar'),labels('fanta'));
 assert.match(labels('bar').join(),/Regolamento del Bar.*Regolamento del Fanta/);
 assert.doesNotMatch(renderLeagueHub(data,'fanta'),/LA TUA LEGA/);
 const {document}=parseHTML(renderParticipantRows(data));
 assert.deepEqual([...document.querySelectorAll('.participant-line:first-child .participant-tag')].map(x=>x.textContent),['Tu','Admin']);
 assert.equal(document.querySelectorAll('[data-participant-zoom="quasi"]').length,2);
 assert.equal(document.querySelectorAll('[data-participant-zoom="logo"]').length,3);
 assert.equal(document.querySelectorAll('[data-participant-remove]').length,1);
 assert.match(document.querySelector('[data-participant-remove]').getAttribute('aria-label'),/Allenatore/);
 assert.doesNotMatch(renderParticipantRows({...data,isAdmin:false}),/data-participant-remove|A premio/);
});

test('a Fanta president can remove a standalone coach while team and roster stay in the league',async t=>{
 const f=await fixtureDb();t.after(f.close);
 const api=createFantaApi({store:sqlFantaStore({connect:f.connect})}),events=[];
 const remove=token=>api(new Request(root+'/fanta-api/league/member-remove',{method:'POST',headers:{cookie:'sid='+token},body:JSON.stringify({league,uid:'u2'})}),{leagueUpdate:event=>events.push(event)});
 assert.equal((await remove('token2')).status,403);
 const response=await remove('token1');assert.equal(response.status,200,await response.clone().text());
 await assert.rejects(readLeagueParticipants('token2',league,'fanta',{connect:f.connect}),{status:403});
 assert.deepEqual((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='t2'")).rows,[{user_id:null}]);
 assert.ok((await f.db.query("SELECT id FROM fanta.teams WHERE id='t2' AND EXISTS(SELECT 1 FROM fanta.rosters WHERE team_id='t2')")).rows.length);
 assert.deepEqual(events,[{league,change:'fanta-members',recipients:['u1','u2']}]);
});
