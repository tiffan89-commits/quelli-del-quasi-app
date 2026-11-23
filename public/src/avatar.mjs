import {BASE_ROOMS,canonicalBaseRoomId,canonicalRoomRewardId} from './locker-rooms.mjs';
import {renderAvatar} from './avatar-renderer.mjs';
import {REWARD_SLOTS,rewardById} from './reward-catalog.mjs';
// Shared by the browser and server. Only these cosmetic values can be stored.
export const AVATAR_OPTIONS = {
  character: { label: 'Personaggio', values: [['neutral','Neutro'],['male','Maschile'],['female','Femminile']] },
  room: {label:'Spogliatoio base',values:BASE_ROOMS.map(r=>[r.id,r.name])},
  body: {label:'Fisico',values:[['slim','Scattante'],['regular','Da campetto'],['athletic','Da spogliatoio'],['stocky','Da terzo tempo']]},
  skin: { label: 'Carnagione', values: [['#f3c8a2','Pesca'],['#dca274','Miele'],['#b77952','Ambra'],['#875539','Bronzo'],['#54382e','Ebano']] },
  hair: { label: 'Capelli', values: [['wave','Ciuffo ribelle'],['short','Corti'],['curly','Ricci'],['long','Lunghi'],['bun','Raccolti'],['bald','Rasati'],['fade','Sfumati'],['side-part','Riga laterale'],['quiff','Ciuffo alto'],['bob','Caschetto'],['pixie','Corti sfilati'],['pony','Coda alta'],['braid','Treccia laterale'],['afro','Afro']] },
  hairColor: { label: 'Colore capelli', values: [['#30251f','Moro'],['#75452d','Castano'],['#ca943e','Biondo'],['#ad5036','Rosso'],['#b7b5a8','Argento'],['#537a8a','Blu']] },
  beard: { label: 'Barba', values: [['none','Viso libero'],['stubble','Corta'],['full','Da capitano'],['moustache','Baffi'],['boxed','Barba squadrata'],['goatee','Pizzetto'],['van-dyke','Baffi e pizzetto'],['handlebar','Baffi a manubrio'],['sideburns','Basette lunghe']] },
  outfit: { label: 'Abbigliamento', values: [['jersey','Maglia da calcio'],['stripes','Maglia a righe'],['jacket','Giacca del mister'],['scarf','Sciarpa da curva'],['pleated-skirt','Gonnellina a pieghe'],['denim-skirt','Gonna di jeans'],['tennis-dress','Vestitino da tennis'],['summer-dress','Abitino estivo'],['wrap-dress','Abito a portafoglio']] },
  color: { label: 'Colore abiti', values: [['#a6d4b4','Menta'],['#d5ad57','Oro'],['#bd514b','Granata'],['#4d78a6','Azzurro'],['#8b6da4','Viola'],['#eee7d0','Panna'],['#ec8758','Arancio'],['#384b45','Bosco']] },
  accessory: { label: 'Portafortuna', values: [['ticket','Schedina'],['ball','Pallone'],['whistle','Fischietto'],['none','Nessuno']] },
};
export const DEFAULT_AVATAR = Object.freeze({room:'base-room-01',rewardRoom:'none',body:'regular',rewardTitle:'none',rewardCharm:'none',rewardOutfit:'none',rewardColor:'none',rewardHat:'none',character:'neutral',skin:'#dca274',hair:'wave',hairColor:'#30251f',beard:'none',outfit:'jersey',color:'#a6d4b4',accessory:'ticket',customOutfitColor:false});
export function normalizeAvatar(value, ownedIds=null) {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};const input={...raw,room:canonicalBaseRoomId(raw.room),rewardRoom:canonicalRoomRewardId(raw.rewardRoom)};if(ownedIds)ownedIds=ownedIds.map(canonicalRoomRewardId);
  const result=Object.fromEntries(Object.entries(AVATAR_OPTIONS).map(([key,option])=>[key,option.values.some(([v])=>v===input[key])?input[key]:DEFAULT_AVATAR[key]]));
  for(const [type,key] of Object.entries(REWARD_SLOTS)){const r=rewardById(input[key]);result[key]=r?.type===type&&(!ownedIds||ownedIds.includes(r.id))?r.id:'none';}
  result.customOutfitColor=raw.customOutfitColor===true;
  return result;
}
export function avatarSvg(value) { return renderAvatar(normalizeAvatar(value)); }
