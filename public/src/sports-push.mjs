import {createLiveChannel,requestJson} from './live-channel.mjs';
let scriptPromise;
export function loadSportsClient(){if(typeof window.io==='function')return Promise.resolve(window.io);if(!scriptPromise)scriptPromise=new Promise((resolve,reject)=>{const script=document.createElement('script'),timer=setTimeout(()=>{script.remove();reject(Error('Socket.IO non disponibile'));},8000);script.src='/socket.io/socket.io.js';script.async=true;script.onload=()=>{clearTimeout(timer);typeof window.io==='function'?resolve(window.io):reject(Error('Socket.IO non disponibile'));};script.onerror=()=>{clearTimeout(timer);script.remove();reject(Error('Socket.IO non disponibile'));};document.head.append(script);}).catch(e=>{scriptPromise=null;throw e;});return scriptPromise;}
// The standalone server uses push only. The explicitly marked emergency Netlify build reads our DB every minute.
export function createSportsPush({context,apply,applyLineups=()=>{},status=()=>{},factory=loadSportsClient,doc=globalThis.document,win=globalThis.window,setTimer=setInterval,clearTimer=clearInterval}={}){
 if(doc?.documentElement?.dataset?.netlifyEmergency==='true')return emergencySportsChannel({context,apply,status,doc,win});
 let socket=null,key=null,starting=false,stopped=true,last=null,retryAt=0,generation=0;
 function disconnect(){generation++;socket?.removeAllListeners();socket?.disconnect();socket=null;key=null;last=null;}
 async function wake(){if(stopped)return;const c=!doc?.hidden&&context(),next=c?JSON.stringify(c):null;if(!next){if(socket)disconnect();return;}if(key===next&&socket)return;if(starting||Date.now()<retryAt)return;disconnect();starting=true;const version=generation;
  try{const io=await factory();if(stopped||version!==generation||JSON.stringify(context())!==next)return;key=next;const current=socket=io('/sports',{path:'/socket.io',transports:['websocket'],auth:c,withCredentials:true,reconnection:true,reconnectionDelay:500,reconnectionDelayMax:10000,timeout:8000,forceNew:true});
   current.on('sports:update',m=>{if(stopped||socket!==current||JSON.stringify(context())!==key||JSON.stringify(m.context)!==key||m.revision===last)return;try{apply(m.data);last=m.revision;status({state:'ready',at:m.at});}catch(error){status({state:'error',error});}});current.on('sports:lineup-saved',lineups=>{if(!stopped&&socket===current&&JSON.stringify(context())===key)applyLineups(lineups);});current.on('disconnect',()=>status({state:'error'}));current.on('connect_error',()=>status({state:'error'}));current.on('sports:unavailable',()=>status({state:'error'}));
  }catch(error){retryAt=Date.now()+15000;status({state:'error',error});}finally{starting=false;}
 }
 async function requestLineup(id,revision){
  const current=socket,requestedContext=key;
  if(stopped||!current?.connected||JSON.stringify(context())!==requestedContext)return null;
  const lineup=await current.timeout(8000).emitWithAck('sports:lineup',{id,revision});
  return !stopped&&socket===current&&JSON.stringify(context())===requestedContext?lineup:null;
 }
 let timer;return {start(){if(!stopped)return;stopped=false;doc?.addEventListener('visibilitychange',wake);win?.addEventListener('online',wake);timer=setTimer(wake,1000);void wake();},wake,requestLineup,stop(){stopped=true;clearTimer(timer);doc?.removeEventListener('visibilitychange',wake);win?.removeEventListener('online',wake);disconnect();}};
}

export function emergencySportsChannel({context,apply,status,doc,win,request=requestJson,setTimer,clearTimer}={}){
 return createLiveChannel({key:()=>{const c=context();return c?JSON.stringify(c):null;},apply,status,document:doc,window:win,intervalMs:60000,...(setTimer?{setTimer,clearTimer}:{}),request:async({key,signal})=>{
  const c=JSON.parse(key),options={credentials:'same-origin',signal};
  if(c.mode==='bar')return {data:await request('/api/live?'+new URLSearchParams({league:c.league}),options)};
  const params={league:c.league,number:c.round,...(c.competition?{competition:c.competition}:{})};
  const [round,matchup]=await Promise.all([request('/fanta-api/round?'+new URLSearchParams(params),options),request('/fanta-api/matchup?'+new URLSearchParams({...params,id:c.matchup}),options)]);return {data:{round,matchup}};
 }});
}
