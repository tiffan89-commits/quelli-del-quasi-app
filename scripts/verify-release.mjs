import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
const origin='https://quellidelquasi.com';
const expected=JSON.parse(await fs.readFile('package.json','utf8')).version;
const source=['src/slip-results.mjs','src/chat.mjs','src/deferred-media.mjs','styles.css','src/bar-fanta-match.mjs','lineup-pitch.css','src/lineup-pitch.mjs','src/auth-submit.mjs','src/system-admin.mjs','index.html','account.html','admin.html','quasi-studio.css','mobile-sections.css','password-toggle.css','sw.js','src/app.mjs','src/avatar.mjs','src/quasi-scene.mjs','src/quasi-studio.mjs','src/quasi-roster.mjs','src/achievements.mjs','src/achievement-board.mjs','src/locker-rooms.mjs','src/reward-catalog.mjs','src/league-dashboard.mjs','src/day-objectives.mjs','src/reward-rules.mjs','src/progression-ui.mjs','src/password-toggle.mjs'];
source.push('action-feedback.css','src/action-feedback.mjs','src/mode-switch.mjs','src/mode-splash.mjs','src/v2/league-switcher.mjs','fanta.css','src/fanta-mode.mjs',...(await fs.readdir('public/src/fanta')).filter(p=>p.endsWith('.mjs')).map(p=>'src/fanta/'+p));
source.push('fanta-integrations.css','src/bar-fanta-rankings.mjs','src/avatar-renderer.mjs','src/avatar-art.mjs','v2.css');
source.push('pubblico.css',...(await fs.readdir('public/src/pubblico')).filter(p=>p.endsWith('.mjs')).map(p=>'src/pubblico/'+p));
source.push('src/app-invite.mjs','src/league-invite.mjs');
source.push('src/fantasy-accounts.mjs','src/v2/tabs.mjs','src/slip-state.mjs','src/fantasy-live-detail.mjs');
const rooms=(await fs.readdir('public/assets/rooms-v2')).map(n=>'assets/rooms-v2/'+n);
let netlifyFooters=0;
const checks=await Promise.all([...source,...rooms].map(async p=>{const r=await fetch(origin+'/'+p,{cache:'no-store'});if(!r.ok)throw Error(p+': '+r.status);const bytes=Buffer.from(await r.arrayBuffer()),local=await fs.readFile('public/'+p);if(digest(bytes)!==digest(local)){
 // Netlify's configured Real User Monitoring appends its own script after HTML.
 // Accept only that exact provider footer, with every source byte unchanged.
 const text=bytes.toString(),original=local.toString(),footer=text.slice(original.length);
 if(!p.endsWith('.html')||!text.startsWith(original)||!/^<script async id="netlify-rum-container" src="\/\.netlify\/scripts\/rum" [^>]+><\/script>\s*$/.test(footer))throw Error(p+': hash mismatch');netlifyFooters++;
}return p;}));
const version=await (await fetch(origin+'/version.json',{cache:'no-store'})).json();if(version.version!==expected)throw Error('Wrong public version');
const state=await fetch(origin+'/api/state'),platform=await fetch(origin+'/api/platform'),anonymous=await state.json();
if(state.status!==200||anonymous.user!==null||anonymous.leagues?.length||![401,403].includes(platform.status))throw Error('Anonymous API check failed: state='+state.status+', platform='+platform.status);
const fanta=await fetch(origin+'/fanta-api/me'),identity=await fanta.json(),restricted=await fetch(origin+'/fanta-api/leagues');
if(fanta.status!==200||identity.access!=='demo'||restricted.status!==403||!fanta.headers.get('cache-control')?.includes('no-store'))throw Error('Fanta beta isolation failed');
console.log(JSON.stringify({version:version.version,verifiedSourceFiles:source.length,verifiedRoomAssets:rooms.length,netlifyFooters,anonymousState:state.status,anonymousPlatform:platform.status,verifiedAt:new Date().toISOString()}));
