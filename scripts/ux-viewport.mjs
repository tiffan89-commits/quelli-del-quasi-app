// Development-only viewport wrapper. The app keeps its true responsive viewport;
// no production endpoints, environment files or data are used by this wrapper.
export function uxViewport(searchParams){
 const width=searchParams.get('w')==='1280'?1280:390,height=width===1280?800:844;
 const screens={'bar-oggi':'bar/oggi','bar-schedina':'bar/schedina','bar-classifica':'bar/classifica','bar-quasi':'bar/quasi','bar-profilo':'bar/profilo','bar-admin':'bar/admin','fanta-oggi':'fanta/oggi','fanta-squadra':'fanta/squadra','fanta-lega':'fanta/lega'},screen=screens[searchParams.get('screen')]||'bar/oggi';
 return `<!doctype html><html lang="it"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow"><title>UX · ${width}×${height}</title></head><body style="margin:0;background:#28382f;color:white;font:12px sans-serif;text-align:center"><p>Anteprima isolata · ${width} × ${height} · dati sintetici</p><iframe title="App in prova" src="/#/${screen}" style="display:block;width:${width}px;height:${height}px;border:0;margin:auto"></iframe></body></html>`;
}
