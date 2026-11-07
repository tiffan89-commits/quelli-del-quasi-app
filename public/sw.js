const CACHE = "quellidelquasi-shell-v0.31.3"; // x-release-please-version
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
          keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
// Game state, authentication, and slips always require the server. Never cache API responses.
self.addEventListener("fetch", (e) => {
  if (new URL(e.request.url).pathname.startsWith("/api/")) return;
  if (
    ["/icon.svg", "/manifest.webmanifest"].includes(
      new URL(e.request.url).pathname,
    )
  )
    e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
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
        ).slice(0, 200),
        icon: "/assets/icons/icon-192.png",
        badge: "/assets/icons/icon-192.png",
        tag: typeof data.tag === "string" ? data.tag : "quasi-chat",
        data: { league: typeof data.league === "string" ? data.league : null,kind:data.kind==='fanta'?'fanta':data.kind==='slip-reminder'?'slip-reminder':'chat',url:typeof data.url==='string'&&(data.url.startsWith('/?slip=')||data.url.startsWith('/?mode=fanta'))?data.url:null },
      },
    ),
  );
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const league = event.notification.data?.league;
  const reminder=event.notification.data?.kind==='slip-reminder';
  const fanta=event.notification.data?.kind==='fanta';
  const url = new URL(
    (reminder||fanta)&&event.notification.data?.url?event.notification.data.url:"/" + (league ? "?chat=" + encodeURIComponent(league) : ""),
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
          await client.focus();
          client.postMessage({ type: fanta?'open-fanta':reminder?'open-slip':"open-chat", league,url:fanta?url:null,round:reminder?new URL(url).searchParams.get('round'):null });
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});

