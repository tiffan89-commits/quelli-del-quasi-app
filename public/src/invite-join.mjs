const pending=new Map();
export function joinInvite(code,{join,clear,window:win=globalThis.window}={}){
 const normalized=String(code||'').trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,40}$/.test(normalized))return Promise.reject(Error('Codice lega non valido'));
 if(pending.has(normalized))return pending.get(normalized);
 const task=(async()=>{
  const result=await join(normalized);clear?.();
  // Keep successful membership separate from optional browser URL cleanup.
  if(win?.location&&typeof win.history?.replaceState==='function'){
   try{const url=new URL(win.location.href);url.searchParams.delete('invito');url.searchParams.delete('entry');
   if(/^\/invito\//.test(url.pathname))url.pathname='/';
   if(/^#invito=/.test(url.hash))url.hash='';
   win.history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{} 
  }
  return result;
 })();pending.set(normalized,task);return task.finally(()=>pending.delete(normalized));
}
