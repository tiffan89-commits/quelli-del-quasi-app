import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {fixtureDb} from './fanta/helpers.mjs';
import {createApi} from '../netlify/functions/api.mjs';
import {membershipTransaction,readSnapshot,profileTransaction} from '../lib/db.mjs';

test('authenticated directory, distinct league limit, private prompts and code-free approvals and invitations',async t=>{
 const f=await fixtureDb();t.after(()=>f.close());
 const players=[{id:'u3',name:'Terzo',email:'terzo@example.test'},{id:'u4',name:'Ospite',email:'utente@example.test'}].map(u=>({...u,emailVerified:true}));
 const sessions=players.map(u=>({uid:u.id,token:createHash('sha256').update('token'+u.id.slice(1)).digest('hex'),expires:Date.now()+60000}));
 const leagues=Array.from({length:10},(_,i)=>({id:'bar'+i,admin:'u1',name:'Lega '+i,code:'HIDDEN'+i,rules:{initial:500},members:[{uid:'u1'}]}));
 await f.db.query(`UPDATE fanta_state SET payload=jsonb_set(jsonb_set(jsonb_set(payload,'{users}',payload->'users'||$1::jsonb),'{sessions}',payload->'sessions'||$2::jsonb),'{leagues}',$3::jsonb)`,[JSON.stringify(players),JSON.stringify(sessions),JSON.stringify(leagues)]);
 await f.db.query("INSERT INTO fanta.bar_links(bar_league_id,fanta_league_id,competition_id,competition_key,active) VALUES('bar0','fanta-lucas-a','fanta-lucas-a:main','native:test',true)");
 await f.db.query("UPDATE fanta.teams SET user_id=NULL WHERE id='t2'");
 const opts={connect:f.connect,sportsStorage:'snapshot'};
 const api=createApi({membershipTransact:fn=>membershipTransaction(fn,opts),profileTransact:fn=>profileTransaction(fn,opts),read:(fn,options)=>readSnapshot(fn,{...options,...opts}),env:{}});
 const events=[];
 const call=async (user,route,body,expected=200)=>{
  const headers=user?{cookie:'sid=token'+user}:{};
  const response=await api(new Request('https://example.test/api/'+route,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})}),{leagueUpdate:event=>events.push(event)});
  const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
 };
 await call(null,'league-directory',null,403);
 const directory=await call(2,'league-directory');
 assert.deepEqual(directory.leagues[0].nicknames,['Presidente sintetico']);
 assert.doesNotMatch(JSON.stringify(directory),/example\.test|HIDDEN/);
 assert.equal(directory.remaining,3);
 assert.equal(directory.leagues.length,8);assert.equal(directory.nextOffset,8);
 assert.equal((await call(2,'league-directory?offset=8')).leagues.length,2);
 assert.deepEqual((await call(2,'league-directory?q=LEG%C3%80+9')).leagues.map(l=>l.id),['bar9']);
 for(let i=0;i<3;i++)await call(2,'league-access-request',{league:'bar'+i});
 await call(2,'league-access-request',{league:'bar0'});
 await call(2,'league-access-request',{league:'bar3'},429);
 const admin=await call(1,'league-access-inbox');
 assert.equal(admin.length,3);
 assert.equal(admin[0].player.email,'u2@example.test');
 assert.deepEqual(await call(3,'league-access-inbox'),[]);
 await call(3,'league-access-respond',{id:admin[0].id,decision:'accept'},404);
 await call(1,'league-access-respond',{id:admin.find(x=>x.league==='Lega 0').id,decision:'accept'});
 assert.equal((await f.db.query("SELECT user_id FROM fanta.teams WHERE id='t2'")).rows[0].user_id,'u2');
 assert.equal((await call(2,'league-directory')).leagues[0].joined,true);
 assert.equal((await call(2,'league-directory')).remaining,0);

 await call(2,'league-access-invite',{league:'bar0',identity:'Terzo'},403);
 await call(1,'league-access-invite',{league:'bar1',identity:'Terzo'});
 let [invite]=await call(3,'league-access-inbox');
 assert.deepEqual(Object.keys(invite).sort(),['id','kind','league']);
 await call(3,'league-access-respond',{id:invite.id,decision:'reject'});
 assert.deepEqual(await call(3,'league-access-inbox'),[]);
 await call(1,'league-access-invite',{league:'bar1',identity:'TERZO@EXAMPLE.TEST'});
 const [newInvite]=await call(3,'league-access-inbox');
 assert.notEqual(newInvite.id,invite.id);
 const accepted=await call(3,'league-access-respond',{id:newInvite.id,decision:'accept'});
 assert.equal(accepted.league,'bar1');
 assert.deepEqual(events,[{league:'bar0',change:'members',recipients:['u1','u2']},{league:'bar1',change:'members',recipients:['u1','u3']}]);
 assert.equal((await call(3,'league-directory')).leagues[1].joined,true);
 const pushes=(await f.db.query("SELECT data FROM fanta.notifications WHERE kind='leagueAccess'")).rows;
 assert.equal(pushes.length,6);
 assert.ok(pushes.every(({data})=>data.kind==='league-access'&&!JSON.stringify(data).includes('@')));
});

test('a verified player can register a push device before choosing a league',async()=>{
 const token='account-device',uid='player';
 const state={users:[{id:uid,name:'Nuovo',emailVerified:true}],sessions:[{
  uid,token:createHash('sha256').update(token).digest('hex'),expires:Date.now()+60000,
 }],leagues:[],chatSubscriptions:[]};
 const api=createApi({chatTransact:async(fn,{league})=>{assert.equal(league,null);return fn(state);},env:{}});
 const cookie={cookie:'sid='+token};
 const config=await api(new Request('https://example.test/api/chat-config',{headers:cookie}));
 assert.equal(config.status,200);
 assert.ok((await config.json()).publicKey);
 const subscription={endpoint:'https://fcm.googleapis.com/fcm/send/account',keys:{p256dh:Buffer.alloc(65,1).toString('base64url'),auth:Buffer.alloc(16,2).toString('base64url')}};
 const result=await api(new Request('https://example.test/api/chat-subscribe',{method:'POST',headers:cookie,body:JSON.stringify({subscription})}));
 assert.equal(result.status,200);
 assert.equal(state.chatSubscriptions[0].uid,uid);
 assert.equal(state.chatReaders,undefined);
});
