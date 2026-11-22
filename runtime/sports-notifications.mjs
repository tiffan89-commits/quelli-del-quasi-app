import {connection,notificationConnection} from '../lib/db.mjs';

// PostgreSQL delivers only after the producer's committed writes. One listener
// wakes the shared Socket.IO rooms, regardless of the number of devices.
export async function notifySportsSaved({connect=connection,lineups,barOnly=false}={}){
 const payload=lineups?.length?JSON.stringify(lineups):barOnly?'refresh-bar':'refresh';
 const c=await connect();try{await c.query("SELECT pg_notify('quasi_sports_saved',$1)",[payload]);}finally{c.release();}
}
export function listenSportsSaved(refresh,{lineupsSaved,connect=notificationConnection,retryMs=5000}={}){
 let stopped=false,client,timer,connecting=false;
 async function start(){
  if(stopped||connecting)return;connecting=true;
  try{const c=await connect();if(stopped){c.release();return;}client=c;
   const lost=()=>{if(client!==c)return;client=null;c.removeAllListeners('notification');c.release(true);if(!stopped){timer=setTimeout(()=>void start(),retryMs);timer.unref?.();}};
   c.on('error',lost);c.on('end',lost);c.on('notification',n=>{
    if(n.channel!=='quasi_sports_saved')return;
    if(n.payload==='refresh-bar'){void refresh('bar');return;}
    if(n.payload==='refresh'||!lineupsSaved){void refresh();return;}
    let lineups;try{lineups=JSON.parse(n.payload);}catch{return;}
    if(Array.isArray(lineups))lineupsSaved(lineups);
   });
   await c.query('LISTEN quasi_sports_saved');
  }catch{if(client){const c=client;client=null;c.release(true);}if(!stopped){timer=setTimeout(()=>void start(),retryMs);timer.unref?.();}}
  finally{connecting=false;}
 }
 void start();return {async close(){stopped=true;clearTimeout(timer);const c=client;client=null;if(c){c.removeAllListeners('notification');try{await c.query('UNLISTEN quasi_sports_saved');}finally{c.release();}}}};
}
