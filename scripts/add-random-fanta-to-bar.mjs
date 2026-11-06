// Owner maintenance: creates only a missing linked Fanta, using the existing roster generator.
import fs from 'node:fs/promises';
import path from 'node:path';
import {configure} from '../runtime/config.mjs';
configure();
const {connection,closeDatabase}=await import('../lib/db.mjs');
const {queueRandom,runRandomCreation,claimRandom}=await import('../fanta/random-leagues.mjs');
const args=process.argv.slice(2),name=args[args.indexOf('--name')+1],size=Number(args[args.indexOf('--teams')+1]),apply=args.includes('--apply');
if(!args.includes('--name')||!name||!Number.isInteger(size)||size<2||size>12)throw Error('Usage: --name NAME --teams N [--apply]');
try{
 const c=await connection();let bar,users,before;
 try{
  const rows=(await c.query(`SELECT l,(SELECT jsonb_agg(u) FROM jsonb_array_elements(payload->'users') u WHERE u->>'id' IN(SELECT m->>'uid' FROM jsonb_array_elements(l->'members') m)) AS users FROM fanta_state CROSS JOIN LATERAL jsonb_array_elements(payload->'leagues') l WHERE lower(trim(l->>'name'))=lower(trim($1))`,[name])).rows;
  if(rows.length!==1)throw Error('Nome lega assente o ambiguo');bar=rows[0].l;users=rows[0].users;
  if(users.length!==bar.members.length||users.some(u=>u.adminOnly||u.demo||!u.emailVerified))throw Error('Partecipanti non verificati o ambigui');
  if(bar.nativeFantaLink)throw Error('La lega ha già un Fanta: non verrà sovrascritto');
  const existing=(await c.query('SELECT fanta_league_id FROM fanta.bar_links WHERE bar_league_id=$1 AND active',[bar.id])).rows;
  if(existing.length)throw Error('Collegamento già presente: richiede verifica');
  before=(await c.query(`SELECT md5((payload->'users')::text) AS users,md5((payload->'ledger')::text) AS ledger,md5((SELECT jsonb_agg(l) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'<>$1)::text) AS other_bars FROM fanta_state WHERE id=1`,[bar.id])).rows[0];
 }finally{c.release();}
 console.log(JSON.stringify({plan:{bar:bar.name,teams:size,human:users.map(u=>u.username),computer:size-users.length},apply}));if(!apply)process.exitCode=0;
 else{
  const president=users.find(u=>u.id===bar.admin);if(!president)throw Error('Presidente assente');
  const job=await queueRandom(president,{barId:bar.id,size,computerTeams:true,name:bar.name});await runRandomCreation(job.id);
  const c2=await connection();let league;try{league=(await c2.query('SELECT league_id FROM fanta.creation_jobs WHERE id=$1 AND status=\'ready\'',[job.id])).rows[0]?.league_id;}finally{c2.release();}if(!league)throw Error('Generazione non completata');
  for(const user of users)await claimRandom(user,league);
  const c3=await connection();try{
   const rows=(await c3.query(`SELECT t.name,t.user_id,t.manager,count(r.player_id)::int AS players,sum(r.price)::int AS spent,jsonb_object_agg(p.role,1) AS roles FROM fanta.teams t JOIN fanta.rosters r ON r.team_id=t.id JOIN fanta.players p ON p.id=r.player_id WHERE t.league_id=$1 GROUP BY t.id ORDER BY t.id`,[league])).rows;
   const roles=(await c3.query(`SELECT r.team_id,p.role,count(*)::int n FROM fanta.rosters r JOIN fanta.players p ON p.id=r.player_id WHERE r.league_id=$1 GROUP BY r.team_id,p.role`,[league])).rows;
   if(rows.length!==size||rows.some(t=>t.players!==25||t.spent>500)||rows.filter(t=>t.user_id).length!==users.length||!users.every(u=>rows.filter(t=>t.user_id===u.id).length===1))throw Error('Verifica rose/assegnazioni fallita');
   for(const tid of new Set(roles.map(r=>r.team_id)))for(const [role,n]of Object.entries({P:3,D:8,C:8,A:6}))if(roles.find(r=>r.team_id===tid&&r.role===role)?.n!==n)throw Error('Ruoli non validi');
   const after=(await c3.query(`SELECT md5((payload->'users')::text) AS users,md5((payload->'ledger')::text) AS ledger,md5((SELECT jsonb_agg(l) FROM jsonb_array_elements(payload->'leagues') l WHERE l->>'id'<>$1)::text) AS other_bars FROM fanta_state WHERE id=1`,[bar.id])).rows[0];
   const report={at:new Date().toISOString(),bar:bar.name,league,job:job.id,teams:rows.map(t=>({name:t.name,coach:users.find(u=>u.id===t.user_id)?.username||'Computer',players:t.players,spent:t.spent})),lineups:(await c3.query('SELECT count(*)::int n FROM fanta.lineups WHERE league_id=$1',[league])).rows[0].n,competition:(await c3.query('SELECT status,start_round FROM fanta.competitions WHERE league_id=$1',[league])).rows,unchanged:{users:before.users===after.users,ledger:before.ledger===after.ledger,otherBars:before.other_bars===after.other_bars}};
   await fs.mkdir(path.resolve('outputs'),{recursive:true});await fs.writeFile(path.resolve('outputs','fanta-'+bar.id+'-created.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
  }finally{c3.release();}
 }
}finally{await closeDatabase();}
