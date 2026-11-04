import fs from 'node:fs/promises';import {randomBytes,randomUUID} from 'node:crypto';
import {transaction,closeDatabase} from '../lib/db.mjs';import {hash,id} from '../lib/game.mjs';import {createLeaguePair} from '../fanta/league-creation.mjs';
const file=process.argv[2],db=new URL(process.env.DATABASE_URL||'http://invalid');
if(process.env.SELFHOST_TEST_INSTANCE!=='true'||!['localhost','127.0.0.1'].includes(db.hostname)||!file)throw Error('Seed consentito solo su DB locale di prova esplicitamente identificato');
if(await fs.stat(file).catch(()=>null))throw Error('File accesso già presente: nessun dato sovrascritto');
const password='QuasiProva-'+randomBytes(12).toString('base64url'),salt=randomBytes(16).toString('hex');
try{await transaction(async(s,c)=>{
 if(s.users.length||s.leagues.length||(await c.query('SELECT 1 FROM fanta.leagues LIMIT 1')).rows.length)throw Error('Database non vuoto: nessun seed eseguito');
 const u={id:id(),username:'servercasa',name:'Il Quasi del server',email:'servercasa@example.test',emailVerified:true,createdAt:new Date().toISOString(),salt,password:hash(password,salt)};s.users.push(u);
 const result=await createLeaguePair(c,s,u,{name:'Server di casa · TEST',rosterMode:'empty',size:8,requestId:randomUUID()});const l=s.leagues.find(l=>l.id===result.league);
 s.rounds=s.rounds.filter(r=>r.league!==l.id);
 const now=Date.now(),odds={1:2.1,X:3.2,2:3.4,'1X':1.3,'12':1.25,'X2':1.7,Goal:1.8,'No Goal':1.9,'Under 2.5':1.8,'Over 2.5':1.95};
 for(const number of [10,11]){const past=number===10,kickoff=new Date(now+(past?-7:2)*86400000).toISOString();s.rounds.push({id:'selfhost-test:'+number,league:l.id,source:'seriea',number,title:'Giornata '+number,kickoff,rules:structuredClone(l.rules),slips:[],closed:past,settled:past,matches:[{id:'selfhost-test:'+number+':1',home:'Inter',away:'Juventus',kickoff,odds:{...odds},status:past?'FT':'NS',score:past?[2,1]:null}]});}
});await fs.writeFile(file,'SOLO PROVA LOCALE — nessun account Netlify modificato\nUtente: servercasa\nPassword: '+password+'\nURL: http://localhost:8845/\n',{flag:'wx',mode:0o600});console.log('Utente sintetico servercasa e lega di prova creati; password solo nel file locale indicato');
}catch(e){console.error(e.message);process.exitCode=1;}finally{await closeDatabase();}
