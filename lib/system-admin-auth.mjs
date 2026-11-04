import {randomBytes,randomInt,createHmac,timingSafeEqual} from 'node:crypto';
import {id,sha,checkPassword,fail} from './game.mjs';
import {queueMail,mailReady} from './mail.mjs';
import bootstrap from './system-admin-bootstrap.json' with {type:'json'};

export const ADMIN_USERNAME='tiffano';
export const ADMIN_MAIL='tiffan89@gmail.com';
export const isSystemAdmin=u=>!!u&&u.adminOnly===true&&u.role==='system-admin'&&!u.demo;
export function provisionSystemAdmin(s,config=(process.env.NETLIFY==='true'||process.env.DEPLOY_ID||process.env.URL)?bootstrap:{}){
  delete s.platformOwnerId;
  if(!config.operation||s.adminProvisioned===config.operation)return;
  let u=s.users.find(u=>u.username===ADMIN_USERNAME);
  if(u&&!isSystemAdmin(u)){if(!s.adminProvisionError)console.warn('SYSTEM_ADMIN_NAME_CONFLICT');s.adminProvisionError='USERNAME_CONFLICT';return;}
  if(!u){u={id:id(),username:ADMIN_USERNAME,name:'Tiffano',role:'system-admin',adminOnly:true,otpEmail:ADMIN_MAIL,salt:config.salt,password:config.password,createdAt:new Date().toISOString()};s.users.push(u);}
  s.systemAdminId=u.id;s.adminProvisioned=config.operation;
}
const codeDigest=(challenge,code,env)=>createHmac('sha256',env.ADMIN_OTP_KEY||env.MAIL_ENCRYPTION_KEY||env.RESEND_API_KEY||'').update(challenge+':'+code).digest('hex');
export function beginAdminLogin(s,input,env=process.env,now=Date.now()){
  provisionSystemAdmin(s);
  s.adminLoginLimit??={attempts:0,until:now+900000};
  const limit=s.adminLoginLimit;if(limit.until<=now){limit.attempts=0;limit.until=now+900000;}
  if(++limit.attempts>12)return {status:429,data:{error:'Troppi tentativi amministrativi. Riprova tra 15 minuti.'}};
  const u=s.users.find(u=>u.username===String(input.username||'').trim().toLowerCase());
  if(!isSystemAdmin(u)||String(input.password||'').length>200||!checkPassword(u,String(input.password||'')))return {status:401,data:{error:'Credenziali errate'}};
  if(!mailReady(env))fail('Invio del codice temporaneamente non disponibile',503);
  const active=s.adminChallenges?.find(c=>c.uid===u.id&&c.expires>now&&c.created>now-60000);
  if(active?.publicId)return {mailId:active.mailId,data:{ok:true,adminOnly:true,requireAdminCode:true,challenge:active.publicId,expiresAt:active.expires,message:'Inserisci il codice già inviato all’indirizzo amministrativo.'}};
  if(active)return {status:429,data:{error:'Codice già inviato. Attendi un minuto prima di richiederne un altro.'}};
  const obsolete=(s.adminChallenges||[]).filter(c=>c.uid===u.id||c.expires<=now);
  s.mailOutbox=(s.mailOutbox||[]).filter(j=>!obsolete.some(c=>c.mailId===j.id));
  s.adminChallenges=(s.adminChallenges||[]).filter(c=>!obsolete.includes(c));
  const challenge=randomBytes(24).toString('base64url'),code=String(randomInt(0,100000000)).padStart(8,'0'),expires=now+300000;
  const mailId=queueMail(s,{to:[ADMIN_MAIL],subject:'Il tuo codice ADMIN · Quelli del Quasi',text:`Il codice per accedere come tiffano è: ${code}\n\nÈ valido per 5 minuti e può essere usato una sola volta.`,html:`<div style="background:#0c1914;color:#f4f2e7;padding:32px;font-family:Arial,sans-serif"><h2>La sala di controllo del bar</h2><p>Il tuo codice ADMIN:</p><p style="font-size:34px;letter-spacing:5px;font-weight:bold">${code}</p><p>Valido 5 minuti · un solo utilizzo.</p></div>`},env,expires);
  Object.assign(s.mailOutbox.find(j=>j.id===mailId),{account:true,uid:u.id});s.adminChallenges.push({uid:u.id,challenge:sha(challenge),publicId:challenge,digest:codeDigest(challenge,code,env),expires,created:now,attempts:0,mailId});
  return {mailId,data:{ok:true,adminOnly:true,requireAdminCode:true,challenge,expiresAt:expires,message:'Codice inviato all’indirizzo amministrativo. È valido 5 minuti.'}};
}
export function finishAdminLogin(s,input,env=process.env,now=Date.now()){
  const challenge=String(input.challenge||''),code=String(input.code||'').trim();
  const c=s.adminChallenges?.find(c=>c.challenge===sha(challenge)),u=c&&s.users.find(u=>u.id===c.uid);
  if(!c||c.expires<=now||c.attempts>=5||!isSystemAdmin(u))return {status:401,data:{error:'Codice scaduto o non valido. Ripeti l’accesso.'}};
  c.attempts++;
  const digest=codeDigest(challenge,code,env);
  if(!/^\d{8}$/.test(code)||!timingSafeEqual(Buffer.from(c.digest,'hex'),Buffer.from(digest,'hex')))return {status:401,data:{error:c.attempts>=5?'Troppi tentativi. Ripeti l’accesso.':'Codice non valido.'}};
  s.adminChallenges=s.adminChallenges.filter(x=>x.uid!==u.id);
  s.mailOutbox=(s.mailOutbox||[]).filter(j=>j.id!==c.mailId);
  const token=randomBytes(32).toString('base64url');
  s.sessions=s.sessions.filter(x=>x.expires>now);
  s.sessions.push({uid:u.id,token:sha(token),expires:now+8*3600000,admin:true,mfaAt:now});
  u.lastLoginAt=new Date(now).toISOString();s.adminLoginLimit={attempts:0,until:now+900000};
  return {token,data:{ok:true,adminOnly:true}};
}
export function requireSystemAdmin(s,u){if(!isSystemAdmin(u)||s.systemAdminId!==u.id)fail('Accesso riservato all’amministratore di sistema',403);}
export function requireRecentAdmin(s,u,token,now=Date.now()){
  requireSystemAdmin(s,u);const a=s.sessions.find(a=>a.token===sha(token||'')&&a.uid===u.id&&a.admin);
  if(!a||a.expires<=now||now-a.mfaAt>10*60000)fail('Per cancellare dati, accedi nuovamente con un codice email recente.',403);
}
