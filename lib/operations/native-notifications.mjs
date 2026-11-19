import {queueFantaNotifications,deliverFantaNotifications} from '../../fanta/notifications.mjs';
import {enqueueOperation} from './store.mjs';
export async function nativeNotifications({connect,env,now=Date.now,queue=true,reminderHours=null,emailOnly=false}={}){
 if(queue)await queueFantaNotifications({connect,now,reminderHours,emailOnly});
 const sent=await deliverFantaNotifications({connect,env,now}),c=await connect();let next;
 try{next=(await c.query('SELECT id,attempts FROM fanta.notifications WHERE delivered_at IS NULL AND attempts<4 AND expires_at>$1 ORDER BY id LIMIT 1',[new Date(now()).toISOString()])).rows[0];}finally{c.release();}
 if(next)await enqueueOperation({id:'native-notify:'+next.id+':'+next.attempts,kind:'native-notify',at:new Date(now()+120000).toISOString()});
 return sent;
}
