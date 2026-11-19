import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from '../lib/db.mjs';
import {newLeague,placeSlip,stateFor,DEFAULT_RULES,roundClosed} from '../lib/game.mjs';
import {enhanceState,communityFor,updateLeagueProfile} from '../lib/community.mjs';
import {slipSummary,saveDraft,loadDraft,draftKey,fingerprint} from '../public/src/slip-state.mjs';
import {sealSession,openSession} from '../lib/sealed-data.mjs';
const env={MAIL_ENCRYPTION_KEY:'test-only-key-at-least-thirty-two-characters'};
function fixture(){const s=emptyState(),u={id:'u',name:'Mister',username:'mister',emailVerified:true};s.users.push(u);const l=newLeague(s,u,'Bar',true);const r={id:'r',league:l.id,kickoff:new Date(Date.now()+86400000).toISOString(),number:1,title:'Giornata 1',slips:[],rules:structuredClone(DEFAULT_RULES),matches:[{id:'m',home:'A',away:'B',odds:{'1':2,'X':3,'2':4},score:null}],settled:false};s.rounds.push(r);return {s,u,l,r};}
test('drafts are isolated by account, league, round and source, retain incomplete selections, and detect a newer server save',()=>{
 const {r}=fixture(),store=new Map(),storage={getItem:k=>store.get(k),setItem:(k,v)=>store.set(k,v)},key=draftKey('u','l',r);
 assert.notEqual(key,draftKey('another','l',r));assert.notEqual(key,draftKey('u','other',r));assert.notEqual(key,draftKey('u','l',{...r,source:'fantacalcio'}));
 assert.equal(saveDraft(storage,key,{round:r,picks:{m:'1',deleted:'X'},stake:10}),true);
 assert.deepEqual(loadDraft(storage,key,r).picks,{m:'1'});
 r.slip={picks:{m:'2'},stake:10};assert.equal(loadDraft(storage,key,r).conflict,true);
 assert.equal(loadDraft(storage,key,r,Date.now()+31*86400000),null);
 assert.equal(saveDraft({setItem(){throw Error();}},key,{round:r,picks:{},stake:10}),false);
});
test('saved, changed, closed and liquidated states differ and stale fixture IDs cannot complete a slip',()=>{
 const {r}=fixture();r.slip={picks:{m:'1'},stake:10};assert.equal(slipSummary(r,{m:'1'},10).status,'Salvata');assert.equal(slipSummary(r,{m:'2'},10).status,'Modifiche da salvare');assert.equal(slipSummary(r,{removed:'1'},10).canSave,false);assert.equal(slipSummary(r,{m:'1'},1.11).validStake,true);assert.equal(slipSummary(r,{m:'1'},20.001).validStake,false);
 r.kickoff=new Date(Date.now()-1000).toISOString();assert.equal(slipSummary(r,{m:'1'},10).status,'Chiusa');r.settled=true;assert.equal(slipSummary(r,{m:'1'},10).status,'Liquidata');assert.equal(fingerprint({b:'X',a:'1'},10),fingerprint({a:'1',b:'X'},10));
});
test('a stale device cannot overwrite the latest saved slip or debit credits',()=>{const {s,u,l,r}=fixture();placeSlip(s,l,r,u,{picks:{m:'1'},stake:10,baseSavedAt:null});const before=l.members[0].credits;assert.throws(()=>placeSlip(s,l,r,u,{picks:{m:'2'},stake:20,baseSavedAt:null}),e=>e.status===409);assert.equal(l.members[0].credits,before);assert.equal(r.slips[0].picks.m,'1');});
test('capital includes pending stakes without changing the credits ranking, community excludes open rounds and secrets',()=>{const {s,u,l,r}=fixture();placeSlip(s,l,r,u,{picks:{m:'1'},stake:10});s.fantasyConnections=[{id:'c',owner:u.id,leagues:[l.id],session:'encrypted-secret',alias:'bar',competitionId:1}];const view=enhanceState(s,u,stateFor(s,u)),member=view.leagues[0].members[0];assert.equal(member.credits,490);assert.equal(member.committedCredits,10);assert.equal(member.capital,500);assert.equal(communityFor(s,l).recap,null);assert.equal(JSON.stringify(view).includes('encrypted-secret'),false);assert.equal(JSON.stringify(view).includes('password'),false);});
test('league branding accepts custom RGB colors and validates both accents',()=>{
 const {l}=fixture(),branding={accent:'#000000',fantaAccent:'#FFAA12',emblem:'BQ',motto:'Il bar'};
 updateLeagueProfile(l,branding);
 assert.deepEqual(l.branding,branding);
 assert.throws(()=>updateLeagueProfile(l,{...branding,accent:'red;url(evil)'}));
 assert.throws(()=>updateLeagueProfile(l,{...branding,fantaAccent:'#abcd'}));
 assert.throws(()=>updateLeagueProfile(l,{...branding,emblem:'<img>'}));
 assert.deepEqual(l.branding,branding);
});
test('session encryption is authenticated and cannot be reused for another owner',()=>{const encrypted=sealSession({token:'sensitive-token',tokenAuth:'refresh'},'c:u',env);assert.equal(encrypted.includes('sensitive-token'),false);assert.equal(openSession(encrypted,'c:u',env).token,'sensitive-token');assert.throws(()=>openSession(encrypted,'c:other',env));});
test('uncertain fantasy deadlines and changed fixtures block submissions on the server',()=>{const {r}=fixture();r.pointsOnly=true;r.kickoff=null;assert.equal(roundClosed(r),true);r.kickoff=new Date(Date.now()+100000).toISOString();r.sourceConflict=true;assert.equal(roundClosed(r),true);});
