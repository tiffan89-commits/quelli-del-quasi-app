import {createHash} from 'node:crypto';
const clubs=['Hellas','Atletico','Real','Dinamo','Virtus','Sporting','Inter','Stella','Deportivo','Borussia','Lokomotiv','Racing','Union','Olympique','Bayern','Fortitudo','Audace','Pro','Polisportiva','Olimpia','Quasi','AC','FC','AS'];
const bar=['Madonna','Poco','Boh','Sbaglio','Spritz','Grappa','Birra','Gassosa','Frittata','Tapparella','Sgabello','Divano','Ciabatta','Scusa','Recupero','Palo','Brodo','Sonno','Dopocena','Patatrac','Sbronzi','Distratti','Scarsi','Stanchi','Panchina','Rinvio','Tramezzino','Bocciofila','Oste','Retropassaggio','Ginocchio','Caviglia','Sottobicchiere','Biscotto','Calzino','Rutto','Sugo','Supplì','Polpetta','Tovagliolo','Pressing','Nebbia','Sagra','Canotto','Birillo','Catenaccio','Fiasco','Ciuccio','Spreco','Nulla','Mai','Forse','Domani','Tardi','Beffa','Ansia','Flemma','Briciole','Sgabuzzino','Fuffa','Spigolo','Pigrizia','Sbagliati','Fritto','Fischietto','Sbadiglio','Mestolo','Tombino','Cartellino','Bancone','Rigore','Caffè','Tacco','Tritolo','Sgarro','Fischi','Tegola','Triplo','Sconto','Rimessa'];
const signatureNames=[
 'Atletico Poco','Hellas Madonna','Real Divano','Dinamo Sbadiglio','Virtus Frittata',
 'Sporting Sgabello','Inter Pelli','Stella Storta','Deportivo Tapparella','Borussia Brodo',
 'Lokomotiv Ferma','Racing Rallentato','Union Posticipo','Olympique Mestolo','Bayern Scontrino',
 'Fortitudo Ciabatta','Audace Panchina','Pro Pareggio','Polisportiva Flemma','Olimpia Sottobicchiere',
 'Quasi Campioni','AC Picchia','FC Dimenticati','AS Sonnolenza','Panchina Lunga',
 'Nebbia Padana','Rigore Sbagliato','Fuorigioco Emotivo','Mezzala Stanca','Mister Assente',
 'Spritz Sbagliato','Bocciofila United','Tramezzino City','Dopocena United','VAR Spento',
 'Tattica Spicciola','Modulo Casuale','Pressing Timido','Rimessa Sbagliata','Calzino Bucato',
 'Palleggio Incerto','Contropiede Lento','Goleada Immaginaria','Talento Incompreso','Traversa Fissa',
];
const generatedNames=clubs.flatMap(club=>bar.map(word=>`${club} ${word}`));
export const teamNameKey=s=>String(s).normalize('NFKD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
export function funnyTeamNames(count,{seed='',used=[]}={}){
 if(!Number.isInteger(count)||count<1||count>20)throw Error('Numero di nomi non valido');
 const taken=new Set(used.map(teamNameKey)),result=[];
 for(const pool of [signatureNames,generatedNames]){
  const candidates=pool.filter(name=>!taken.has(teamNameKey(name))).map(name=>({name,rank:createHash('sha256').update(`${seed}:${name}`).digest('hex')})).sort((a,b)=>a.rank.localeCompare(b.rank));
  for(const {name} of candidates){const id=teamNameKey(name);if(taken.has(id))continue;taken.add(id);result.push(name);if(result.length===count)return result;}
 }
 throw Error('Catalogo nomi del bar esaurito');
}
export async function availableTeamNames(c,count,seed){const used=(await c.query('SELECT name FROM fanta.teams')).rows.map(t=>t.name);return funnyTeamNames(count,{seed,used});}
