import {leagueAccent,validLeagueAccent,validEmblem,validMonogram} from '../public/src/league-theme.mjs';
import {fail} from './game.mjs';

export function updateLeagueProfile(league,input){
 const {accent,fantaAccent}=input;
 if(!validLeagueAccent(accent)||(fantaAccent!==undefined&&!validLeagueAccent(fantaAccent)))fail('Colore non valido');
 const emblem=String(input.emblem||'Q').trim().toLocaleUpperCase('it');
 if(!(input.name===undefined?validEmblem(emblem):validMonogram(emblem)))fail('Inserisci una sigla da 1 a 8 caratteri');
 const motto=String(input.motto||'').trim();
 if([...motto].length>100)fail('Il motto può contenere al massimo 100 caratteri');
 if(input.name!==undefined){
  if(typeof input.name!=='string')fail('Nome della lega non valido');
  const name=input.name.normalize().trim().replace(/\s+/g,' ');
  if(!name||[...name].length>80||/\p{Cc}/u.test(name))fail('Inserisci un nome della lega da 1 a 80 caratteri');
  league.name=name;
 }
 const nextFanta=fantaAccent??league.branding?.fantaAccent;
 league.branding={accent,emblem,motto,...(nextFanta?{fantaAccent:nextFanta}:{})};
 return league.branding;
}

export function nativeLeagueBranding(league){
 const {emblem,motto}=league.branding||{};
 return {emblem,motto};
}

export async function updateLinkedLeagueProfile(client,league){
 if(!client||!league.nativeFantaLink?.leagueId)return null;
 const {rows:[link]}=await client.query(`SELECT a.fanta_league_id AS id,NOT EXISTS(
   SELECT 1 FROM fanta.bar_links b WHERE b.fanta_league_id=a.fanta_league_id AND b.active AND b.bar_league_id<>a.bar_league_id
  ) AS exclusive FROM fanta.bar_links a WHERE a.bar_league_id=$1 AND a.active`,[league.id]);
 if(!link)return null;
 if(link.exclusive)await client.query(`UPDATE fanta.leagues SET name=$2,accent=$3,rules=jsonb_set(rules,'{leagueIdentity}',$4::jsonb)
  WHERE id=$1 AND rules->>'disabledAt' IS NULL`,[link.id,league.name,leagueAccent(league,'fanta'),JSON.stringify(nativeLeagueBranding(league))]);
 const removed=new Set(league.removedMembers?.map(m=>m.uid));
 const {rows}=await client.query('SELECT user_id FROM fanta.teams WHERE league_id=$1 AND user_id IS NOT NULL',[link.id]);
 return {id:link.id,coaches:rows.map(row=>row.user_id).filter(uid=>!removed.has(uid))};
}
