import {displayCache} from '../display-cache.mjs';
// Unico punto da cui le schermate del Fanta leggono i dati.
// - createFantaApi(): versione vera, chiama /fanta-api/* (da implementare lato server: vedi docs/FANTA-FRONTEND.md).
// - createDemoFantaApi(): la DEMO del prodotto, con dati finti in memoria. È quella che vede chi non ha
//   accesso al Fanta vero (e chi prova l'app dalla landing senza registrarsi). Non fa chiamate di rete:
//   formazioni, offerte e assegnazioni "funzionano" ma restano solo nel browser e spariscono ricaricando.
import {requestJson} from '../live-channel.mjs';
import {saveOnce} from '../save-guard.mjs';

async function getJson(path,timeoutMs=20000) {
  return requestJson('/fanta-api/'+path,{credentials:'same-origin',headers:{accept:'application/json'},timeoutMs});
}

async function postJson(path, body,timeoutMs=20000) {
  return requestJson('/fanta-api/'+path,{method:'POST',credentials:'same-origin',headers:{accept:'application/json','content-type':'application/json'},body:JSON.stringify(body),timeoutMs});
}

const q = params => new URLSearchParams(params).toString();

export function createFantaApi({userId}={}) {
  let competition=null;
  const cache=new Map(),saved=userId?displayCache('fanta:'+userId):null,pending=saved?.pending||new Map();let generation=0;
  const invalidateReads=()=>{generation++;cache.clear();pending.clear();saved?.clear();};
  const read=input=>{const path=input+(competition?(input.includes('?')?'&':'?')+q({competition}):'');if(path.startsWith('auction'))return getJson(path);const ttl=/^(league\?|leagues$)/.test(path)?300000:60000;const local=saved?.get(path,ttl);if(local)return Promise.resolve(local);const hit=cache.get(path);if(hit&&(!saved||hit.version===saved.generation)&&Date.now()-hit.at<ttl)return Promise.resolve(structuredClone(hit.data));if(pending.has(path))return pending.get(path).then(structuredClone);const version=generation,savedVersion=saved?.generation,job=getJson(path).then(data=>{if(version===generation){cache.set(path,{at:Date.now(),data,version:savedVersion});saved?.set(path,data,savedVersion);while(cache.size>64)cache.delete(cache.keys().next().value);}return data;}).finally(()=>{if(pending.get(path)===job)pending.delete(path);});pending.set(path,job);return job.then(structuredClone);};
  const write=(path,body)=>saveOnce('fanta:'+path+':'+(body?.league||userId||'')+':'+(body?.round||''),async()=>{const data=await postJson(path,{...body,...(competition?{competition}:{})});invalidateReads();return data;});
  return {auctionSocket:globalThis.document?.documentElement?.dataset.netlifyEmergency!=='true',createRandom:options=>write('random/create',options),randomStatus:()=>read('random/status'),claimRandom:league=>write('random/claim',{league}),setSlips:(league,enabled)=>write('league/slips',{league,enabled}),pilotTeams:()=>read('pilot/teams'),pilotClaim:choice=>write('pilot/claim',choice),
    teamChoices:()=>read('team/choices'),claimTeam:(league,team)=>write('team/claim',{league,team}),
    rosterPlayers:league=>read('roster/players?'+q({league})),rosterChange:(league,kind,data)=>write('roster/'+kind,{league,...data}),rosterAudit:league=>read('roster/audit?'+q({league})),
    auctionAssigned:(league,query='')=>read('auction/assigned?'+q({league,q:query})),auctionRelease:(league,playerId,refund)=>write('auction/release',{league,playerId,refund}),auctionReleaseUndo:(league,playerId)=>write('auction/release-undo',{league,playerId}),auctionReleasesDone:league=>write('auction/releases-done',{league}),
    invalidateReads,setCompetition:id=>{competition=id||null;},
    saveLogo:(league,logo)=>write('team/logo',{league,...logo}),
    configureLeague:(league,size)=>write('league/configure',{league,size}),
    createCompetition:(league,options)=>write('competition/create',{league,...options}),
    startCompetition:(league,options)=>write('competition/start',{league,...options}),
    bootstrap:league=>read('bootstrap?'+q({lite:1,...(league?{league}:{})})),
    me: () => read('me'),
    saveSettings: settings => write('settings', settings),
    leagues: () => read('leagues'),
    home: leagueId => read('home?' + q({ league: leagueId })),
    round: (leagueId, number) => read('round?' + q(number == null ? { league: leagueId } : { league: leagueId, number })),
    matchup: (leagueId, number, id) => read('matchup?' + q({ league: leagueId, number, id })),
    team: (leagueId,team) => read('team?' + q({ league: leagueId,...(team?{team}:{}) })),
    saveLineup: (leagueId, round, lineup) => write('lineup', { league: leagueId, round, ...lineup }),
    auction: leagueId => postJson('auction/tick',{league:leagueId,...(competition?{competition}:{})},5000),
    auctionStatus:leagueId=>getJson('auction/status?'+q({league:leagueId}),5000),
    auctionPlayers: leagueId => read('auction/players?' + q({ league: leagueId })),
    bid: (leagueId, lotId, amount) => write('auction/bid', { league: leagueId, lotId, amount }),
    pass: (leagueId, lotId) => write('auction/pass', { league: leagueId, lotId }),
    nominate: (leagueId, playerId, amount) => write('auction/nominate', { league: leagueId, playerId, amount }),
    league: leagueId => read('league?' + q({ league: leagueId })),
    linkTeam: (leagueId,team,username) => write('team/link',{league:leagueId,team,username}),
    // Programmazione dell'asta: solo l'admin
    auctionSchedule: (leagueId, data) => write('auction/schedule', { league: leagueId, ...data }),
    auctionStart: (leagueId,computerTeams) => write('auction/start', { league: leagueId,computerTeams }),
    auctionStartNow:(leagueId,mode='manual',computerTeams,settings={})=>write('auction/start-now',{league:leagueId,mode,computerTeams,...settings}),
    auctionDraw:leagueId=>write('auction/draw',{league:leagueId}),
    auctionClose: leagueId => write('auction/close', { league: leagueId }),
    auctionCancelLot:(leagueId,lotId,playerId)=>write('auction/cancel-lot',{league:leagueId,lotId,playerId}),
    // Asta dal vivo: solo l'admin (banditore)
    auctionMode: (leagueId, mode) => write('auction/mode', { league: leagueId, mode }),
    auctionTable: (leagueId, playerId) => write('auction/table', { league: leagueId, playerId }),
    assign: (leagueId, playerId, teamId, price) => write('auction/assign', { league: leagueId, playerId, teamId, price }),
    undoSale: (leagueId, saleId) => write('auction/undo', { league: leagueId, saleId }),
  };
}

