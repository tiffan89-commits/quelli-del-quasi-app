import {shirtBack} from './fanta/maglie-portieri.mjs';
import {rememberEntry,campaignLinks,cleanPreviewUrl} from './acquisition-intent.mjs';
import {recordAnalyticsRequest} from './analytics.mjs';
cleanPreviewUrl(location,history);const query=campaignLinks(location.search);
for(const a of document.querySelectorAll('[data-entry-link]')){
 const target=a.dataset.entryLink;a.href='/'+query+(target==='entra'?'#registrati':target==='demo'?'#demo':'#accedi');
 a.addEventListener('click',()=>{rememberEntry(localStorage);if(target==='entra')recordAnalyticsRequest('/acquisition/start','POST',true,0,200);});
}
const pitch=document.getElementById('acq-pitch');
if(pitch){const rows=[['Il Profeta','Il Cugino'],['Il Mister','Il Quasi','La Talpa','Il Geometra'],['Il Muro','Il Fabbro','Lo Zio','Il Palo'],['Il Guanto']],clubs=['Inter','Roma','Napoli','Juventus','Milan','Fiorentina','Torino'];let i=0;
 for(const row of rows){const el=document.createElement('div');el.className='acq-field-row';for(const name of row){const p=document.createElement('span');p.innerHTML=shirtBack(clubs[i%clubs.length],[9,11,7,10,8,6,2,4,5,3,1][i],name,{goalkeeper:i===10,nameSize:5});el.append(p);i++;}pitch.append(el);}
}
