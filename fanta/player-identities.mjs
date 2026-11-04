// User-verified API identities. Scope matters: aliases never resolve a namesake in another league/team.
export const IDENTITY_SOURCE='lucas-bar:548867';
export const VERIFIED_IDENTITIES=[
 {team:'Grappa e vinci',name:'Oulai',apiName:'Christ Inao Oulaï',apiId:474591,aliases:['Oulaï','Christ Inao Oulai']},
 {team:'Bellaleo',name:'Ederson D.S.',apiName:'Éderson',apiId:10097,aliases:['Ederson','Éderson','Ederson D.S.']},
 {team:'Hellas Madonna',name:'Goncalves P.',apiName:'Pedro António Pereira Gonçalves',apiId:18748,aliases:['Pote','Pedro Gonçalves','Pedro Goncalves','Pedro António Pereira Gonçalves']},
 {team:'Hellas Madonna',name:'Yildiz',apiName:'Kenan Yıldız',apiId:339883,apiClubId:496,club:'Juventus',aliases:['Kenan Yildiz','Kenan Yıldız']},
 {team:'fc 41-bis',name:'Valdepenas',apiName:'Víctor Valdepeñas Talavera',apiId:490779,aliases:['Valde','Víctor Valdepeñas','Victor Valdepenas','Víctor Valdepeñas Talavera']},
 {team:'SamBuca Juniors',name:'Vitinha O.',apiName:'Vítor Manuel Carvalho Oliveira',apiId:281408,aliases:['Vitinha','Vitinha O.','Vitor Oliveira','Vítor Manuel Carvalho Oliveira']},
 {team:'LA MOLLEGGIATA',name:'Hojlund',apiName:'Rasmus Højlund',apiId:288006,aliases:['Rasmus Hojlund','Rasmus Højlund']},
 {team:'LA MOLLEGGIATA',name:'Esposito F.P.',apiName:'Francesco Pio Esposito',apiId:345808,aliases:['Francesco Pio','Francesco Pio Esposito','F. P. Esposito']},
 {team:'preti gay',name:'Ostigard',apiName:'Leo Østigård',apiId:18967,aliases:['Leo Ostigard','Leo Østigård']},
 {team:'Don Falcone',name:'Ramon',apiName:'Jacobo Ramón Naveros',apiId:386305,aliases:['Jacobo Ramon','Jacobo Ramón','Jacobo Ramón Naveros']},
 {team:'Fly Emigrates',name:'Gudmundsson A.',apiName:'Albert Guðmundsson',apiId:2799,aliases:['Albert Gudmundsson','Albert Guðmundsson']},
];
export const normalizePersonName=value=>String(value||'').toLowerCase().replace(/[øØ]/g,'o').replace(/ı/g,'i').replace(/ð/g,'d').replace(/þ/g,'th').replace(/ł/g,'l').replace(/æ/g,'ae').replace(/œ/g,'oe').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export const identityKey=value=>normalizePersonName(value).replace(/ /g,'');
export function selectIdentityEntry(spec,entries){return entries.filter(e=>identityKey(e.team)===identityKey(spec.team)&&[e.name,e.data?.originalName].some(n=>[spec.name,spec.apiName,...spec.aliases].some(a=>identityKey(a)===identityKey(n))));}
export function persistentIdentity(source,bindings,players){
 const matches=bindings.filter(b=>b.source_key===source.id||(b.evidence?.sourceIds||[]).includes(source.id)||[b.imported_name,...(b.aliases||[])].some(n=>identityKey(n)===identityKey(source.name)));
 const ids=[...new Set(matches.map(b=>b.player_id))];return ids.length===1?players.find(p=>p.id===ids[0])||null:null;
}
// Resolve old imported IDs in memory, retaining every original lineup row.
export function resolveLeagueBindings(state){
 for(const lineup of state.lineups||[]){const bindings=(state.bindings||[]).filter(b=>b.team_id===lineup.team_id),mapping=new Map(bindings.flatMap(b=>[b.source_key,...(b.evidence?.sourceIds||[])].map(id=>[id,b.player_id])));
  const players=(lineup.source_data?.players||[]).map(p=>{const target=persistentIdentity(p,bindings,state.players);if(!target)return p;mapping.set(p.id,target.id);return {...p,id:target.id,clubId:target.clubId,unmapped:false};});
  lineup.starters=lineup.starters.map(id=>mapping.get(id)||id);lineup.bench=lineup.bench.map(id=>mapping.get(id)||id);if(players.length)lineup.source_data={...lineup.source_data,players};
 }return state;
}
