import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const root=new URL('../',import.meta.url);
test('Netlify storage never falls back to a local directory',()=>{
 const env={...process.env};for(const k of ['SELFHOST_RUNTIME','NETLIFY_BLOBS_CONTEXT','NETLIFY_SITE_ID','NETLIFY_AUTH_TOKEN'])delete env[k];
 const out=execFileSync(process.execPath,['--input-type=module','-e',"import {getStore} from './lib/blob-store.mjs';try{getStore({name:'adapter-test'});process.exit(2)}catch(e){if(e.name!=='MissingBlobsEnvironmentError')throw e;console.log('managed')}"],{cwd:root,env,encoding:'utf8'});
 assert.equal(out.trim(),'managed');
});
test('autonomous bootstrap selects local storage and preserves the supplied origin',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'quasi-adapters-'));
 try{
  const out=execFileSync(process.execPath,['--input-type=module','-e',"import {configure} from './runtime/config.mjs';import {getStore} from './lib/blob-store.mjs';configure();const s=getStore({name:'adapter-test'});await s.setJSON('key',{ok:true});console.log(JSON.stringify({value:await s.get('key',{type:'json'}),mode:process.env.SELFHOST_RUNTIME,origin:process.env.URL}));"],{cwd:root,env:{...process.env,SELFHOST_DATA_DIR:dir,PUBLIC_ORIGIN:'https://casa.example.test'},encoding:'utf8'});
  assert.deepEqual(JSON.parse(out),{value:{ok:true},mode:'true',origin:'https://casa.example.test'});
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
