import fs from 'node:fs/promises';import path from 'node:path';import {build} from 'esbuild';
import {brotliCompressSync,gzipSync,constants} from 'node:zlib';
const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Z]:)/i,'$1'));process.chdir(root);
const output=path.resolve(root,'dist');if(path.dirname(output)!==root||path.basename(output)!=='dist')throw Error('Unsafe output');await fs.rm(output,{recursive:true,force:true});await fs.mkdir('dist',{recursive:true});await fs.cp('public','dist',{recursive:true});
const sheets=['experience.css','dashboard.css','styled-select.css','progression.css','quasi-studio.css','mobile-sections.css','league-settings.css','lineup-pitch.css','password-toggle.css','action-feedback.css','v2.css','bar-slips.css','fanta.css','fanta-integrations.css','chat.css','studio-formazione.css','ux-review.css','ux-spacing.css','auction-room.css','one-screen.css','one-screen-ui.css'];
await fs.mkdir('dist/build',{recursive:true});await fs.writeFile('dist/build/app.css',(await Promise.all(sheets.map(p=>fs.readFile('public/'+p,'utf8')))).join('\n'));
const result=await build({entryPoints:['public/src/app.mjs','public/src/analytics-start.mjs','public/src/pwa-viewport.mjs','public/src/password-toggle.mjs','public/src/auth-submit.mjs'],absWorkingDir:root,bundle:true,splitting:true,format:'esm',platform:'browser',outdir:'dist/build',outExtension:{'.js':'.mjs'},entryNames:'[name]',chunkNames:'chunks/[name]-[hash]',target:['es2022'],minify:true,metafile:true,plugins:[{name:'site-root-imports',setup(b){b.onResolve({filter:/^\//},args=>({path:path.join(root,'public',args.path)}));}}]});
let html=await fs.readFile('public/index.html','utf8');html=html.replace(/<script type="module" src="\/src\/action-feedback.mjs"><\/script>/g,'');for(const p of ['app','analytics-start','pwa-viewport','password-toggle','auth-submit'])html=html.replaceAll('/src/'+p+'.mjs','/build/'+p+'.mjs');
if(process.env.NETLIFY_EMERGENCY==='true')html=html.replace('<html ','<html data-netlify-emergency="true" ');
html=html.replace('<title>','<meta name="qdq-app-css" content="/build/app.css"><title>');await fs.writeFile('dist/index.html',html);
await fs.mkdir('docs',{recursive:true});await fs.writeFile('docs/BUILD-METAFILE.json',JSON.stringify(result.metafile,null,2));
// Precompress public bundles once, never on an API request or on each visitor.
for(const name of [...Object.keys(result.metafile.outputs),'dist/build/app.css']){const body=await fs.readFile(name);if(body.length<4096)continue;await fs.writeFile(name+'.br',brotliCompressSync(body,{params:{[constants.BROTLI_PARAM_QUALITY]:6}}));await fs.writeFile(name+'.gz',gzipSync(body));}
console.log(JSON.stringify({outputs:Object.keys(result.metafile.outputs).length}));
