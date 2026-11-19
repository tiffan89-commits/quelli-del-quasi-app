import {esc} from './fanta/formato.mjs';
const HUB_ICON={gear:'<path d="M10 3h4l.7 2.7 2 .9 2.5-1.3 2 3.4-2 1.8v3l2 1.8-2 3.4-2.5-1.3-2 .9L14 21h-4l-.7-2.7-2-.9-2.5 1.3-2-3.4 2-1.8v-3l-2-1.8 2-3.4 2.5 1.3 2-.9z"/><circle cx="12" cy="12" r="3"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11a3 3 0 1 0 0-6M21 20c0-2.6-1.7-4.8-4-5.6"/>',rules:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>',invite:'<path d="M4 12l16-8-6 16-3-6z"/>',trade:'<path d="M3 8h17m-4-4 4 4-4 4M21 16H4m4-4-4 4 4 4"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>',auction:'<path d="m5 7 5-5 8 8-5 5zM9 11 3 17l4 4 6-6M14 21h7"/>',competition:'<path d="M8 3h8v7a4 4 0 0 1-8 0zM8 5H4v2a4 4 0 0 0 4 4m8-6h4v2a4 4 0 0 1-4 4M12 14v6m-4 1h8"/>'};
Object.assign(HUB_ICON,{
 shield:'<path d="M12 3l8 3v5c0 5-4 8-8 10-4-2-8-5-8-10V6zM9 12l2 2 4-4"/>',
 whatsapp:'<path d="M21 11.5A9 9 0 0 1 7 19l-4 1 1-4a9 9 0 1 1 17-4.5zM9 8l-1 1c0 3 4 7 7 7l1-2-2-1-1 1a8 8 0 0 1-3-3l1-1z"/>',
 inbox:'<path d="M5 4h14l3 11v5H2v-5zM2 15h6l2 2h4l2-2h6M12 7v6m-3-3 3 3 3-3"/>',
 'person-remove':'<circle cx="9" cy="7" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1M16 10h6"/>',
 'person-add':'<circle cx="9" cy="7" r="3"/><path d="M3 19v-1a6 6 0 0 1 12 0v1m1-8h6m-3-3v6"/>',
 expand:'<path d="M9 3H3v6m12-6h6v6M3 15v6h6m12-6v6h-6M8 8l-5-5m13 5 5-5M8 16l-5 5m13-5 5 5"/>',
 play:'<path d="m9 5 11 7-11 7z"/><path d="M4 5v14"/>',
 lineup:'<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M12 4v16M3 8h4v8H3m18-8h-4v8h4"/><circle cx="12" cy="12" r="2"/>',
 link:'<path d="m9 15 6-6m-8 4-2 2a3 3 0 0 0 4 4l2-2m2-10 2-2a3 3 0 0 1 4 4l-2 2"/>',
 search:'<circle cx="10" cy="10" r="6"/><path d="m15 15 5 5"/>',
 trash:'<path d="M4 6h16M9 6V3h6v3m3 0-1 15H7L6 6m4 4v7m4-7v7"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0v5l-2 3h16l-2-3zm-8 12h4"/>'
});
export const hubSymbol=k=>'<svg viewBox="0 0 24 24" aria-hidden="true">'+HUB_ICON[k]+'</svg>';
export const hubIcon=k=>'<span class="lega-tile-icon" aria-hidden="true">'+hubSymbol(k)+'</span>';

export function hubHead(name,subtitle){
 return `<section class="hero lega-hub-head" data-os-header><span class="eyebrow">LA TUA LEGA</span><h1>${esc(name)}</h1><p>${esc(subtitle)}</p></section>`;
}
export function hubTile(icon,title,subtitle,{action='',html='',admin=false,arrow=false,danger=false,badge=true}={}){
 const label=`${hubIcon(icon)}<b>${esc(title)}</b>${subtitle?`<small>${esc(subtitle)}</small>`:''}`;
 return html?`<details class="lega-tile lega-tile-detail"><summary>${label}</summary>${html}</details>`
 :`<button type="button" class="lega-tile${admin?' is-admin':''}${danger?' league-delete-action':''}" ${action}>${label}${badge&&icon==='chat'?'<b class="chat-tile-unread" data-chat-tile-badge hidden></b>':badge&&icon==='trade'?'<b class="chat-tile-unread trade-tile-badge" data-trade-badge hidden></b>':''}${arrow?'<span class="lega-tile-next" aria-hidden="true">›</span>':''}</button>`;
}
