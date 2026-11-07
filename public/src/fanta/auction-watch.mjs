// Lightweight room discovery; never downloads rosters, votes or the player catalog.
export function auctionClockOffset(serverTime,startedAt,receivedAt=Date.now()){
 const server=Date.parse(serverTime),start=Number.isFinite(startedAt)?startedAt:receivedAt;
 return Number.isFinite(server)&&Number.isFinite(receivedAt)&&start<=receivedAt?server-(start+receivedAt)/2:0;
}
export function watchAuction({read,context,onRunning,onStatus=()=>{},setTimer=setInterval,clearTimer=clearInterval}){
 let disposed=false,busy=false,lastLeague=null,lastVersion=null;
 async function check(){
  const before=context();if(disposed||busy||!before.active||!before.league)return;
  busy=true;
  try{
   const data=await read(before.league),after=context();
   if(disposed||!after.active||after.league!==before.league)return;
   if(lastLeague!==before.league){lastLeague=before.league;lastVersion=null;}
   const key=data.status+':'+data.version;
   if(key!==lastVersion){lastVersion=key;onStatus(data);}
   if(data.status==='running')onRunning?.(data);
   else if(data.status==='scheduled'&&Date.parse(data.startsAt)<=Date.now())onRunning?.({...data,due:true});
  }catch{}finally{busy=false;}
 }
 const timer=setTimer(check,1000);void check();
 return {check,stop(){disposed=true;clearTimer(timer);}};
}
