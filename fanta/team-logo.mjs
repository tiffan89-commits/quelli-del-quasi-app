import {createHash} from 'node:crypto';
import {normalizeLogo} from '../public/src/fanta/team-logo.mjs';
import {imageDimensions,optimizeImage} from '../lib/image-optimize.mjs';
import {fail} from './rules.mjs';
export const MAX_LOGO_BYTES=250*1024;
export async function saveTeamLogo(c,team,input,league){
 let branding;
 if(input.type==='image'){
  if(typeof input.image!=='string'||input.image.length>Math.ceil(MAX_LOGO_BYTES*4/3)+100)fail('Il logo non può superare 250 KB',413);
  const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(input.image);if(!match)fail('Scegli un’immagine PNG, JPG o WebP');
  const bytes=Buffer.from(match[2],'base64');if(!bytes.length||bytes.length>MAX_LOGO_BYTES)fail('Il logo non può superare 250 KB',413);
  let optimized;try{const [w,h]=imageDimensions(bytes,match[1]);if(!w||!h||w>4096||h>4096||w*h>8000000)fail('Dimensioni dell’immagine eccessive');optimized=await optimizeImage(bytes,match[1],{maxWidth:512,maxHeight:512,quality:88});}catch(e){if(e.status)throw e;fail('Immagine non leggibile. Prova un altro file.');}
  const digest=optimized.digest;await c.query('INSERT INTO fanta.team_logos(team_id,data,mime,digest) VALUES($1,$2,$3,$4) ON CONFLICT(team_id) DO UPDATE SET data=EXCLUDED.data,mime=EXCLUDED.mime,digest=EXCLUDED.digest',[team.id,optimized.data,optimized.mime,digest]);
  branding={type:'image',revision:digest,imageUrl:'/fanta-api/team/logo/image?'+new URLSearchParams({league,team:team.id,v:digest})};
 }else if(input.type==='design'){
  const design=normalizeLogo(input.design,team.name);branding={type:'design',design,revision:createHash('sha256').update(JSON.stringify(design)).digest('hex')};await c.query('DELETE FROM fanta.team_logos WHERE team_id=$1',[team.id]);
 }else fail('Tipo di logo non valido');
 await c.query('UPDATE fanta.teams SET branding=$2 WHERE id=$1',[team.id,JSON.stringify(branding)]);return branding;
}
