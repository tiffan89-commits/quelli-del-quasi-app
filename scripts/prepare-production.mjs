// Portable preparation for CLI deployments that skip Netlify's local build.
// No production database, credentials or environment-variable export involved.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildReleaseEnv} from './build-release-env.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
await buildReleaseEnv(root,{...process.env,CONTEXT:'production',APP_ENV:'production'});
const source=path.join(root,'netlify/database/migrations'),dest=path.join(root,'.netlify/internal/db/migrations');
let count=0;
for(const entry of await fs.readdir(source,{withFileTypes:true})){
 const name=entry.isDirectory()?entry.name:entry.name.replace(/\.sql$/,'');
 if(!/^\d+_[a-z0-9_-]+$/.test(name)||!entry.isDirectory()&&!entry.name.endsWith('.sql'))continue;
 const input=entry.isDirectory()?path.join(source,entry.name,'migration.sql'):path.join(source,entry.name);
 await fs.mkdir(path.join(dest,name),{recursive:true});await fs.copyFile(input,path.join(dest,name,'migration.sql'));count++;
}
console.log(JSON.stringify({environment:'production',migrations:count}));
