import {esc} from './fanta/formato.mjs';

export function dateTimeFields(name,label,value=''){
 const match=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2})$/.exec(value);
 const date=match?match[3]+'/'+match[2]+'/'+match[1]:'';
 return `<fieldset class="site-datetime" data-site-datetime="${esc(name)}"><legend>${esc(label)}</legend>
  <label>Data<input type="text" data-date-value inputmode="numeric" autocomplete="off" placeholder="gg/mm/aaaa" maxlength="10" value="${date}" required></label>
  <label>Ora<input type="text" data-time-value inputmode="numeric" autocomplete="off" placeholder="hh:mm" maxlength="5" value="${match?.[4]||''}" required></label>
 </fieldset>`;
}

const digits=value=>String(value||'').replace(/\D/g,'');
export function readDateTime(group){
 if(!group)return '';
 const date=digits(group.querySelector('[data-date-value]')?.value),time=digits(group.querySelector('[data-time-value]')?.value);
 if(date.length!==8||time.length!==4)return '';
 const day=+date.slice(0,2),month=+date.slice(2,4),year=+date.slice(4);
 const hour=+time.slice(0,2),minute=+time.slice(2);
 const check=new Date(year,month-1,day,hour,minute);
 if(check.getFullYear()!==year||check.getMonth()!==month-1||check.getDate()!==day||check.getHours()!==hour||check.getMinutes()!==minute)return '';
 return date.slice(4)+'-'+date.slice(2,4)+'-'+date.slice(0,2)+'T'+time.slice(0,2)+':'+time.slice(2);
}
