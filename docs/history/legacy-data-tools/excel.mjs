// Historical, offline-only data migration tool. Never imported by application entrypoints.
import {unzipSync,strFromU8} from 'fflate';
import {hashInput} from '../../../fanta/votes.mjs';
const clubs={ATA:'Atalanta',BOL:'Bologna',CAG:'Cagliari',COM:'Como',CRE:'Cremonese',FIO:'Fiorentina',FRO:'Frosinone',GEN:'Genoa',INT:'Inter',JUV:'Juventus',LAZ:'Lazio',LEC:'Lecce',MIL:'Milan',MON:'Monza',NAP:'Napoli',PAR:'Parma',PIS:'Pisa',ROM:'Roma',SAS:'Sassuolo',TOR:'Torino',UDI:'Udinese',VEN:'Venezia',VER:'Verona'};
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
function decode(s){return s.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi,e=>{const map={'&amp;':'&','&lt;':'<','&gt;':'>','&quot;':'"','&apos;':"'"};if(map[e])return map[e];const n=e[2]?.toLowerCase()==='x'?parseInt(e.slice(3,-1),16):Number(e.slice(2,-1));if(!Number.isInteger(n)||n<0||n>0x10ffff)throw Error('Entità XML non valida');return String.fromCodePoint(n);});}
const text=xml=>[...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map(m=>decode(m[1])).join('');
const number=s=>{if(s==null||s===''||/^(?:-|SV|S\.V\.)$/i.test(s))return null;const n=Number(String(s).replace(',','.'));if(!Number.isFinite(n)||Math.abs(n)>500)throw Error('Valore numerico non riconosciuto');return n;};
export function workbook(bytes){
 if(!bytes?.length||bytes.length>2000000)throw Error('File XLSX non valido');let count=0,size=0;
 const zip=unzipSync(bytes,{filter:e=>{if(++count>100||e.originalSize>4000000)throw Error('Limiti XLSX superati');const keep=/^xl\/(?:workbook.xml|_rels\/workbook.xml.rels|sharedStrings.xml|styles.xml|worksheets\/sheet\d+.xml)$/.test(e.name);if(keep){size+=e.originalSize;if(size>4000000)throw Error('File troppo grande');}return keep;}});
 const files=Object.fromEntries(Object.entries(zip).map(([k,v])=>[k,strFromU8(v)]));if(Object.values(files).some(x=>/<!DOCTYPE|<!ENTITY/i.test(x)))throw Error('XML non consentito');
 const sheets=[...(files['xl/workbook.xml']||'').matchAll(/<sheet\b([^>]+)\/?\s*>/g)];if(sheets.length!==1)throw Error('Il file deve contenere una sola giornata');
 const name=decode(sheets[0][1].match(/\bname="([^"]*)"/)?.[1]||''),rid=sheets[0][1].match(/\br:id="([^"]*)"/)?.[1],rel=[...(files['xl/_rels/workbook.xml.rels']||'').matchAll(/<Relationship\b([^>]+)\/?\s*>/g)].find(x=>x[1].match(/\bId="([^"]*)"/)?.[1]===rid)?.[1];
 const raw=rel?.match(/\bTarget="([^"]*)"/)?.[1];if(!raw||!/^(?:\/?xl\/)?worksheets\/sheet\d+\.xml$/.test(raw)||/TargetMode="External"/.test(rel))throw Error('Foglio XLSX non valido');
 const target=raw.startsWith('/xl/')?raw.slice(1):raw.startsWith('xl/')?raw:'xl/'+raw,sheet=files[target];if(!sheet)throw Error('Foglio mancante');
 const strings=[...(files['xl/sharedStrings.xml']||'').matchAll(/<si(?:\s[^>]*)?>([\s\S]*?)<\/si>/g)].map(m=>text(m[1]));
 const styles=files['xl/styles.xml']||'',fills=[...styles.matchAll(/<fill>([\s\S]*?)<\/fill>/g)].map(x=>x[1].match(/<fgColor[^>]*rgb="([^"]+)"/)?.[1]||null),formats=[...(styles.match(/<cellXfs[^>]*>([\s\S]*?)<\/cellXfs>/)?.[1]||'').matchAll(/<xf\b([^>]*?)(?:\/>|>)/g)].map(x=>fills[Number(x[1].match(/fillId="(\d+)"/)?.[1]||0)]||null);
 const rows=[];for(const r of sheet.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)){const cells={__colors:{}};for(const c of (r[2]||'').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)){const ref=c[1].match(/\br="([A-Z]+)\d+"/)?.[1],type=c[1].match(/\bt="([^"]*)"/)?.[1],raw=c[2]?.match(/<v(?:\s[^>]*)?>([\s\S]*?)<\/v>/)?.[1];if(!ref)throw Error('Riferimento cella non valido');const value=type==='s'?strings[Number(raw)]:type==='inlineStr'?text(c[2]||''):decode(raw||'');if(value==null||value.length>1000||cells[ref]!=null)throw Error('Cella non valida');cells[ref]=value.trim();cells.__colors[ref]=formats[Number(c[1].match(/\bs="(\d+)"/)?.[1]||0)]||null;}rows.push(cells);if(rows.length>5000)throw Error('Troppe righe');}
 return {name,rows};
}
export function parseCompletedLineups(bytes,{round,competitionName='Lucas Bar Lega A',expectedMatches=5}={}){
 const w=workbook(bytes),heading=w.rows[0]?.A?.match(/^(.+?)\s*[·–—-]\s*Giornata\s+(\d+)$/i),n=Number(heading?.[2]);
 if(!heading||norm(heading[1])!==norm(competitionName)||w.name!=='Giornata '+n||n!==round||n<1||n>38)throw Error('Competizione o giornata diversa da quella attesa');
 const matches=[];let current;
 const cols=[['A','B','C','D','E','F','G','H','I','J','K','L','M','N','O'],['Q','R','S','T','U','V','W','X','Y','Z','AA','AB','AC','AD','AE']];
 for(const row of w.rows.slice(1)){
  if(row.A&&row.Q&&/^\d+\s*[-–:]\s*\d+$/.test(row.P||'')){current={home:row.A,away:row.Q,score:row.P.split(/[-–:]/).map(x=>Number(x.trim())),teams:[row.A,row.Q].map(name=>({name,formation:null,players:[],missing:false,points:null,bench:false}))};matches.push(current);continue;}
  if(!current)continue;
  for(let i=0;i<2;i++){const c=cols[i],t=current.teams[i],role=row[c[0]]||'',rawName=row[c[1]]||'';
   if(/^Formazione non (?:inserita|disponibile|schierata)$/i.test(role)){t.missing=true;continue;}
   if(role==='Modulo'){if(!/^\d-\d-\d$/.test(rawName)||rawName.split('-').reduce((a,b)=>a+Number(b),0)!==10)throw Error('Modulo non valido');t.formation=rawName;if(row[c[4]]==='Totale')t.points=number(row[c[5]]);continue;}
   if(/^Panchina/.test(role)){t.bench=true;continue;}if(!/^[PDCA]$/.test(role))continue;
   const name=rawName.replace(/[ⒸⓋ]/g,'').replace(/\s*⇄[✓✗]?\s*$/,'').trim(),club=clubs[row[c[3]]?.toUpperCase()]||row[c[3]];
   if(!name||!club||t.players.some(p=>norm(p.name)===norm(name)))throw Error('Calciatore mancante o duplicato');
   const sourceBonusPoints=Object.fromEntries(['G','GS','AU','RS','RSb','RP','A','AS','AG'].map((k,j)=>[k,number(row[c[6+j]])]).filter(([,v])=>v!=null));
   const cardColor=row.__colors[c[2]],events=cardColor==='FFFACC15'?[{kind:'yellow',label:'Ammonizione'}]:cardColor==='FFDC2626'?[{kind:'red',label:'Espulsione'}]:[];
   t.players.push({id:'xlsx:'+hashInput([norm(name),norm(club),role]).slice(0,20),name,club,role,starter:!t.bench,grade:number(row[c[4]]),fantagrade:number(row[c[5]]),sourceBonusPoints,events,sourceCardColor:cardColor,captain:rawName.includes('Ⓒ'),viceCaptain:rawName.includes('Ⓥ'),switchStatus:rawName.includes('⇄✓')?'applied':rawName.includes('⇄✗')?'not-applied':rawName.includes('⇄')?'pending':null});
   if(t.players.length>40)throw Error('Troppi calciatori');
  }
 }
 if(matches.length!==expectedMatches||new Set(matches.flatMap(m=>[norm(m.home),norm(m.away)])).size!==expectedMatches*2)throw Error('Incontri incompleti o squadre duplicate');
 for(const m of matches)for(const t of m.teams){if(t.missing&&t.players.length)throw Error('Formazione assente ma con calciatori');if(!t.missing&&(!t.formation||t.players.filter(p=>p.starter).length!==11||t.players.filter(p=>p.starter&&p.role==='P').length!==1))throw Error('Formazione incompleta');delete t.bench;}
 const output={competitionId:548867,competitionName,round:n,matches};return {...output,digest:hashInput(output)};
}
