import {createHash} from 'node:crypto';
import {publicStore,operationalStore} from '../../lib/operations/store.mjs';
import {publicWindow} from '../../lib/operations/calendar.mjs';
export function createPublicFootball({scores=publicStore,calendar=operationalStore}={}){return async req=>{
 if(req.method!=='GET')return new Response(null,{status:405});
 try{
  const [data,plan]=await Promise.all([scores().get('scores',{type:'json'}),calendar().get('calendar',{type:'json'})]);
  const body=JSON.stringify({matches:data?.matches||[],revision:data?.revision||null,window:plan?publicWindow(plan):{liveIds:[],nextKickoff:null}}),etag='"'+createHash('sha256').update(body).digest('hex')+'"';
  const headers={'Content-Type':'application/json','Cache-Control':'public, max-age=5, must-revalidate','Netlify-CDN-Cache-Control':'public, durable, s-maxage=15','ETag':etag,'X-Content-Type-Options':'nosniff'};
  return new Response(req.headers.get('if-none-match')===etag?null:body,{status:req.headers.get('if-none-match')===etag?304:200,headers});
 }catch{return Response.json({error:'Risultati temporaneamente non disponibili'},{status:503});}
};
}
export default createPublicFootball();
