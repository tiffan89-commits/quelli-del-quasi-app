const KEY='qdq:entry-intent:v1',AGE=7*86400000;
export function rememberEntry(storage,now=Date.now()){try{storage.setItem(KEY,JSON.stringify({target:'fanta',at:now}));}catch{}}
export function entryIntent(storage,now=Date.now()){try{const v=JSON.parse(storage.getItem(KEY));return v?.target==='fanta'&&v.at<=now&&now-v.at<AGE;}catch{return false;}}
export function clearEntry(storage){try{storage.removeItem(KEY);}catch{}}
export function cleanPreviewUrl(location,history){try{if(!['casa.quellidelquasi.com','127.0.0.1','localhost'].includes(location.hostname))return;const url=new URL(location.href);if(!url.searchParams.has('key')&&!url.searchParams.has('next'))return;url.searchParams.delete('key');url.searchParams.delete('next');history.replaceState(null,'',url.pathname+url.search+url.hash);}catch{}}
export function campaignLinks(search=''){
 const result=new URLSearchParams({entry:'fanta'}),params=new URLSearchParams(search);
 for(const key of ['utm_source','utm_medium','utm_campaign','utm_content']){const v=params.get(key);if(v&&/^[a-zA-Z0-9_-]{1,80}$/.test(v))result.set(key,v);}
 return '?'+result;
}
