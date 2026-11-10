import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';

export async function startMemoryGuard(executable=process.env.SELFHOST_MEMORY_GUARD) {
 if(!executable)return;
 // Two Windows jobs, one for the web and one for the worker, share a 4 GiB budget.
 const guard=spawn(executable,[String(process.pid),'1792','2048'],{
  windowsHide:true,stdio:['ignore','pipe','inherit'],
 });
 const output=createInterface({input:guard.stdout});
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>{guard.kill();reject(Error('Memory guard startup timed out'));},5000);
  const ready=line=>{
   clearTimeout(timeout);
   if(line==='READY')resolve();
   else{guard.kill();reject(Error('Unexpected memory guard response'));}
  };
  output.once('line',ready);
  guard.once('error',error=>{clearTimeout(timeout);reject(error);});
  guard.once('exit',code=>{clearTimeout(timeout);reject(Error('Memory guard exited: '+code));});
 });
 guard.once('exit',code=>{
  console.error('QUASI_MEMORY_GUARD_EXIT',code);
  process.exit(75);
 });
 output.close();
 guard.stdout.unref();
 guard.unref();
 console.info('QUASI_MEMORY_GUARD_READY',JSON.stringify({restartMiB:1792,limitMiB:2048}));
}
