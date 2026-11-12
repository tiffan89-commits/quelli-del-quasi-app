import {operationalStore} from '../lib/operations/store.mjs';
import {isProduction} from '../lib/release-env.mjs';
let cached=null,loaded=0,pending=null;
async function readPlan(){if(!isProduction())return null;if(cached&&Date.now()-loaded<60000)return cached;if(pending)return pending;pending=operationalStore().get('calendar',{type:'json'}).then(p=>{cached=p;loaded=Date.now();return p;}).finally(()=>{pending=null;});return pending;}
export function finalVerification(plan,round,now=Date.now()){
 const jobs=(plan?.jobs||[]).filter(j=>['morning','round-close'].includes(j.kind)&&Number(j.round)===Number(round)&&['queued','running'].includes(j.status));
 const running=jobs.find(j=>j.status==='running');if(running)return {status:'running',at:running.executionStartedAt||running.at};
 const job=jobs.sort((a,b)=>Date.parse(a.at)-Date.parse(b.at))[0];return job?{status:'queued',at:job.at}:null;
}
export async function withFinalVerification(home,{now=Date.now(),getPlan=readPlan}={}){
 if(!home||home.round?.state!=='in-corso')return home;
 try{return {...home,finalVerification:finalVerification(await getPlan(),home.round.serieARound,now)};}catch{return {...home,finalVerification:null};}
}
