import {connection} from './db.mjs';
import {normalizeTeam} from './calendar.mjs';
export function memoryPlayerStore(initial=[]){
 const records=new Map(initial.map(r=>[r.id,r])),images=new Map(initial.filter(r=>r.data).map(r=>[r.id+':'+r.digest,r]));
 return {
  init:async()=>{},
  pendingOptimization:async(version,limit)=>[...records.values()].filter(r=>r.data&&r.optimizationVersion!==version).slice(0,limit),
  catalog:async teams=>[...records.values()].filter(r=>!teams||teams.map(normalizeTeam).includes(r.team)).map(({data,...r})=>r),
  asset:async(id,digest)=>images.get(id+':'+digest)||null,
  save:async rows=>{for(const r of rows){records.set(r.id,{...records.get(r.id),...r});if(r.data)images.set(r.id+':'+r.digest,r);}},
 };
}
export const sqlPlayerStore={
 async pendingOptimization(version,limit){const c=await connection();try{const {rows}=await c.query("SELECT c.metadata,i.mime,i.data,i.digest FROM football_player_catalog c JOIN football_player_images i ON i.player_id=c.player_id AND i.digest=c.metadata->>'digest' WHERE c.metadata->>'optimizationVersion' IS DISTINCT FROM $1 LIMIT $2",[version,Math.max(1,Math.min(50,limit))]);return rows.map(({metadata,...r})=>({...metadata,...r}));}catch(e){if(e.code==='42P01')return [];throw e;}finally{c.release();}},
 async init(){const c=await connection();try{await c.query('SELECT 1 FROM football_player_catalog LIMIT 0');await c.query('SELECT 1 FROM football_player_images LIMIT 0');}finally{c.release();}},
 async catalog(teams){const c=await connection();try{const {rows}=await c.query('SELECT DISTINCT ON(player_id,team) metadata FROM football_player_catalog WHERE ($1::text[] IS NULL OR team=ANY($1::text[])) ORDER BY player_id,team,season DESC',[teams?teams.map(normalizeTeam):null]);return rows.map(r=>r.metadata);}catch(e){if(e.code==='42P01')return [];throw e;}finally{c.release();}},
 async asset(id,digest){const c=await connection();try{const {rows}=await c.query('SELECT mime,data,digest FROM football_player_images WHERE player_id=$1 AND digest=$2',[id,digest]);return rows[0]||null;}catch(e){if(e.code==='42P01')return null;throw e;}finally{c.release();}},
 async save(records){
  const c=await connection();try{await c.query('BEGIN');
   for(let i=0;i<records.length;i+=40){const batch=records.slice(i,i+40),images=batch.filter(r=>r.data),args=[];
    if(images.length){const values=images.map(r=>{const n=args.length;args.push(r.id,r.digest,r.mime,Buffer.from(r.data));return '($'+(n+1)+',$'+(n+2)+',$'+(n+3)+',$'+(n+4)+')';});await c.query('INSERT INTO football_player_images(player_id,digest,mime,data) VALUES '+values.join(',')+' ON CONFLICT DO NOTHING',args);}
    const meta=batch.map(({data,...r})=>({season:String(r.season),team:normalizeTeam(r.team),id:r.id,metadata:{...r,team:normalizeTeam(r.team)}}));
    await c.query('INSERT INTO football_player_catalog(season,team,player_id,metadata) SELECT season,team,id,metadata FROM jsonb_to_recordset($1::jsonb) AS x(season text,team text,id text,metadata jsonb) ON CONFLICT(season,team,player_id) DO UPDATE SET metadata=EXCLUDED.metadata',[JSON.stringify(meta)]);
   }await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}finally{c.release();}
 },
};
