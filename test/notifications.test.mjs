import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/src/notifications.mjs',import.meta.url),'utf8').replace(/\bexport /g,'');
function fixture({permission='default',standalone=false,existing=false}={}){
 const saved=new Map(),calls=[],nodes=new Map(),dialog={isConnected:true,setAttribute(){},querySelector(s){if(!nodes.has(s))nodes.set(s,{isConnected:true,disabled:false,textContent:''});return nodes.get(s);},addEventListener(name,fn){this[name]=fn;},showModal(){this.open=true;},close(){this.open=false;},remove(){this.removed=true;}};
 const notification={permission,requestPermission:()=>{calls.push('permission');notification.permission='granted';return Promise.resolve('granted');}},subscription={toJSON:()=>({endpoint:'https://fcm.googleapis.com/fcm/send/test',keys:{p256dh:'test',auth:'test'}})};
 const api=async(route,input)=>{calls.push({route,input});return {publicKey:Buffer.alloc(65,4).toString('base64url')};};
 const registration={pushManager:{getSubscription:async()=>existing?subscription:null,subscribe:async()=>{calls.push('subscribe');return subscription;}}};
 const context={window:{isSecureContext:true,PushManager:{},Notification:notification,matchMedia:()=>({matches:standalone})},Notification:notification,navigator:{serviceWorker:{ready:Promise.resolve(registration)}},localStorage:{getItem:key=>saved.get(key)||null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)},document:{querySelector:()=>null,createElement:()=>dialog,body:{appendChild(){}}},URLSearchParams,Uint8Array,atob,Date,user:{id:'u'},league:{id:'l',name:'Il Bar'},api,notify(){} };
 vm.createContext(context);vm.runInContext(source,context);return {context,calls,saved,nodes,dialog};
}
test('opening chat requests browser permission directly in the user click and never reprompts a denied device',async()=>{
 const f=fixture();const p=vm.runInContext('requestChatConsent({user,league})',f.context);assert.equal(f.calls[0],'permission');assert.equal(await p,'granted');
 const denied=fixture({permission:'denied'});assert.equal(vm.runInContext('requestChatConsent({user,league})',denied.context),null);assert.equal(denied.calls.length,0);
});
test('push registration is scoped to the selected league and reuses an existing device subscription',async()=>{
 const f=fixture({permission:'granted',existing:true});await vm.runInContext('enableLeagueNotifications({league,user,api})',f.context);assert.equal(f.calls.includes('permission'),false);assert.equal(f.calls.includes('subscribe'),false);const post=f.calls.find(c=>c.route==='chat-subscribe');assert.equal(post.input.league,'l');assert.ok(post.input.subscription.endpoint);
});
test('PWA launch asks for consent in the app and defers the browser prompt until the explicit activation click',async()=>{
 const f=fixture({standalone:true});vm.runInContext('maybeInvitePwaNotifications({league,user,api,notify})',f.context);assert.equal(f.dialog.open,true);assert.equal(f.calls.includes('permission'),false);assert.equal(f.nodes.get('#push-invite-league').textContent,'Il Bar');
 const p=f.nodes.get('#push-invite-yes').onclick({target:f.nodes.get('#push-invite-yes')});assert.equal(f.calls[0],'permission');await p;assert.equal(f.dialog.removed,true);assert.equal(f.calls.find(c=>c.route==='chat-subscribe').input.league,'l');
});
test('Non ora is remembered and normal browser startup never asks permission automatically',()=>{
 const normal=fixture();vm.runInContext('maybeInvitePwaNotifications({league,user,api,notify})',normal.context);assert.equal(normal.dialog.open,undefined);
 const f=fixture({standalone:true});vm.runInContext('maybeInvitePwaNotifications({league,user,api,notify})',f.context);f.nodes.get('#push-invite-no').onclick();assert.ok(f.saved.get('quasi-push-invite:u:l'));assert.equal(vm.runInContext('requestChatConsent({user,league})',f.context),null);assert.equal(f.calls.includes('permission'),false);
});
