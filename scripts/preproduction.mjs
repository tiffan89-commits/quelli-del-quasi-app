import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
// Deliberately pass no provider credentials, DB URLs, mail keys or worker flags.
const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP','USERPROFILE','APPDATA','LOCALAPPDATA'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
if(!process.env.PREVIEW_PASSWORD||process.env.PREVIEW_PASSWORD.length<20)throw Error('Set a private PREVIEW_PASSWORD of at least 20 characters');
Object.assign(env,{PREVIEW_PORT:process.env.PREVIEW_PORT||'8995',PREVIEW_PUBLIC:'1',PREVIEW_PASSWORD:process.env.PREVIEW_PASSWORD});
const child=spawn(process.execPath,['scripts/dev-isolated.mjs'],{cwd:fileURLToPath(new URL('../',import.meta.url)),env,stdio:'inherit',windowsHide:true});
child.on('exit',code=>{process.exitCode=code??1;});
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>child.kill());
