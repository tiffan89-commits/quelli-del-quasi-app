(() => {
 const channel=document.querySelector('meta[name="qdq-release-channel"]')?.content;
 if(!channel||!document.body)return;
 let checking=false;
 const check=async()=>{
  if(checking)return;
  checking=true;
  try{
   const response=await fetch('/_friends/channel',{cache:'no-store',credentials:'same-origin'});
   if(!response.ok)return;
   const next=await response.json();
   if(['stable','friends'].includes(next.channel)&&next.channel!==channel)location.reload();
  }catch{}finally{checking=false;}
 };
 const state=()=>{
  let signedIn=false;
  try{signedIn=localStorage.getItem('qdq:hasSession')==='1';}catch{}
  return {signedIn,auth:document.body.classList.contains('public-area')};
 };
 let previous=state();
 new MutationObserver(()=>{
  const current=state();
  if(current.signedIn!==previous.signedIn||previous.auth&&!current.auth)void check();
  previous=current;
 }).observe(document.body,{attributes:true,attributeFilter:['class']});
 window.addEventListener('storage',event=>{if(event.key==='qdq:hasSession')void check();});
 window.addEventListener('pageshow',event=>{if(event.persisted)void check();});
 if(previous.signedIn&&document.referrer&&new URL(document.referrer).origin!==location.origin)void check();
 document.addEventListener('visibilitychange',()=>{
  if(channel==='friends'&&document.visibilityState==='visible')void check();
 });
})();
