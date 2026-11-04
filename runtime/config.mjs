export function configure(env=process.env){
 const origin=new URL(env.PUBLIC_ORIGIN||'http://127.0.0.1:3000');
 if(!['http:','https:'].includes(origin.protocol)||origin.username||origin.password||origin.pathname!=='/'||origin.search||origin.hash)throw Error('PUBLIC_ORIGIN deve contenere solo origine e porta');
 if(origin.protocol!=='https:'&&!['127.0.0.1','localhost','[::1]'].includes(origin.hostname))throw Error('HTTPS necessario per un server pubblico');
 env.PUBLIC_ORIGIN=origin.origin;env.URL=origin.origin;env.DEPLOY_PRIME_URL=origin.origin;env.APP_BASE_URL=origin.origin;
 env.CONTEXT||='production';return origin;
}
