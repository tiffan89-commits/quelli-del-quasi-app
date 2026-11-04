import fs from'node:fs/promises';import path from'node:path';import{fileURLToPath}from'node:url';import{execFileSync}from'node:child_process';
const project=fileURLToPath(new URL('../',import.meta.url));
export async function release(kind,{root=project,now=new Date()}={}){
 if(!['patch','minor','major'].includes(kind))throw Error('Uso: node scripts/release.mjs patch|minor|major');
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(git(['status','--porcelain=v1','--untracked-files=all']))throw Error('Working tree non pulito: committa o metti da parte le modifiche prima del rilascio.');
 const branch=git(['branch','--show-current']);
 if(branch!=='staging'&&!(kind==='patch'&&/^hotfix\/.+/.test(branch)))throw Error('Rilascio ammesso su staging; solo patch anche su hotfix/*.');
 git(['var','GIT_AUTHOR_IDENT']);git(['var','GIT_COMMITTER_IDENT']);
 const exists=async p=>fs.stat(path.join(root,p)).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;});
 const versionPath=await exists('public/version.json')?'public/version.json':'version.json';
 const original=new Map(),changes=new Map();const read=async p=>{const b=await fs.readFile(path.join(root,p));original.set(p,b);return b.toString();};
 const metadata=JSON.parse(await read(versionPath));
 if(!/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(metadata.version))throw Error('version.json deve contenere una versione semver stabile.');
 let [major,minor,patch]=metadata.version.split('.').map(Number);if(kind==='major'){major++;minor=patch=0;}else if(kind==='minor'){minor++;patch=0;}else patch++;
 if(![major,minor,patch].every(Number.isSafeInteger))throw Error('Versione fuori intervallo');const next=[major,minor,patch].join('.'),tag='v'+next;
 if(git(['tag','--list',tag]))throw Error('Tag già esistente: '+tag);
 metadata.version=next;metadata.releasedAt=now.toISOString();changes.set(versionPath,JSON.stringify(metadata,null,2)+'\n');
 for(const p of ['package.json','package-lock.json'])if(await exists(p)){const data=JSON.parse(await read(p));data.version=next;if(p==='package-lock.json'&&data.packages?.[''])data.packages[''].version=next;changes.set(p,JSON.stringify(data,null,2)+'\n');}
 const changelog=await read('CHANGELOG.md'),match=/^## \[Unreleased\][^\r\n]*\r?\n([\s\S]*?)(?=^## \[|$(?![\s\S]))/m.exec(changelog);
 if(!match||!/^\s*[-*] \S/m.test(match[1]))throw Error('Aggiungi prima le modifiche in CHANGELOG.md, sezione [Unreleased].');
 const date=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 changes.set('CHANGELOG.md',changelog.slice(0,match.index)+'## [Unreleased]\n\n## ['+next+'] - '+date+'\n'+match[1]+changelog.slice(match.index+match[0].length));
 const sw=await exists('public/sw.js')?'public/sw.js':await exists('sw.js')?'sw.js':null;
 if(sw){const text=await read(sw);if(!/\bconst\s+CACHE\s*=\s*(['"])[^'"]+\1/.test(text))throw Error('Costante CACHE non riconosciuta in sw.js: nessun file aggiornato.');changes.set(sw,text.replace(/(\bconst\s+CACHE\s*=\s*)(['"])[^'"]+\2/,'$1"quellidelquasi-shell-v'+next+'"'));}
 let committed=false;
 try{
  for(const [p,data]of changes)await fs.writeFile(path.join(root,p),data);
  git(['-c','core.autocrlf=false','add','--',...changes.keys()]);
  git(['commit','-m','release: '+tag,'-m','rilascio: passo 6 – versione, changelog e cache PWA']);committed=true;
  git(['tag','-a',tag,'-m','rilascio: passo 6 – '+tag]);
 }catch(error){if(!committed){for(const[p,data]of original)await fs.writeFile(path.join(root,p),data);try{git(['restore','--staged','--',...changes.keys()]);}catch{}}else console.error('Commit creato; tag non completato. Verifica prima di ripetere.');throw error;}
 console.log('Creati commit e tag '+tag+'. Nessun push eseguito.');
 const uploadBranch=branch==='staging'?'release/'+tag:branch;
 if(branch==='staging')console.log('Crea il branch tecnico senza cambiare il commit:\ngit switch -c '+uploadBranch);
 console.log('Dopo la verifica del proprietario:\ngit push -u origin '+uploadBranch+'\ngit push origin '+tag);
 console.log(branch==='staging'?'Apri la PR '+uploadBranch+' verso staging, senza squash/rebase. Poi allinea staging e apri la PR staging verso main.':'Apri la PR hotfix verso main. Dopo il rilascio riporta main in staging.');
 console.log('Attendi approvazione esplicita del proprietario. Non fare push diretto su main o staging.');
 return next;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))try{await release(process.argv[2]);}catch(e){console.error(e.message);process.exitCode=1;}
