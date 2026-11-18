import {isDeepStrictEqual} from 'node:util';

const sections=[
 {key:'leagues',table:'bar_league_state',ordered:true,write:"fanta.bar_replace_ordered('fanta.bar_league_state',$1::jsonb)"},
 {key:'rounds',table:'bar_matchday_documents',ordered:true,write:'fanta.bar_replace_matchdays($1::jsonb)'},
 {key:'ledger',table:'bar_credit_ledger',ordered:true,write:"fanta.bar_replace_ordered('fanta.bar_credit_ledger',$1::jsonb)"},
 {key:'playerRewards',table:'bar_player_rewards',id:'user_id'},
 {key:'playerProfiles',table:'bar_player_profiles',id:'profile_key'},
 {key:'analysisTextHashes',table:'bar_analysis_hashes',id:'hash'},
 {key:'calendar',table:'bar_seriea_calendar_documents',ordered:true,path:['football','calendar','rounds'],write:'fanta.bar_replace_calendar($1::jsonb)'},
 {key:'bookable',table:'bar_football_round_cache',id:'cache_key',path:['football','rounds']},
];
const pathOf=section=>section.path||[section.key];
const atPath=(value,path)=>path.reduce((item,key)=>item?.[key],value);
const parentOf=(value,path)=>atPath(value,path.slice(0,-1));
const isObject=value=>value&&typeof value==='object'&&!Array.isArray(value);
const copyRoot=root=>({...root,...(isObject(root.football)?{football:{...root.football,
 ...(isObject(root.football.calendar)?{calendar:{...root.football.calendar}}:{})}}:{})});

export async function loadBarDocument(client){
 const {rows:[row]}=await client.query('SELECT payload,storage_shape FROM public.fanta_state WHERE id=1');
 if(!row?.storage_shape)throw Error('Archivio Bar normalizzato non attivo');
 // Keep the database payload intact for the write-time conflict check.
 const state=structuredClone(row.payload);
 for(const section of sections){
  const columns=section.ordered?'data':section.id+' AS key,data';
  const {rows}=await client.query(`SELECT ${columns} FROM fanta.${section.table}${section.ordered?' ORDER BY position':''}`);
  const path=pathOf(section),parent=parentOf(state,path);
  const value=rows.length?(section.ordered?rows.map(item=>item.data):Object.fromEntries(rows.map(item=>[item.key,item.data]))):row.storage_shape[section.key];
  if(isObject(parent)&&value!==undefined)parent[path.at(-1)]=value;
 }
 return {state,root:row.payload};
}

export async function writeBarDocument(client,{patch,removed,before,root}){
 const delta=copyRoot(patch),shape={},changed=[];
 for(const section of sections){
  const path=pathOf(section),parent=parentOf(delta,path);
  const key=path.at(-1),top=path[0];
  if(!Object.hasOwn(patch,top)&&!removed.includes(top))continue;
  const value=parent?.[key];
  if(isObject(parent))delete parent[key];
  // Avoid replacing the calendar when only football metadata changed.
  const old=path.length===1?before.get(top):atPath(JSON.parse(before.get(top)||'{}'),path.slice(1));
  if(path.length===1?JSON.stringify(value)===old:isDeepStrictEqual(old,value))continue;
  changed.push({section,value});
  if(value!==undefined)shape[section.key]=section.ordered&&Array.isArray(value)?[]:!section.ordered&&isObject(value)?{}:value;
 }
 const {rows:[current]}=await client.query('SELECT payload FROM public.fanta_state WHERE id=1 FOR UPDATE');
 if(!current)throw Error('Stato Bar non inizializzato');
 const keys=[...Object.keys(delta),...removed];
 if(keys.some(k=>!isDeepStrictEqual(root[k],current.payload[k])))
  throw Object.assign(Error('Dati aggiornati durante l’operazione. Riprova.'),{status:409});
 for(const {section,value} of changed){
  const sql=section.write||`fanta.bar_replace_map('fanta.${section.table}','${section.id}',$1::jsonb)`;
  await client.query('SELECT '+sql,[value===undefined?null:JSON.stringify(value)]);
 }
 await client.query(`UPDATE public.fanta_state SET payload=(payload-$1::text[])||$2::jsonb,
  storage_shape=(storage_shape-$3::text[])||$4::jsonb WHERE id=1`,
 [removed,JSON.stringify(delta),changed.map(({section})=>section.key),JSON.stringify(shape)]);
}
