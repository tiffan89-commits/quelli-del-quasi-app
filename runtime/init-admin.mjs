import {randomBytes,randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {transaction,closeDatabase} from '../lib/db.mjs';
import {hash} from '../lib/game.mjs';
import {ADMIN_USERNAME,isSystemAdmin,provisionSystemAdmin} from '../lib/system-admin-auth.mjs';
function hiddenPassword(label){
 if(!process.stdin.isTTY||!process.stdout.isTTY)throw Error('Apri un terminale interattivo per inserire la password senza mostrarla.');
 return new Promise((resolve,reject)=>{
  let value='',done=false;const input=process.stdin,oldRaw=input.isRaw;
  const finish=(error)=>{if(done)return;done=true;input.off('data',onData);input.setRawMode(!!oldRaw);input.pause();process.stdout.write('\n');error?reject(error):resolve(value);};
  const onData=chunk=>{if(chunk.startsWith('\x1b'))return;for(const ch of chunk){if(ch==='\u0003')return finish(Error('Operazione annullata.'));if(ch==='\r'||ch==='\n')return finish();if(ch==='\u007f'||ch==='\b')value=Array.from(value).slice(0,-1).join('');else if(ch>=' ')value+=ch;}};
  process.stdout.write(label);input.setRawMode(true);input.setEncoding('utf8');input.on('data',onData);input.resume();
 });
}
export async function initializeAdmin({transact=transaction,prompt=hiddenPassword}={}){
 const inspect=s=>{if(s.users.some(isSystemAdmin))return true;if(s.users.some(u=>u.username===ADMIN_USERNAME))throw Error('Username amministrativo già usato da un giocatore. Nessun account modificato.');return false;};
 if(await transact(inspect))return {created:false};
 let password=await prompt('Nuova password per '+ADMIN_USERNAME+': '),confirmation=await prompt('Ripeti la password: ');
 if(password!==confirmation)throw Error('Le password non coincidono.');
 if(password.length<10||password.length>200)throw Error('Usa una password tra 10 e 200 caratteri.');
 const salt=randomBytes(16).toString('hex'),config={operation:'portable-admin:'+randomUUID(),salt,password:hash(password,salt)};password='';confirmation='';
 return transact(s=>{if(inspect(s))return {created:false};provisionSystemAdmin(s,config);if(!s.users.some(isSystemAdmin))throw Error('Creazione amministratore non completata.');return {created:true};});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await initializeAdmin();console.log(result.created?'Amministratore creato. L’accesso richiede anche il codice email.':'Amministratore già presente: account e password lasciati invariati.');}
 catch(error){console.error(error.message);process.exitCode=1;}
 finally{await closeDatabase();}
}
