import seed from '../data/seriea-player-media-seed.json' with {type:'json'};
import {transaction} from './db.mjs';
import {sqlPlayerStore} from './player-store.mjs';
export async function seedPlayerMedia(transact=transaction,store=sqlPlayerStore){
 const done=await transact(s=>s.football.playerMediaSeed===seed.version);if(done)return;
 await store.init();const existing=await store.catalog([...new Set(seed.records.map(r=>r.team))]);
 await store.save(seed.records.filter(r=>!existing.some(e=>e.id===r.id&&e.team===r.team&&Date.parse(e.checkedAt||0)>=Date.parse(r.checkedAt))).map(r=>({...r,...(r.data?{data:Buffer.from(r.data,'base64')}:{})})));
 await transact(s=>{s.football.playerMediaSeed=seed.version;if(!s.football.playerMediaJob)s.football.playerMediaJob=seed.job;s.football.playerMediaReport={...seed.report,seeded:true,photos:seed.records.filter(r=>r.data&&!r.placeholder).length,players:seed.records.length};});
}
