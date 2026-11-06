import {createHash} from 'node:crypto';
const clubs=['Hellas','Atletico','Real','Dinamo','Virtus','Sporting','Inter','Stella','Deportivo','Borussia','Lokomotiv','Racing','Union','Olympique','Bayern','Fortitudo','Audace','Pro','Polisportiva','Olimpia','Quasi','AC','FC','AS'];
const bar=['Madonna','Poco','Boh','Sbaglio','Spritz','Grappa','Birra','Gassosa','Frittata','Tapparella','Sgabello','Divano','Ciabatta','Scusa','Recupero','Palo','Brodo','Sonno','Dopocena','Patatrac','Sbronzi','Distratti','Scarsi','Stanchi','Panchina','Rinvio','Tramezzino','Bocciofila','Oste','Retropassaggio','Ginocchio','Caviglia','Sottobicchiere','Biscotto','Calzino','Rutto','Sugo','Supplì','Polpetta','Tovagliolo','Pressing','Nebbia','Sagra','Canotto','Birillo','Catenaccio','Fiasco','Ciuccio','Spreco','Nulla','Mai','Forse','Domani','Tardi','Beffa','Ansia','Flemma','Briciole','Sgabuzzino','Fuffa','Spigolo','Pigrizia','Sbagliati','Fritto','Fischietto','Sbadiglio','Mestolo','Tombino','Cartellino','Bancone','Rigore','Caffè','Tacco','Tritolo','Sgarro','Fischi','Tegola','Triplo','Sconto','Rimessa'];
const extra=['Poco Convinti','Ultimo Goccio','Panchina Corta','Talento Incompreso','Mezzala Stanca','Spritz Sbagliato','VAR Spento','Mister Assente','Fuorigioco Emotivo'];
const key=s=>String(s).normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export function funnyTeamNames(count,{seed='',used=[]}={}){
 if(!Number.isInteger(count)||count<1||count>20)throw Error('Numero di nomi non valido');
 const taken=new Set(used.map(key)),rank=s=>createHash('sha256').update(seed+':'+s).digest('hex'),candidates=[...clubs.flatMap(a=>bar.map(b=>a+' '+b)),...clubs.flatMap(a=>extra.map(b=>a+' '+b))].filter(n=>!taken.has(key(n))).map(name=>({name,words:name.split(' ').length,rank:rank(name)})).sort((a,b)=>a.words-b.words||a.rank.localeCompare(b.rank)).map(x=>x.name),result=[];
 for(const name of candidates){const id=key(name);if(taken.has(id))continue;taken.add(id);result.push(name);if(result.length===count)return result;}
 throw Error('Catalogo nomi del bar esaurito');
}
export async function availableTeamNames(c,count,seed){const used=(await c.query('SELECT name FROM fanta.teams')).rows.map(t=>t.name);return funnyTeamNames(count,{seed,used});}
