import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {parseHTML} from 'linkedom';
import {buildSeo,pages,SITE,graph} from '../scripts/build-seo.mjs';
import {renderLanding} from '../public/src/pubblico/landing.mjs';

test('SEO pages are usable without JavaScript, canonicals and public internal links resolve; previews cannot advertise indexable URLs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'quasi-seo-'));
 try{
 await buildSeo(root,true);let robots=await fs.readFile(path.join(root,'public/robots.txt'),'utf8');assert.match(robots,/Sitemap: https:\/\/quellidelquasi.com\/sitemap.xml/);assert.doesNotMatch(robots,/Disallow: \/\s*$/m);
 let xml=await fs.readFile(path.join(root,'public/sitemap.xml'),'utf8');assert.equal((xml.match(/<loc>/g)||[]).length,4);assert.doesNotMatch(xml,/lastmod|admin|account|invito/);
 for(const page of pages){
 const html=await fs.readFile(path.join(root,'public',page.slug+'.html'),'utf8'),{document:d}=parseHTML(html);
 assert.equal(d.querySelectorAll('h1').length,1);assert.equal(d.querySelector('h1').textContent,page.title);assert.ok(d.querySelectorAll('h2').length>=6);assert.equal(d.querySelector('link[rel="canonical"]').getAttribute('href'),SITE+'/'+page.slug+'.html');assert.equal(d.querySelector('meta[name="robots"]').content,'index,follow,max-image-preview:large');
 const scripts=[...d.querySelectorAll('script')];assert.equal(scripts.length,2);assert.equal(scripts.filter(s=>s.type==='application/ld+json').length,1);assert.equal(scripts.filter(s=>s.type==='module'&&s.getAttribute('src')==='/src/analytics-start.mjs').length,1);assert.ok(!scripts.some(s=>/^https:/.test(s.getAttribute('src')||'')));const data=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);assert.deepEqual(data,graph(page));assert.equal(data['@graph'].find(n=>n['@type']==='BreadcrumbList').itemListElement.length,2);
 for(const a of d.querySelectorAll('a')){const href=a.getAttribute('href');if(href.startsWith('#'))assert.ok(d.getElementById(href.slice(1)));if(href.endsWith('.html'))assert.ok(href==='/privacy.html'||pages.some(p=>href==='/'+p.slug+'.html')); }
 }
 await buildSeo(root,false);robots=await fs.readFile(path.join(root,'public/robots.txt'),'utf8');assert.equal(robots,'User-agent: *\nDisallow: /\n');xml=await fs.readFile(path.join(root,'public/sitemap.xml'),'utf8');assert.doesNotMatch(xml,/<loc>/);for(const p of pages)assert.match(await fs.readFile(path.join(root,'public',p.slug+'.html'),'utf8'),/content="noindex,nofollow"/);
 }finally{if(path.dirname(root)!==os.tmpdir()||!path.basename(root).startsWith('quasi-seo-'))throw Error('Unsafe cleanup');await fs.rm(root,{recursive:true,force:true});}
});

test('home metadata, favicon formats, real sharing artwork and static/dynamic guide navigation agree without fabricated rating or price',async()=>{
 const dir=new URL('../public/',import.meta.url),html=await fs.readFile(new URL('index.html',dir),'utf8'),{document:d}=parseHTML(html);
 assert.equal(d.querySelectorAll('title').length,1);assert.match(d.title,/Fantacalcio e schedine tra amici/);assert.equal(d.querySelector('link[rel="canonical"]').href,SITE+'/');const data=JSON.parse(d.querySelector('script[type="application/ld+json"]').textContent);assert.deepEqual(data,graph());assert.doesNotMatch(JSON.stringify(data),/aggregateRating|reviewCount|"offers"|SearchAction|FAQPage/);
 const ico=await fs.readFile(new URL('favicon.ico',dir));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);for(let i=0;i<3;i++){const at=6+i*16;assert.equal(ico[at],[16,32,48][i]);const offset=ico.readUInt32LE(at+12),length=ico.readUInt32LE(at+8);assert.ok(offset+length<=ico.length);assert.equal(ico.readUInt32BE(offset),0x89504e47);}
 for(const [file,width,height] of [['assets/icons/favicon-48.png',48,48],['assets/icons/og-image.png',1200,630]]){const p=await fs.readFile(new URL(file,dir));assert.equal(p.readUInt32BE(16),width);assert.equal(p.readUInt32BE(20),height);}
 assert.match(await fs.readFile(new URL('favicon.svg',dir),'utf8'),/viewBox="0 0 256 256"/);assert.match(d.querySelector('noscript').textContent,/#entry-splash\{display:none/);
 for(const markup of [html,renderLanding()]){const {document:landing}=parseHTML(markup);for(const p of pages)assert.ok(landing.querySelector(`a[href="/${p.slug}.html"]`));}
});
