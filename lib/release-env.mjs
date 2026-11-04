import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
let generated={};try{generated=JSON.parse(readFileSync(resolve(process.cwd(),'lib/release-context.json'),'utf8'));}catch{}
// Only non-secret build context is stored in the generated file.
export function appEnv(env=process.env){
 const context=env.CONTEXT??process.env.CONTEXT??generated.context;
 const branch=env.BRANCH??process.env.BRANCH??generated.branch;
 return context==='production'?'production':context==='branch-deploy'&&branch==='staging'?'staging':'preview';
}
export const isProduction=(env=process.env)=>appEnv(env)==='production';
export const schedulesEnabled=(env=process.env)=>isProduction(env)||env.STAGING_ENABLE_SCHEDULES==='1';
export function recipientAllowed(email,env=process.env){
 if(isProduction(env))return true;
 const value=String(email||'').trim().toLowerCase();
 return /^[^\s<>@,]+@[^\s<>@,]+$/.test(value)&&String(env.STAGING_EMAIL_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).includes(value);
}
export function blockedDelivery(channel,env=process.env){console.info(JSON.stringify({event:'NONPRODUCTION_DELIVERY_BLOCKED',channel,environment:appEnv(env)}));}
export function filterMailRecipients(message,env=process.env){
 if(isProduction(env))return message;
 const filtered={...message};let count=0;
 for(const field of ['to','cc','bcc']){if(message[field]==null)continue;const input=Array.isArray(message[field])?message[field]:String(message[field]).split(',');filtered[field]=input.filter(email=>{if(recipientAllowed(email,env)){count++;return true;}blockedDelivery('email',env);return false;});if(!filtered[field].length)delete filtered[field];}
 return count?filtered:null;
}
