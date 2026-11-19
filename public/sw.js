const CACHE = "quellidelquasi-shell-v0.39.1"; // x-release-please-version
const MEDIA_CACHE=CACHE+"-media-v1";
const MEDIA_LIMIT=120;
const mediaPath=/^\/assets\/(?:rooms-v2|optimized|icons|teams)\/.+\.(?:webp|avif|png|jpe?g|svg)$/i;
self.addEventListener("install", (e) =>
  e.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.addAll(["/icon.svg", "/manifest.webmanifest"]))
      .then(() => self.skipWaiting()),
  ),
);
self.addEventListener("activate", (e) =>
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter(k=>k.startsWith("quellidelquasi-")&&k!==CACHE&&k!==MEDIA_CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// Only bundled, same-origin images enter the reusable media cache.
self.addEventListener("fetch",event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin)return;
 if(['/icon.svg','/manifest.webmanifest'].includes(url.pathname)){
  event.respondWith(caches.match(request).then(hit=>hit||fetch(request)));
  return;
 }
 if(request.destination!=='image'||!mediaPath.test(url.pathname))return;
 let saved;
 const result=(async()=>{
  const cache=await caches.open(MEDIA_CACHE).catch(()=>null);
  const hit=await cache?.match(request).catch(()=>null);
  if(hit)return hit;
  const response=await fetch(request);
  if(cache&&response.ok&&!response.redirected&&response.headers.get('content-type')?.startsWith('image/')){
   saved=cache.put(request,response.clone()).then(async()=>{
    const keys=await cache.keys();
    await Promise.all(keys.slice(0,Math.max(0,keys.length-MEDIA_LIMIT)).map(key=>cache.delete(key)));
   }).catch(()=>{});
  }
  return response;
 })();
 event.respondWith(result);
 event.waitUntil(result.then(()=>saved).catch(()=>{}));
});
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data?.json() || {};
  } catch {}
  event.waitUntil(
    self.registration.showNotification(
      String(data.title || "Chiacchiere da bar").slice(0, 100),
      {
        body: String(
          data.body || "Un nuovo messaggio ti aspetta nella lega.",
        ).slice(0, data.kind === "chat" ? 1300 : 200),
        icon: "/assets/icons/icon-192.png",
        badge: "/assets/icons/icon-192.png",
        tag: typeof data.tag === "string" ? data.tag : "quasi-chat",
        data: { league: typeof data.league === "string" ? data.league : null,kind:data.kind==='fanta'?'fanta':data.kind==='slip-reminder'?'slip-reminder':data.kind==='league-access'?'league-access':'chat',url:typeof data.url==='string'&&(data.url.startsWith('/?slip=')||data.url.startsWith('/?mode=fanta'))?data.url:null },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const league = event.notification.data?.league;
  const reminder=event.notification.data?.kind==='slip-reminder';
  const fanta=event.notification.data?.kind==='fanta';
  const access=event.notification.data?.kind==='league-access';
  const url = new URL(
    access?'/?accesso-lega=1':(reminder||fanta)&&event.notification.data?.url?event.notification.data.url:"/" + (league ? "?chat=" + encodeURIComponent(league) : ""),
    self.location.origin,
  ).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      for (const client of windows) {
        if (new URL(client.url).origin === self.location.origin) {
          const path=new URL(client.url).pathname;
          if(path!=="/"&&path!=="/index.html")continue;
          if(!fanta&&!reminder&&league){
            const opened=await client.navigate?.(url).catch(()=>null);
            if(opened){await opened.focus();return;}
          }
          await client.focus();
          client.postMessage({ type: access?'open-league-access':fanta?'open-fanta':reminder?'open-slip':"open-chat", league,url:fanta?url:null,round:reminder?new URL(url).searchParams.get('round'):null });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

