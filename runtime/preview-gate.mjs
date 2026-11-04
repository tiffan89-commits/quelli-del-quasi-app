import {createHmac,timingSafeEqual} from 'node:crypto';
const equal=(a,b)=>{const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);};
export function previewGate(req,url,{env=process.env,now=Date.now()}={}){
 const key=env.SELFHOST_PREVIEW_KEY;if(!key||url.pathname==='/healthz')return null;
 if(key.length<32)throw Error('Preview access key too short');
 const signature=value=>createHmac('sha256',key).update('preview:'+value).digest('base64url');
 if(url.pathname==='/_preview/access'&&req.method==='GET'&&equal(url.searchParams.get('key')||'',key)){
  const expires=String(now+24*3600000),cookie=expires+'.'+signature(expires);
  return new Response(null,{status:303,headers:{Location:'/', 'Set-Cookie':'__Host-quasi-preview='+cookie+'; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400','Cache-Control':'no-store','Referrer-Policy':'no-referrer'}});
 }
 const cookie=String(req.headers.cookie||'').split(';').map(v=>v.trim()).find(v=>v.startsWith('__Host-quasi-preview='))?.split('=').slice(1).join('=')||'',[expires,sig='']=cookie.split('.');
 if(/^\d{13}$/.test(expires||'')&&Number(expires)>now&&Number(expires)<=now+24*3600000&&equal(sig,signature(expires)))return null;
 return new Response('<!doctype html><meta name="viewport" content="width=device-width"><title>Prova privata · Quelli del Quasi</title><body style="background:#0c1915;color:#f4f1df;font:18px system-ui;padding:10vh 8vw"><h1>Questo bar è in prova.</h1><p>Apri il collegamento privato ricevuto per entrare.</p></body>',{status:401,headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff'}});
}
