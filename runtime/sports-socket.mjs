import {createHash} from 'node:crypto';
import {readSnapshot,connection} from '../lib/db.mjs';
import {userFor} from '../lib/game.mjs';
import {liveSnapshot} from '../lib/live-snapshot.mjs';
import {sqlFantaStore} from '../fanta/store.mjs';
import {roundView,matchupView} from '../fanta/views.mjs';
const digest=data=>createHash('sha256').update(JSON.stringify(data)).digest('hex');
const sid=req=>String(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('sid='))?.slice(4)||'';
export async function sportsIdentities(tokens,{connect=connection}={}){
 if(!tokens.length)return new Map();const byHash=new Map(tokens.map(token=>[createHash('sha256').update(token).digest('hex'),token])),c=await connect();try{const {rows}=await c.query(`WITH matched AS (SELECT a FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'sessions') a WHERE a->>'token'=ANY($1::text[]) AND (a->>'expires')::numeric>$2) SELECT a->>'token' AS digest,u->>'id' AS id,u->>'username' AS username,(a->>'expires')::numeric AS expires FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'users') u JOIN matched ON u->>'id'=a->>'uid' WHERE (u->>'emailVerified')::boolean AND NOT coalesce((u->>'demo')::boolean,false) AND NOT coalesce((u->>'adminOnly')::boolean,false)`,[[...byHash.keys()],Date.now()]);return new Map(rows.map(({digest,...u})=>[byHash.get(digest),u]));}finally{c.release();}
}
export async function sportsIdentity(token){return readSnapshot(s=>{const u=userFor(s,token),session=s.sessions?.find(s=>s.token===createHash('sha256').update(token).digest('hex'));if(!u||u.adminOnly||u.demo||!u.emailVerified)throw Error('Accedi per seguire la diretta');return {id:u.id,username:u.username,expires:session.expires};},{kind:'player-auth',tokenHash:createHash('sha256').update(token).digest('hex')});}
// A single DB snapshot per watched league/round every minute; fan-out is entirely in memory.
export function attachSportsSocket(io,{identify=sportsIdentity,read=readSnapshot,store=sqlFantaStore(),intervalMs=60000,now=Date.now,revalidate}={}){
 const validateAll=revalidate||(identify===sportsIdentity?sportsIdentities:async tokens=>new Map(await Promise.all(tokens.map(async t=>[t,await identify(t)]))));
 const ns=io.of('/sports'),rooms=new Map();let closed=false;
 ns.use(async(s,next)=>{try{const c=s.handshake.auth||{},token=sid(s.request);if(!['bar','fanta'].includes(c.mode)||typeof c.league!=='string'||!c.league||c.league.length>200||c.competition&&String(c.competition).length>200||c.mode==='fanta'&&(!Number.isInteger(c.round)||c.round<1||c.round>100))throw Error('Contesto non valido');const user=await identify(token);s.data={user,token,context:c};next();}catch{next(Error('Accedi alla lega per seguire la diretta.'));}});
 async function refresh(room){
  if(closed||room.loading)return room.loading;room.loading=(async()=>{try{
   const peer=[...room.sockets].find(s=>s.connected);if(!peer)return;
   const c=room.context,state=c.mode==='bar'?await read(s=>s,{kind:'live',league:c.league}):await store.league(peer.data.user.id,c.league,s=>s,{number:c.round,competition:c.competition,catalog:false,detailedVotes:true});
   room.state=state;room.loadedAt=now();for(const s of room.sockets)send(s,room);
  }catch{for(const s of room.sockets)s.emit('sports:unavailable');}finally{room.loading=null;if(!closed&&room.sockets.size){clearTimeout(room.timer);room.timer=setTimeout(()=>void refresh(room),intervalMs);room.timer.unref?.();}}})();return room.loading;
 }
 function send(s,room){try{const c=s.data.context;if(s.data.user.expires<=now())throw Error('Sessione scaduta');let data;
  if(c.mode==='bar')data=liveSnapshot(room.state,userFor(room.state,s.data.token),c.league);
  else{if(!room.state.teams.some(t=>t.userId===s.data.user.id)||room.state.league.sourceKey&&s.data.user.username!=='frankwood')throw Error('Lega non accessibile');const r=room.state.rounds.find(r=>r.number===c.round);if(!r)throw Error('Giornata assente');data={round:roundView(room.state,r,s.data.user.id,room.loadedAt),matchup:matchupView(room.state,r,c.matchup,s.data.user.id,room.loadedAt)};}
  const version=digest(data);if(version===s.data.sent)return;s.data.sent=version;s.emit('sports:update',{context:c,revision:version,data,at:room.loadedAt});
 }catch{s.disconnect(true);}}
 ns.on('connection',s=>{const c=s.data.context,key=JSON.stringify([c.mode,c.league,c.competition||null,c.round||null]);let room=rooms.get(key);if(!room){room={context:c,sockets:new Set(),state:null,timer:null,loading:null};rooms.set(key,room);}room.sockets.add(s);
  s.on('disconnect',()=>{room.sockets.delete(s);if(!room.sockets.size){clearTimeout(room.timer);rooms.delete(key);}});
  if(room.state&&now()-room.loadedAt<intervalMs)send(s,room);else void refresh(room);
 });
 let checking=false,authFailures=0;const authTimer=setInterval(async()=>{if(checking||closed||!ns.sockets.size)return;checking=true;try{const users=await validateAll([...new Set([...ns.sockets.values()].map(s=>s.data.token))]);authFailures=0;for(const socket of ns.sockets.values()){const u=users.get(socket.data.token);if(!u)socket.disconnect(true);else socket.data.user=u;}}catch{if(++authFailures>=3)ns.disconnectSockets(true);else for(const s of ns.sockets.values())s.emit('sports:unavailable');}finally{checking=false;}},intervalMs);authTimer.unref?.();
 return {stats:()=>({rooms:rooms.size,clients:ns.sockets.size}),async close(){closed=true;clearInterval(authTimer);for(const r of rooms.values())clearTimeout(r.timer);ns.disconnectSockets(true);rooms.clear();}};
}
