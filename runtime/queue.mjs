import fs from 'node:fs/promises';
import path from 'node:path';
import {stateRoot,digest,atomicJson,readJson,withFileLock,retryLocalFile} from './local-blobs.mjs';
import {redact} from './observability.mjs';
const directory=stage=>path.join(stateRoot(),'jobs',stage);
const file=(stage,key)=>path.join(directory(stage),key+'.json');
export async function enqueueJob(job){
 const key=digest(JSON.stringify(job));
 return withFileLock(file('locks',key),async()=>{
  for(const stage of ['queued','running','done'])if(await readJson(file(stage,key)))return {queued:true,duplicate:true};
  await atomicJson(file('queued',key),{key,job,createdAt:new Date().toISOString()});return {queued:true};
 });
}
export async function processOne(execute,{accept=()=>true}={}){
 await fs.mkdir(directory('queued'),{recursive:true});const names=(await fs.readdir(directory('queued'))).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).sort();
 for(const name of names){const key=name.slice(0,-5);let record;
  await withFileLock(file('locks',key),async()=>{const candidate=await readJson(file('queued',key));if(!candidate||!accept(candidate.job))return;await fs.mkdir(directory('running'),{recursive:true});await retryLocalFile(()=>fs.rename(file('queued',key),file('running',key)));record=candidate;});
  if(!record)continue;
  let outcome;try{const response=await execute(record.job);outcome={ok:true,...(response===undefined?{}:{response:redact(response)})};}catch(e){outcome={ok:false,error:e.code||e.name||'Error'};}
  await withFileLock(file('locks',key),async()=>{await atomicJson(file(outcome.ok?'done':'failed',key),{...record,...outcome,finishedAt:new Date().toISOString()});await retryLocalFile(()=>fs.unlink(file('running',key)));});
  return {kind:record.job.name,...outcome};
 }
 return null;
}
