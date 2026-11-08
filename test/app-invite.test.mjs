import test from 'node:test';import assert from 'node:assert/strict';
import {renderAppInvite,performAppInvite,appShareData,APP_INVITE_URL,bindAppInvites} from '../public/src/app-invite.mjs';
import {renderIo} from '../public/src/fanta/io.mjs';import {whatsappInvite} from '../public/src/league-invite.mjs';import {parseHTML} from 'linkedom';
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
test('public app invitations contain only the public URL; presidents also retain their distinct league invitation',()=>{
 const member=renderAppInvite(),{document}=parseHTML(member),url=new URL(document.querySelector('a').getAttribute('href'));
 assert.equal(appShareData().url,APP_INVITE_URL);assert.match(url.searchParams.get('text'),/https:\/\/quellidelquasi\.com\//);assert.doesNotMatch(url.searchParams.get('text'),/\/invito\/|codice lega|league=|sid=/i);
 assert.doesNotMatch(member,/data-page="admin"|data-invite-league/);assert.match(member,/data-app-invite-share/);assert.equal(new URL(appShareData().url).hash,'#registrati');
 const league=whatsappInvite({name:'La mia lega',code:'PRIVATE-CODE'},esc),leagueText=new URL(parseHTML(league).document.querySelector('a').getAttribute('href')).searchParams.get('text');assert.match(leagueText,/La mia lega/);assert.match(leagueText,/\/invito\/PRIVATE-CODE/);assert.match(leagueText,/Codice lega, se serve: PRIVATE-CODE/);assert.ok(!member.includes('PRIVATE-CODE'));
});
test('Fanta profile gives everyone app sharing through registration and WhatsApp',()=>{
 const me={user:{name:'Mister',username:'mister'},settings:{notify:{}}},leagues=[{id:'own',name:'Lega',teamName:'Team',season:'2026/27',role:'admin'},{id:'other',name:'Altra lega',teamName:'Team',season:'2026/27',role:'member'}];
 assert.match(renderIo(me,leagues,'other'),/Invita a usare l’app/);assert.doesNotMatch(renderIo(me,leagues,'other'),/data-invite-league/);assert.match(renderIo(me,leagues,'own'),/wa.me/);assert.doesNotMatch(renderIo(me,leagues,'own',{},true),/data-invite-league/);
});
test('native share uses the public invitation, cancellation does not copy or open anything, and denied clipboard has manual fallback',async()=>{
 let shared,copied=0;const navigator={share:async data=>{shared=data;},clipboard:{writeText:async value=>{copied++;assert.equal(value,APP_INVITE_URL);}}};
 assert.match((await performAppInvite('share',{navigator})).message,/condiviso/);assert.deepEqual(shared,appShareData());assert.equal(copied,0);
 navigator.share=async()=>{throw Object.assign(Error('cancelled'),{name:'AbortError'});};assert.deepEqual(await performAppInvite('share',{navigator}),{message:''});assert.equal(copied,0);
 assert.match((await performAppInvite('copy',{navigator})).message,/copiato/);assert.equal(copied,1);
 assert.equal((await performAppInvite('copy',{navigator:{clipboard:{writeText:async()=>{throw Error('denied');}}}})).manual,true);assert.equal((await performAppInvite('share',{navigator:{}})).manual,true);
});
test('copy invitation disables the button while pending, blocks double clicks and restores the button without a page refresh',async()=>{
 const {document}=parseHTML(renderAppInvite());let finish,calls=0;bindAppInvites(document,{navigator:{clipboard:{writeText:()=>{calls++;return new Promise(resolve=>finish=resolve);}}}});
 const button=document.querySelector('[data-app-invite-copy]'),click=()=>button.onclick({preventDefault(){},stopPropagation(){}});click();click();assert.equal(calls,1);assert.equal(button.disabled,true);assert.equal(button.getAttribute('aria-busy'),'true');assert.equal(document.querySelector('[data-app-invite-share]').hidden,false);
 finish();await new Promise(resolve=>setImmediate(resolve));assert.equal(button.disabled,false);assert.match(document.querySelector('[data-app-invite-status]').textContent,/copiato/);
});
