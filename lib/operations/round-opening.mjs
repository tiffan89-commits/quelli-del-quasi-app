import {readSerieARoundWindows,serieASubmissionWindow} from '../seriea-round-window.mjs';
import {readOddsSnapshot} from './odds-db.mjs';
import {runOddsOperation} from './odds.mjs';
import {fantaProvider} from '../../fanta/provider.mjs';
import {refreshPlayerAvailability} from '../../fanta/player-availability.mjs';
import {syncStoredSchedule} from './stored-schedule.mjs';

export async function runRoundOpening(job,plan,{env,connect,provider,now,sportsStorage}){
 const season=Number(env.FANTA_SEASON||2026),at=now();
 const c=await connect();
 let windows;
 try{windows=await readSerieARoundWindows(c,{season,rounds:[job.round-1,job.round],sportsStorage});}
 finally{c.release();}
 const window=serieASubmissionWindow(windows,job.round,null,at);
 if(!windows.get(job.round-1)?.complete||!window.open)return {
  ok:window.started,error:'submission-window-not-open',metrics:{scope:'round-opening'},
 };
 const schedule=job.availabilityOnly?null:await syncStoredSchedule({connect,season,now:at,sportsStorage,rounds:[job.round]});
 const odds=job.availabilityOnly?{ok:true}:await runOddsOperation(plan,{env,connect,provider,now,sportsStorage,opening:job});
 const metrics={scope:'round-opening',odds:odds.metrics,schedule:schedule?.metrics,round:job.round};
 if(env.FANTA_ENABLED==='true')try{
  const snapshot=await readOddsSnapshot(job.fixtureIds,{connect,sportsStorage});
  metrics.availability=await refreshPlayerAvailability(snapshot.matches,{
   connect,provider:fantaProvider({env,maxCalls:1}),season,now:at,previousRound:job.round-1,
  });
 }catch(error){return {...odds,ok:false,error:error.code||error.name,metrics};}
 return {...odds,metrics,checkAvailabilityAgain:env.FANTA_ENABLED==='true'};
}
