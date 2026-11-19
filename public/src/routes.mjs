const modes=new Set(['bar','fanta']);
export function readAppRoute(hash=globalThis.location?.hash||''){
 const match=hash.match(/^#\/(bar|fanta)\/([a-z-]+)(?:\/([a-z-]+))?(?:\?(.*))?$/);if(!match)return null;
 const params=new URLSearchParams(match[4]||'');return {mode:match[1],page:match[2],section:match[3]||null,league:params.get('lega'),round:params.get('giornata'),...(params.has('competizione')?{competition:params.get('competizione')}:{})};
}
export const isSubmissionRoute=route=>!!(route?.league&&route.round&&(route.mode==='bar'?route.page==='schedina':route.mode==='fanta'&&route.page==='squadra'&&route.section==='studio'));
export function appRoute({mode,page,section,league,round,competition}){if(!modes.has(mode))throw Error('Invalid app mode');const q=new URLSearchParams();if(league)q.set('lega',league);if(round)q.set('giornata',round);if(competition)q.set('competizione',competition);return '#/'+mode+'/'+page+(section?'/'+section:'')+(q.size?'?'+q:'');}
export function writeAppRoute(route,{replace=false}={}){
 const hash=appRoute(route);
 if(!globalThis.location||!globalThis.history||location.hash===hash)return;
 const previous=replace?history.state?.qdqPreviousRoute:readAppRoute()?location.hash:null;
 history[replace?'replaceState':'pushState']({qdqRoute:true,qdqPreviousRoute:previous},'',location.pathname+location.search+hash);
 globalThis.window?.dispatchEvent?.(new Event('quasi:navigation'));
}
