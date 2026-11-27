import {fail} from './game.mjs';
import {leagueGameSettings} from '../public/src/league-game-access.mjs';
import {barStorageMode} from './storage-mode.mjs';

export const fantaAccessSql=(league,uid)=>`(${league}.rules->>'accessEnabled' IS DISTINCT FROM 'false' OR ${league}.admin_uid=${uid})`;

// Runs inside the Bar membership transaction, with the same lock as slip writes.
export async function updateLeagueGameAccess(client,state,user,{barId,nativeId,key,enabled}){
 if(typeof enabled!=='boolean'||!['barEnabled','fantaEnabled','fantaSlipsEnabled'].includes(key))fail('Impostazione non valida');
 const bar=barId?state.leagues.find(l=>l.id===barId):state.leagues.find(l=>l.nativeFantaLink?.leagueId===nativeId);
 if(barId&&(!bar||bar.admin!==user.id)||key==='barEnabled'&&!barId)fail('Serve il presidente di lega',403);
 const linked=nativeId||bar?.nativeFantaLink?.leagueId;
 let native=null;
 if(key!=='barEnabled'){
  if(!client||!linked)fail('Il Fanta della lega non è attivo',409);
  native=(await client.query(`SELECT l.id,l.admin_uid,l.slips_enabled,l.rules->>'accessEnabled' IS DISTINCT FROM 'false' AS enabled
   FROM fanta.leagues l WHERE l.id=$1 AND l.rules->>'disabledAt' IS NULL
    AND ($2::text IS NULL OR EXISTS(SELECT 1 FROM fanta.bar_links b WHERE b.bar_league_id=$2 AND b.fanta_league_id=l.id AND b.active))
   FOR UPDATE`,[linked,barId||null])).rows[0];
  if(!native||native.admin_uid!==user.id)fail('Serve il presidente Fanta',403);
  if(key==='fantaEnabled'){
   await client.query("UPDATE fanta.leagues SET rules=jsonb_set(rules,'{accessEnabled}',to_jsonb($2::boolean)) WHERE id=$1",[linked,enabled]);
   native.enabled=enabled;
  }else{
   await client.query('UPDATE fanta.leagues SET slips_enabled=$2 WHERE id=$1',[linked,enabled]);
   native.slips_enabled=enabled;
  }
  for(const league of state.leagues.filter(l=>l.nativeFantaLink?.leagueId===linked)){
   league.fantaEnabled=native.enabled;
   league.fantaSlipsEnabled=native.slips_enabled!==false;
   league.fantaAdminUid=native.admin_uid;
  }
 }else bar.barEnabled=enabled;
 // The Bar read cache follows the root transaction revision for both storage modes.
 if(bar&&client&&barStorageMode()==='rows')await client.query('UPDATE public.fanta_state SET payload=payload WHERE id=1');
 const settings=bar?leagueGameSettings(bar):{fantaEnabled:native.enabled,fantaSlipsEnabled:native.slips_enabled!==false};
 const recipients=new Set(state.leagues.filter(l=>l===bar||key!=='barEnabled'&&l.nativeFantaLink?.leagueId===linked).flatMap(l=>l.members.map(m=>m.uid)));
 if(client&&linked&&key!=='barEnabled'){
  const {rows}=await client.query('SELECT user_id FROM fanta.teams WHERE league_id=$1 AND user_id IS NOT NULL',[linked]);
  for(const row of rows)recipients.add(row.user_id);
 }
 const event={league:bar?.id||linked,fantaLeague:linked,change:'game-access',key,enabled};
 return {data:{ok:true,enabled,settings},leagueUpdate:{...event,nativeAdminUid:native?.admin_uid,recipients:[...recipients]}};
}
