const modes=new Set(['bar','fanta']);
export function readAppRoute(hash=globalThis.location?.hash||''){
 const match=hash.match(/^#\/(bar|fanta)\/([a-z-]+)(?:\/([a-z-]+))?(?:\?(.*))?$/);if(!match)return null;
 const params=new URLSearchParams(match[4]||'');return {mode:match[1],page:match[2],section:match[3]||null,league:params.get('lega'),round:params.get('giornata')};
}
export function appRoute({mode,page,section,league,round}){if(!modes.has(mode))throw Error('Invalid app mode');const q=new URLSearchParams();if(league)q.set('lega',league);if(round)q.set('giornata',round);return '#/'+mode+'/'+page+(section?'/'+section:'')+(q.size?'?'+q:'');}
export function writeAppRoute(route,{replace=false}={}){const hash=appRoute(route);if(!globalThis.location||!globalThis.history||location.hash===hash)return;history[replace?'replaceState':'pushState']({qdqRoute:true},'',location.pathname+location.search+hash);globalThis.window?.dispatchEvent?.(new Event('quasi:navigation'));}
