import {schedulesEnabled} from '../../lib/release-env.mjs';
import {runFootballFullRefresh,validFootballRefreshTicket} from '../../lib/api-football-refresh.mjs';
export default async request=>{
  if(!schedulesEnabled()||request.method!=='POST'||!validFootballRefreshTicket(request.headers.get('X-Quasi-Football')||''))return;
  try{console.info('API_FOOTBALL_FULL_COMPLETE',JSON.stringify(await runFootballFullRefresh()));}
  catch{console.error('API_FOOTBALL_FULL_STORAGE_FAILURE');}
};
