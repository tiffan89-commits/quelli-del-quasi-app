const modes=new Set(['bar','fanta']);
export function readAppRoute(hash=globalThis.location?.hash||''){
 const match=hash.match(/^#\/(bar|fanta)\/([a-z-]+)(?:\/([a-z-]+))?(?:\?(.*))?$/);if(!match)return null;
 const [,mode,page,section,query]=match,params=new URLSearchParams(query);
 const route={mode,page,section:section||null,league:params.get('lega'),round:params.get('giornata')};
 if(params.has('competizione'))route.competition=params.get('competizione');
 if(mode==='fanta'&&page==='presidente'&&section==='rose'){
  if(params.get('squadra'))route.rosterTeam=params.get('squadra');
  if(params.get('riepilogo')==='1')route.rosterReview=true;
 }
 return route;
}
export const isSubmissionRoute=route=>!!(route?.league&&route.round&&(route.mode==='bar'?route.page==='schedina':route.mode==='fanta'&&route.page==='squadra'&&route.section==='studio'));
export function appRoute({mode,page,section,league,round,competition,rosterTeam,rosterReview}){if(!modes.has(mode))throw Error('Invalid app mode');const q=new URLSearchParams();if(league)q.set('lega',league);if(round)q.set('giornata',round);if(competition)q.set('competizione',competition);if(mode==='fanta'&&page==='presidente'&&section==='rose'){if(rosterTeam)q.set('squadra',rosterTeam);if(rosterReview)q.set('riepilogo','1');}return '#/'+mode+'/'+page+(section?'/'+section:'')+(q.size?'?'+q:'');}
export const submissionPath=(mode,league,{round,competition}={})=>'/'+appRoute(mode==='bar'?
 {mode,page:'schedina',league,round}:{mode,page:'squadra',section:'studio',league,round,competition});
export function writeAppRoute(route,{replace=false}={}){
 const hash=appRoute(route);
 if(!globalThis.location||!globalThis.history||location.hash===hash)return;
 const previous=replace?history.state?.qdqPreviousRoute:readAppRoute()?location.hash:null;
 history[replace?'replaceState':'pushState']({qdqRoute:true,qdqPreviousRoute:previous},'',location.pathname+location.search+hash);
 globalThis.window?.dispatchEvent?.(new Event('quasi:navigation'));
}
