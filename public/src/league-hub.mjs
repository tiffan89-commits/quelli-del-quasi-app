import {esc} from './fanta/formato.mjs';
const HUB_ICON={gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11a3 3 0 1 0 0-6M21 20c0-2.6-1.7-4.8-4-5.6"/>',rules:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>',invite:'<path d="M4 12l16-8-6 16-3-6z"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',auction:'<path d="m5 7 5-5 8 8-5 5zM9 11 3 17l4 4 6-6M14 21h7"/>',competition:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 14v6m-4 1h8"/>'};
export const hubIcon=k=>'<span class="lega-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+HUB_ICON[k]+'</svg></span>';

export function hubHead(name,subtitle){
 return `<section class="hero lega-hub-head" data-os-header><span class="eyebrow">LA TUA LEGA</span><h1>${esc(name)}</h1><p>${esc(subtitle)}</p></section>`;
}
export function hubTile(icon,title,subtitle,{action='',html='',admin=false,whatsapp='',arrow=false}={}){
 const label=`${hubIcon(icon)}<b>${esc(title)}</b><small>${esc(subtitle)}</small>`;
 if(whatsapp)return `<div class="lega-tile invite-hub-tile"><button type="button" ${action}>${label}</button>${whatsapp}</div>`;
 return html?`<details class="lega-tile lega-tile-detail"><summary>${label}</summary>${html}</details>`
 :`<button type="button" class="lega-tile${admin?' is-admin':''}" ${action}>${label}${arrow?'<span class="lega-tile-next" aria-hidden="true">›</span>':''}</button>`;
}
