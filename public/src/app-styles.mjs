const sheets=['experience.css','dashboard.css','styled-select.css','progression.css','quasi-studio.css','mobile-sections.css','league-settings.css','lineup-pitch.css','password-toggle.css','action-feedback.css','v2.css','bar-slips.css','fanta.css','fanta-integrations.css','chat.css','studio-formazione.css','ux-review.css','ux-spacing.css','auction-room.css','one-screen.css','one-screen-ui.css','home-social.css'];
let ready;
export function loadAppStyles(){
 if(ready)return ready;const bundled=document.querySelector('meta[name="qdq-app-css"]')?.content;
 ready=Promise.all((bundled?[bundled]:sheets).map(file=>new Promise(resolve=>{let link=document.querySelector('link[data-app-sheet="'+file+'"]');if(link?.sheet){resolve();return;}if(!link){link=document.createElement('link');link.rel='stylesheet';link.href=file.startsWith('/')?file:'/'+file;link.dataset.appSheet=file;}link.addEventListener('load',resolve,{once:true});link.addEventListener('error',resolve,{once:true});if(!link.isConnected)document.head.append(link);})));return ready;
}
