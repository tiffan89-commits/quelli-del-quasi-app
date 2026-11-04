// This function is self-contained so Chrome can execute it in the calendar tab.
// It reads rendered DOM only: never cookies, storage, passwords, or network headers.
export function readCalendarDOM(){
 const target=location.pathname.match(/^\/([a-z0-9-]+)\/view\/competition\/(\d+)\/fixtures\/?$/i);
 if(!target)return {error:location.pathname.includes('login')?'login':'page'};
 const cards=[...document.querySelectorAll('view-matchweek-card[id^="matchweek-"]')];
 if(!cards.length)return {pending:true};
 const rounds=[],teamIds={};
 for(const card of cards){
   const heading=card.querySelector('header')?.textContent||'',number=Number(card.id.replace('matchweek-','')),real=heading.match(/(\d+)ª\s*giornata di Serie A/i);
   if(!real)return {error:'format'};
   const matches=[];
   for(const a of card.querySelectorAll('ui-match-row > a')){
     const spans=[...a.children].filter(e=>e.tagName==='SPAN');if(spans.length!==3)return {error:'format'};
     const home=spans[0].textContent.trim(),away=spans[2].textContent.trim();
     const homeId=Number(new URL(a.href).searchParams.get('t'));if(homeId>0)teamIds[home]=homeId;
     const scoreText=spans[1].querySelector('span')?.textContent.trim()||'',parts=scoreText.match(/^(\d+)\s*[-–]\s*(\d+)$/);
     const pts=spans[1].querySelector('small')?.textContent.trim().match(/^([\d.]+)\s*[-–]\s*([\d.]+)$/);
     matches.push({home,away,score:parts?[Number(parts[1]),Number(parts[2])]:null,fantasyPoints:pts?[Number(pts[1]),Number(pts[2])]:null});
   }
   if(matches.length)rounds.push({number,serieARound:Number(real[1]),matches});
 }
 const buttons=[...document.querySelectorAll('button')].map(b=>b.textContent.trim()).filter(s=>/^\d{1,3}$/.test(s)).map(Number).filter(n=>n>=1&&n<=100);
 const total=buttons.length?Math.max(...buttons):Math.max(...rounds.map(r=>r.number));
 const logo=[...document.querySelectorAll('ui-team-logo img[src]')].map(i=>i.src).find(src=>/squadra_\d{4}/.test(src));
 const season=Number(logo?.match(/squadra_(\d{4})/)?.[1]);
 const heading=document.querySelector('ui-league-card[data-competition-id="'+target[2]+'"]');
 return {alias:target[1],competitionId:Number(target[2]),leagueId:Number(heading?.querySelector('h5')?.getAttribute('data-id')),competitionName:heading?.querySelector('small')?.textContent.trim(),rounds,teamIds,total,season,leagueName:heading?.querySelector('h5')?.textContent.trim()||target[1]};
}
