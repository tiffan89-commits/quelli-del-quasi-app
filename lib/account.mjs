import {accountEmail} from './email-templates.mjs';
import {randomBytes} from 'node:crypto';
import {id,hash,sha,fail,checkPassword} from './game.mjs';
import {mailReady,mailConfig,queueMail} from './mail.mjs';
export const GENERIC_MAIL='Se i dati corrispondono a un account, riceverai un’email con le istruzioni. Controlla anche la cartella spam.';
export const accountNickname=value=>String(value).trim().split('@')[0].slice(0,60);
const nowIso=now=>new Date(now).toISOString();
export function email(value){const e=String(value||'').trim().toLowerCase();if(e.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(e))fail('Inserisci un indirizzo email valido');return e}
function ready(env){if(!mailReady(env))fail('Servizio email temporaneamente non disponibile',503);return mailConfig(env)}
function credential(password){if(typeof password!=='string'||password.length<10||password.length>200)fail('La password deve contenere da 10 a 200 caratteri');const salt=randomBytes(16).toString('hex');return {salt,password:hash(password,salt)}}
function issue(s,u,purpose,target,env,now,entry){
 const removed=(s.accountTokens||[]).filter(t=>t.expires<=now||t.uid===u.id&&t.purpose===purpose);s.mailOutbox=(s.mailOutbox||[]).filter(j=>!removed.some(t=>t.mailId===j.id));s.accountTokens=(s.accountTokens||[]).filter(t=>!removed.includes(t));
 const raw=randomBytes(32).toString('base64url'),expires=now+(purpose==='reset'?30*60000:24*3600000);
 const record={digest:sha(raw),uid:u.id,purpose,email:target,expires};s.accountTokens.push(record);
 const base=new URL(env.APP_BASE_URL);base.pathname='/account.html';base.search=entry==='fanta'?'?entry=fanta':'';base.hash=new URLSearchParams({action:purpose,token:raw}).toString();
 record.mailId=queueMail(s,{to:[target],...accountEmail(purpose,{name:u.name,email:target,username:u.username,url:base.href})},env,expires);Object.assign(s.mailOutbox.find(j=>j.id===record.mailId),{account:true,uid:u.id});return record;
}
export function registerAccount(s,p,env=process.env,now=Date.now()){
 env=ready(env);const target=email(p.email),name=accountNickname(target);
 const secret=credential(p.password);if(s.users.some(u=>String(u.email||'').toLowerCase()===target||String(u.pendingEmail||'').toLowerCase()===target))fail('Indirizzo email non disponibile. Se sei già registrato, accedi o recupera l’account.');
 const u={id:id(),name,email:target,emailVerified:false,nicknameSuggested:true,createdAt:nowIso(now),...secret};s.users.push(u);issue(s,u,'verify',target,env,now,p.entry);return u;
}
export function requestAccountMail(s,value,purpose,env=process.env,now=Date.now()){
 env=ready(env);const lookup=String(value||'').trim().toLowerCase();if(lookup.length>254)fail('Dato non valido');
 const u=s.users.find(u=>!u.demo&&!u.adminOnly&&(u.username===lookup||u.email===lookup||u.pendingEmail===lookup));
 if(u){const actual=purpose==='reset'?'reset':'verify',target=actual==='reset'&&u.emailVerified?u.email:u.pendingEmail||u.email;
  if(target&&!(actual==='verify'&&u.emailVerified&&!u.pendingEmail)&&!s.accountTokens?.some(t=>t.uid===u.id&&t.purpose===actual&&t.expires>now&&t.expires-(actual==='reset'?30*60000:24*3600000)>now-60000)){const t=issue(s,u,actual,target,env,now);if(actual==='reset'&&!u.emailVerified)t.verifyEmailOnReset=true;}
 }
 return GENERIC_MAIL;
}
function tokenRecord(s,raw,purpose,now){if(typeof raw!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(raw))fail('Link non valido o scaduto. Richiedine uno nuovo.');const t=s.accountTokens?.find(t=>t.digest===sha(raw)&&t.purpose===purpose&&t.expires>now),u=t&&s.users.find(u=>u.id===t.uid);if(!u)fail('Link non valido o scaduto. Richiedine uno nuovo.');return {t,u}}
export function activateAccount(s,raw,now=Date.now()){
 const {t,u}=tokenRecord(s,raw,'verify',now);if(s.users.some(x=>x.id!==u.id&&(x.email===t.email||x.pendingEmail===t.email)))fail('Indirizzo email non disponibile');
 u.email=t.email;u.emailVerified=true;u.emailVerifiedAt=nowIso(now);delete u.pendingEmail;s.accountTokens=s.accountTokens.filter(x=>x.uid!==u.id);return u;
}
export function resetAccountPassword(s,raw,password,env=process.env,now=Date.now()){
 env=ready(env);const {t,u}=tokenRecord(s,raw,'reset',now);if(!u.emailVerified&&!(t.verifyEmailOnReset&&[u.email,u.pendingEmail].includes(t.email)))fail('Conferma prima il tuo indirizzo email');const secret=credential(password);if(t.verifyEmailOnReset){if(s.users.some(x=>x.id!==u.id&&(x.email===t.email||x.pendingEmail===t.email)))fail('Indirizzo email non disponibile');u.email=t.email;u.emailVerified=true;u.emailVerifiedAt=nowIso(now);delete u.pendingEmail;if(s.legacyRecoveryOperations?.[t.recoveryOperation])s.legacyRecoveryOperations[t.recoveryOperation].completedAt=nowIso(now)}
 Object.assign(u,secret,{passwordChangedAt:nowIso(now)});s.sessions=s.sessions.filter(x=>x.uid!==u.id);s.accountTokens=s.accountTokens.filter(x=>x.uid!==u.id);
 const mailId=queueMail(s,{to:[u.email],...accountEmail('changed',{name:u.name,email:u.email,username:u.username,url:env.APP_BASE_URL,changedAt:nowIso(now)})},env);Object.assign(s.mailOutbox.find(j=>j.id===mailId),{account:true,uid:u.id});return u;
}
export function changeAccountPassword(s,u,sessionToken,p,now=Date.now()){
 if(!u?.emailVerified||u.demo||u.adminOnly||!u.password)fail('Cambio password non disponibile per questo account',403);
 if(typeof p.currentPassword!=='string'||p.currentPassword.length>200||!checkPassword(u,p.currentPassword))return false;
 if(p.newPassword!==p.confirmPassword)fail('Le nuove password non coincidono');
 Object.assign(u,credential(p.newPassword),{passwordChangedAt:nowIso(now)});
 const current=sha(sessionToken||'');
 s.sessions=s.sessions.filter(x=>x.uid!==u.id||x.token===current);
 const resets=(s.accountTokens||[]).filter(t=>t.uid===u.id&&t.purpose==='reset');
 s.accountTokens=(s.accountTokens||[]).filter(t=>!resets.includes(t));
 s.mailOutbox=(s.mailOutbox||[]).filter(j=>!resets.some(t=>t.mailId===j.id));
 return true;
}
export function setAccountEmail(s,u,p,env=process.env,now=Date.now()){
 env=ready(env);if(String(p.password||'').length>200)fail('Password troppo lunga');if(!checkPassword(u,String(p.password||'')))fail('Password attuale errata');const target=email(p.email);
 if(s.users.some(x=>x.id!==u.id&&(x.email===target||x.pendingEmail===target)))fail('Indirizzo email non disponibile');if(u.email===target&&u.emailVerified)fail('Indirizzo già verificato');u.pendingEmail=target;issue(s,u,'verify',target,env,now);
}

// Owner-authorized recovery of a legacy account. Only callable from server-side maintenance.
export function inviteLegacyRecovery(s,{operation,username,email:target},env=process.env,now=Date.now()){
 env=ready(env);target=email(target);username=String(username||'').trim().toLowerCase();if(!/^[a-zA-Z0-9_-]{16,100}$/.test(String(operation||'')))fail('Identificativo recupero non valido');
 s.legacyRecoveryOperations??={};if(s.legacyRecoveryOperations[operation])return s.legacyRecoveryOperations[operation];
 const found=s.users.filter(u=>!u.demo&&(u.username===username||String(u.name||'').toLowerCase()===username));if(found.length!==1)fail('Account legacy non trovato o ambiguo');const u=found[0];
 if(u.email||u.pendingEmail||u.emailVerified)fail('Account con email già associata: serve verifica amministrativa');if(s.users.some(x=>x.id!==u.id&&(x.email===target||x.pendingEmail===target)))fail('Indirizzo email già utilizzato');
 u.pendingEmail=target;s.sessions=s.sessions.filter(x=>x.uid!==u.id);s.accountTokens=(s.accountTokens||[]).filter(t=>t.uid!==u.id);issue(s,u,'reset',target,env,now);const t=s.accountTokens.at(-1);t.verifyEmailOnReset=true;t.recoveryOperation=operation;
 const op={uid:u.id,email:target,mailId:t.mailId,createdAt:nowIso(now),expires:t.expires,status:'queued',authorizedBy:'site-owner'};s.legacyRecoveryOperations[operation]=op;return op;
}
