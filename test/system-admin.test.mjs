import test from 'node:test';import assert from 'node:assert/strict';
import{emptyState,transaction,membershipTransaction}from'../lib/db.mjs';import{hash,session,userFor,sha,newLeague}from'../lib/game.mjs';
import{readFile}from'node:fs/promises';
import{fixtureDb}from'./fanta/helpers.mjs';
import{changeBarStorage}from'../runtime/bar-storage.mjs';
import{provisionSystemAdmin,beginAdminLogin,finishAdminLogin,requireSystemAdmin}from'../lib/system-admin-auth.mjs';
import{planWipe,executeWipe,forceAllFantasy,adminLeagues,runAdminProbe}from'../lib/system-admin-operations.mjs';
import{decodeMail}from'../lib/mail.mjs';import{createApi}from'../netlify/functions/api.mjs';
const env={RESEND_API_KEY:'test-only-key',MAIL_FROM:'Test <test@example.test>',APP_BASE_URL:'https://example.test'};
function fixture(){const s=emptyState();provisionSystemAdmin(s,{operation:'one-time-test',salt:'test-salt',password:hash('Test-only-password!','test-salt')});const a=s.users[0],p={id:'player',username:'frankwood',name:'Frank',emailVerified:true,email:'player@example.test'};s.users.push(p);const l=newLeague(s,p,'Test league',true),token=session(s,a.id);Object.assign(s.sessions.at(-1),{admin:true,mfaAt:Date.now()});return{s,a,p,l,token};}

test('general login accepts tiffano through identity and still requires the email code; dedicated legacy login also works',async()=>{
 for(const [route,identity]of [['login',{identity:' TiFfAnO '}],['login',{username:'tiffano'}],['login',{email:'tiffano'}],['admin-login',{username:'tiffano'}]]){
  const {s,a}=fixture();s.sessions=[];let mails=0;
  const api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),env,deliverMail:async()=>{mails++;return 'sent';}});
  const response=await api(new Request('https://example.test/api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...identity,password:'Test-only-password!'})}));
  assert.equal(response.status,200);const result=await response.json();assert.equal(result.requireAdminCode,true);assert.equal(response.headers.get('set-cookie'),null);assert.equal(mails,1);assert.equal(s.sessions.length,0);
  const code=decodeMail(s.mailOutbox[0],env).text.match(/\b\d{8}\b/)[0],verified=finishAdminLogin(s,{challenge:result.challenge,code},env);assert.equal(userFor(s,verified.token).id,a.id);
 }
 const {s}=fixture();assert.equal(beginAdminLogin(s,{identity:'tiffano',password:'wrong'},env).status,401);assert.equal(s.adminChallenges?.length||0,0);
});
test('admin provisioning never grants frankwood privileges and admin sessions require completed MFA',()=>{const{s,a,p}=fixture();assert.equal(a.email,undefined);assert.equal(a.adminOnly,true);assert.throws(()=>requireSystemAdmin(s,p));const bare=session(s,a.id);assert.equal(userFor(s,bare),null);assert.throws(()=>newLeague(s,a,'Forbidden'));provisionSystemAdmin(s,{operation:'one-time-test',salt:'x',password:'x'});assert.equal(s.users.filter(u=>u.adminOnly).length,1);});
test('email code is bound to the password challenge, expires at five minutes, is single-use and never stored in plain text',()=>{const{s,a}=fixture(),now=Date.now(),r=beginAdminLogin(s,{username:'tiffano',password:'Test-only-password!'},env,now),mail=decodeMail(s.mailOutbox[0],env),code=mail.text.match(/\b\d{8}\b/)[0];assert.equal(mail.to[0],'tiffan89@gmail.com');assert.equal(r.data.expiresAt-now,300000);assert.ok(!JSON.stringify(s.adminChallenges).includes(code));const valid=finishAdminLogin(s,{challenge:r.data.challenge,code},env,now+1000);assert.equal(userFor(s,valid.token).id,a.id);assert.equal(finishAdminLogin(s,{challenge:r.data.challenge,code},env,now+2000).status,401);const next=beginAdminLogin(s,{username:'tiffano',password:'Test-only-password!'},env,now+61000);assert.equal(finishAdminLogin(s,{challenge:next.data.challenge,code},env,now+361000).status,401);});
test('five wrong code attempts exhaust the challenge without rolling back the attempt counter',()=>{const{s}=fixture(),r=beginAdminLogin(s,{username:'tiffano',password:'Test-only-password!'},env);for(let i=0;i<5;i++)assert.equal(finishAdminLogin(s,{challenge:r.data.challenge,code:'not-a-code'},env).status,401);assert.equal(s.adminChallenges[0].attempts,5);});
test('system admin has no game routes and player sessions cannot inspect, wipe or refresh the platform',async()=>{const{s,a,p,l,token}=fixture(),player=session(s,p.id),api=createApi({transact:async fn=>fn(s,{query:async()=>({rows:[{attempts:1}]})}),env});const call=(route,body,t=token)=>api(new Request('https://example.test/api/'+route,{method:body?'POST':'GET',headers:{cookie:'sid='+t,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined}));for(const route of ['create','join','profile','chat-send','fantasy-sync'])assert.equal((await call(route,{league:l.id,name:'bad'})).status,403);for(const route of ['platform','platform-leagues'])assert.equal((await call(route,undefined,player)).status,403);assert.equal((await call('platform-force-sync',{},player)).status,403);assert.equal((await call('platform-wipe-plan',{scope:'all'},player)).status,403);const state=await(await call('state')).json();assert.equal(state.adminOnly,true);assert.deepEqual(state.leagues,[]);assert.equal(state.user.email,undefined);});
test('league wipe requires fresh MFA, exact confirmation and one-time preview; other leagues and users survive',()=>{const{s,a,p,l,token}=fixture(),other=newLeague(s,p,'Other',true);s.rounds.push({id:'r',league:l.id,slips:[{uid:p.id}],matches:[]});s.ledger.push({league:l.id,uid:p.id});s.leagueChats={[l.id]:{messages:[{uid:p.id,text:'sensitive'}]},[other.id]:{messages:[]}};s.fantasyConnections=[{id:'c',leagues:[l.id],credentialsCipher:'secret',session:'secret'}];assert.equal(adminLeagues(s,a,l.id).users[0].username,'frankwood');const plan=planWipe(s,a,{scope:'league',target:l.id},token);assert.throws(()=>executeWipe(s,a,{plan:plan.id,phrase:'wrong'},token));assert.ok(s.leagues.some(x=>x.id===l.id));executeWipe(s,a,{plan:plan.id,phrase:plan.phrase},token);assert.equal(s.leagues.length,1);assert.equal(s.leagues[0].id,other.id);assert.equal(s.rounds.length,0);assert.equal(s.ledger.length,0);assert.equal(s.fantasyConnections.length,0);assert.equal(s.users.length,2);assert.throws(()=>executeWipe(s,a,{plan:plan.id,phrase:plan.phrase},token));s.sessions.find(x=>x.token===sha(token)).mfaAt=Date.now()-660000;assert.throws(()=>planWipe(s,a,{scope:'all'},token));});
test('user wipe removes authored messages, personal auth, participation, profiles and owned connected credentials',()=>{const{s,a,p,l,token}=fixture();s.users.push({id:'other',name:'Other'});const other=newLeague(s,{id:'other'},'Survivor',true);other.members.push({uid:p.id});s.leagueChats={[other.id]:{sequence:2,messages:[{uid:p.id,text:'personal'},{uid:'other',text:'retained'}]}};s.chatReaders={[other.id+':'+p.id]:{read:2}};s.playerProfiles={secret:p.email};s.fantasyConnections=[{id:'c',owner:p.id,leagues:[other.id],session:'secret'}];s.accessEvents=[{uid:p.id}];session(s,p.id);const plan=planWipe(s,a,{scope:'user',target:p.id},token);executeWipe(s,a,{plan:plan.id,phrase:plan.phrase},token);assert.ok(!JSON.stringify(s).includes(p.email));assert.ok(!s.users.some(u=>u.id===p.id));assert.ok(!s.sessions.some(x=>x.uid===p.id));assert.equal(s.leagueChats[other.id].messages.length,1);assert.equal(s.fantasyConnections.length,0);assert.equal(s.playerProfiles,undefined);assert.ok(!s.leagues.some(x=>x.id===l.id));});
test('full wipe preserves only system account and valid administration sessions, without restoring removed users via telemetry',()=>{const{s,a,p,token}=fixture();s.accountTokens=[{uid:p.id,digest:'private'}];s.chatSubscriptions=[{uid:p.id}];s.football.details='secret';const plan=planWipe(s,a,{scope:'all'},token);executeWipe(s,a,{plan:plan.id,phrase:plan.phrase},token);assert.equal(s.users.length,1);assert.equal(s.users[0].id,a.id);assert.equal(s.leagues.length,0);assert.equal(s.accountTokens,undefined);assert.equal(s.chatSubscriptions,undefined);assert.equal(s.football.details,undefined);assert.equal(userFor(s,token).id,a.id);});
test('mass sync queues all connected sources and forces assets without changing slips or cached final details; probes reject arbitrary destinations',async()=>{const{s,a}=fixture(),complete={complete:true};s.fantasyConnections=[{id:'a',server:true,session:'encrypted',leagues:['x'],rounds:[{matches:[{details:complete}]}]},{id:'b',server:true,session:'encrypted',leagues:['y']},{id:'manual',manual:true,leagues:['z']}];const result=forceAllFantasy(s,a);assert.equal(result.queued,true);assert.equal(s.fantasyConnections[0].rounds[0].matches[0].details,complete);let calls=0;await assert.rejects(()=>runAdminProbe({transact:async fn=>fn(s),u:a,input:{provider:'https://evil.test/'},fetcher:()=>{calls++;}}));assert.equal(calls,0);});

test('retrying a correct admin password reuses the public MFA challenge without sending duplicate mail',()=>{const {s}=fixture(),now=Date.now(),p={username:'tiffano',password:'Test-only-password!'},first=beginAdminLogin(s,p,env,now),retry=beginAdminLogin(s,p,env,now+1000);assert.equal(retry.data.challenge,first.data.challenge);assert.equal(s.mailOutbox.length,1);assert.equal(s.adminChallenges.length,1);assert.equal(beginAdminLogin(s,{...p,password:'wrong'},env,now+2000).status,401)});

test('admin wipe atomically removes a Bar and its Fanta, and refuses a changed link',async t=>{
 const {db,connect,close}=await fixtureDb();t.after(close);
 const migration=await readFile(new URL('../netlify/database/migrations/012_random_leagues.sql',import.meta.url),'utf8');
 await db.exec('BEGIN;'+migration+'COMMIT;');
 const {s,p,l,token}=fixture(),other=newLeague(s,p,'Altro Bar',true),fanta='fanta-lucas-a';
 l.nativeFantaLink={leagueId:fanta};
 await db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[s]);
 await db.query("INSERT INTO fanta.competitions(id,league_id,name,kind,status) VALUES('comp',$1,'Coppa','league','draft')",[fanta]);
 await db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,$2,'comp','native:test')",[l.id,fanta]);
 await db.query("INSERT INTO fanta.creation_jobs(id,bar_id,owner_uid,size,name,league_id) VALUES('job',$1,$2,2,'Test',$3)",[l.id,p.id,fanta]);
 await db.query("INSERT INTO fanta.results(matchup_id,data) VALUES('m1','{}')");
 await db.query("INSERT INTO fanta.leagues(id,name,season,admin_uid,invite_code,rules) VALUES('survivor','Altro Fanta',2026,$1,'OTHER','{}')",[p.id]);
 const api=createApi({transact:fn=>transaction(fn,{connect}),env});
 const call=(route,body)=>api(new Request('https://example.test/api/'+route,{method:'POST',headers:{cookie:'sid='+token,'content-type':'application/json'},body:JSON.stringify(body)}));
 const preview=await call('platform-wipe-plan',{scope:'league',target:l.id});
 assert.equal(preview.status,200);
 const plan=await preview.json();
 assert.equal(plan.counts.legheFanta,1);
 await db.query('UPDATE fanta.bar_links SET active=false WHERE bar_league_id=$1',[l.id]);
 await db.query("UPDATE fanta_state SET payload=payload #- '{leagues,0,nativeFantaLink}' WHERE id=1");
 assert.equal((await call('platform-wipe',{plan:plan.id,phrase:plan.phrase})).status,409);
 assert.equal((await db.query("SELECT count(*)::int AS n FROM fanta.leagues")).rows[0].n,2);
 assert.equal((await db.query("SELECT jsonb_array_length(payload->'leagues') AS n FROM fanta_state")).rows[0].n,2);
 await db.query('UPDATE fanta.bar_links SET active=true WHERE bar_league_id=$1',[l.id]);
 const response=await call('platform-wipe',{plan:plan.id,phrase:plan.phrase});
 assert.equal(response.status,200);
 assert.equal((await response.json()).counts.legheFanta,1);
 assert.deepEqual((await db.query("SELECT id FROM fanta.leagues")).rows,[{id:'survivor'}]);
 assert.deepEqual((await db.query("SELECT payload#>>'{leagues,0,id}' AS id FROM fanta_state")).rows,[{id:other.id}]);
 for(const table of ['bar_links','creation_jobs','competitions','teams','rosters','matchups','results']){
  assert.equal((await db.query('SELECT count(*)::int AS n FROM fanta.'+table)).rows[0].n,0,table);
 }
 assert.ok((await db.query("SELECT count(*)::int AS n FROM fanta.players")).rows[0].n>0);
});

for(const sportsStorage of ['snapshot','rows'])test(`the verified president can save league identity and delete the linked Bar and Fanta (${sportsStorage})`,async t=>{
 const {db,connect,close}=await fixtureDb();t.after(close);
 const migrate=async name=>db.exec(await readFile(new URL('../netlify/database/migrations/'+name+'.sql',import.meta.url),'utf8'));
 await migrate('012_random_leagues');
 const {s,p,l}=fixture(),member={id:'member',name:'Membro',emailVerified:true},fanta='fanta-lucas-a';
 s.users.push(member);l.demo=false;l.members.push({uid:member.id});l.nativeFantaLink={leagueId:fanta};const other=newLeague(s,member,'Altro Bar',true);
 s.platformStats={days:{}};
 s.leagueChats={[l.id]:{messages:[]},[other.id]:{messages:[]}};
 s.chatReaders={[`${l.id}:${member.id}`]:{read:2}};
 s.rounds.push({id:'archive',league:l.id,matches:[],slips:[]});
 s.ledger.push({id:'credit-archive',league:l.id,uid:p.id});
 const presidentToken=session(s,p.id),memberToken=session(s,member.id),phrase='ELIMINA LEGA E STORICO';
 await db.query('UPDATE fanta_state SET payload=$1 WHERE id=1',[s]);
 await db.query("INSERT INTO fanta.competitions(id,league_id,name,kind,status) VALUES('owned-comp',$1,'Coppa','league','draft')",[fanta]);
 await db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key) VALUES($1,$2,'owned-comp','native:owned')",[l.id,fanta]);
 if(sportsStorage==='rows'){
  for(const name of ['017_live_storage_backfill','018_live_storage_accounts','019_live_storage_read_views','020_live_storage_round_cache','021_live_storage_league_order','022_live_storage_cutover','023_live_storage_membership_view'])await migrate(name);
  await changeBarStorage('enable',{connect});
 }
 const updates=[];
 const api=createApi({transact:fn=>transaction(fn,{connect,sportsStorage}),membershipTransact:fn=>membershipTransaction(fn,{connect,sportsStorage}),env});
 const call=(route,token,body)=>api(new Request('https://example.test/api/'+route,{method:'POST',headers:{cookie:'sid='+token,'content-type':'application/json'},body:JSON.stringify({league:l.id,...body})}),{leagueUpdate:event=>updates.push(event)});
 const state=async()=> (await db.query(sportsStorage==='rows'
  ?'SELECT fanta.bar_restore_document(payload,storage_shape) AS payload FROM fanta_state WHERE id=1'
  :'SELECT payload FROM fanta_state WHERE id=1')).rows[0].payload;
 const branding={accent:'#ff9db4',emblem:'FC',motto:'La lega di prova'};
 assert.equal((await call('league-profile',memberToken,{branding})).status,403);
 const save=await call('league-profile',presidentToken,{branding});
 assert.equal(save.status,200,await save.clone().text());
 assert.deepEqual((await state()).leagues.find(x=>x.id===l.id).branding,branding);
 assert.equal(updates[0].change,'identity');
 assert.deepEqual(new Set(updates[0].recipients),new Set([p.id,member.id,'u1','u2']));
 const renamed={...branding,name:'Il Bar degli amici 🍻',accent:'#a32f72',fantaAccent:'#1234ab'};
 const rename=await call('league-profile',presidentToken,{branding:renamed});
 assert.equal(rename.status,200,await rename.clone().text());
 const saved=(await state()).leagues.find(x=>x.id===l.id);
 assert.equal(saved.name,renamed.name);
 assert.equal(saved.branding.accent,renamed.accent);
 assert.equal(saved.branding.fantaAccent,renamed.fantaAccent);
 const {rows:[fantaIdentity]}=await db.query(`SELECT name,accent,rules->'leagueIdentity' AS branding FROM fanta.leagues WHERE id=$1`,[fanta]);
 assert.deepEqual(fantaIdentity,{name:renamed.name,accent:renamed.fantaAccent,branding:{emblem:renamed.emblem,motto:renamed.motto}});

 const remove=(token,confirmation)=>call('league-delete',token,{phrase:confirmation});
 assert.equal((await remove(memberToken,phrase)).status,403);
 assert.equal((await remove(presidentToken,'elimina')).status,409);
 assert.equal((await db.query('SELECT count(*)::int n FROM fanta.leagues')).rows[0].n,1);
 const response=await remove(presidentToken,phrase);
 assert.equal(response.status,200,await response.clone().text());
 for(const table of ['leagues','teams','rosters','matchups','bar_links']){
  assert.equal((await db.query('SELECT count(*)::int n FROM fanta.'+table)).rows[0].n,0,table);
 }
 const payload=await state();
 assert.deepEqual(payload.leagues.map(x=>x.id),[other.id]);
 assert.ok(payload.users.some(u=>u.id===member.id));
 assert.ok(!payload.rounds.some(r=>r.league===l.id));
 assert.ok(!payload.ledger.some(entry=>entry.league===l.id));
 assert.deepEqual(payload.leagueChats,{[other.id]:{messages:[]}});
 assert.deepEqual(payload.chatReaders,{});
});
