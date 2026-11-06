// Local visual check only. Loopback binding, cached aggregate reads, no admin bypass on the real app.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {configure} from '../runtime/config.mjs';
configure();
const {readInsights}=await import('../lib/admin-insights/service.mjs');
const root=path.resolve('public'),port=Number(process.env.ADMIN_PREVIEW_PORT)||8893;
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://127.0.0.1:'+port);res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex');
  if(req.method!=='GET'){res.writeHead(405);res.end();return;}
  if(url.pathname==='/api/platform-insights'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify(await readInsights()));return;}
  if(url.pathname==='/'){
   res.setHeader('Content-Type','text/html; charset=utf-8');res.end(`<!doctype html><html lang="it"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Anteprima Admin · sola lettura</title><link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/system-admin.css"><link rel="stylesheet" href="/admin-insights.css"><main id="admin-root"><p class="tiny muted">ANTEPRIMA LOCALE · SOLA LETTURA</p><section id="admin-insights"></section></main><script type="module">import {mountAdminInsights} from '/src/admin-insights.mjs';mountAdminInsights(document.querySelector('#admin-insights'),async(path,data)=>{if(data)throw Error('Anteprima in sola lettura: usa l’Admin per salvare.');return (await fetch('/api/'+path)).json();});</script></html>`);return;
  }
  const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));
  if(!file.startsWith(root+path.sep)||!['.css','.mjs','.woff2'].includes(path.extname(file))){res.writeHead(404);res.end();return;}
  const body=await fs.readFile(file);res.setHeader('Content-Type',file.endsWith('.css')?'text/css':file.endsWith('.mjs')?'text/javascript':'font/woff2');res.end(body);
 }catch{res.writeHead(404);res.end();}
});
server.listen(port,'127.0.0.1',()=>console.log('Anteprima Admin in sola lettura: http://127.0.0.1:'+port));
