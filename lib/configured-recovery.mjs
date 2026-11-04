import {transaction} from './db.mjs';import {inviteLegacyRecovery} from './account.mjs';import {deliverPendingMail} from './mail-delivery.mjs';
// No public route. A deploy-scoped secret config authorizes one specific operation.
export async function runConfiguredRecovery(env=process.env){
 if(!env.LEGACY_RECOVERY_CONFIG)return;let cfg;try{cfg=JSON.parse(env.LEGACY_RECOVERY_CONFIG)}catch{console.info('LEGACY_RECOVERY_INVALID_CONFIG');return}
 try{const op=await transaction(s=>inviteLegacyRecovery(s,cfg,env));if(op.status==='accepted'||op.completedAt)return;await deliverPendingMail({jobId:op.mailId});const status=await transaction(s=>{const current=s.legacyRecoveryOperations[cfg.operation],log=s.mailDeliveryLog?.findLast(x=>x.jobId===current.mailId);if(log?.result==='accepted')current.status='accepted';else if(log?.error)current.deliveryError=log.error;return current.status});console.info('LEGACY_RECOVERY_STATUS',status)}catch(e){console.info('LEGACY_RECOVERY_FAILED',e.status||500,e.status?e.message:'storage or transport failure')}
}
