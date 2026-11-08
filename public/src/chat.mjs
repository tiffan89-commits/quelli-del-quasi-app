import {pushSupported,enableLeagueNotifications} from './notifications.mjs';
const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let stop = () => {}, reload = () => {};
export function refreshChat(){reload();}
const roomCache=new Map();
export function stopChat() {
  stop();
  stop = reload = () => {};
}
const draftKey = (l, u) => "quasi-chat:" + u.id + ":" + l.id;
export function chatView(l, u) {
  let draft = "";
  try {
    draft = localStorage.getItem(draftKey(l, u)) || "";
  } catch {}
  return `<section class="chat-room"><div class="round-heading"><div><div class="eyebrow">IL TAVOLO È SEMPRE APERTO</div><h1>Chiacchiere da bar</h1><p>${esc(l.name)} · solo i membri di questa lega</p></div><span class="chat-sign" aria-hidden="true">“</span></div><details class="chat-notifications card"><summary>Il bar ti chiama. <span class="tiny muted">Gestisci notifiche</span></summary><div class="chat-push-content"><div><p class="tiny muted" id="chat-push-note">Le notifiche sono facoltative. I messaggi restano qui anche quando sei assente.</p></div><div><button class="secondary" id="chat-push" disabled>Caricamento…</button><button type="button" class="text-button" id="chat-push-test" hidden>Invia una notifica di prova a questo dispositivo</button></div></div></details><div id="chat-error" class="notice" role="status" hidden></div><div class="chat-panel card"><button type="button" class="text-button" id="chat-refresh">Aggiorna messaggi ↻</button><button class="text-button" id="chat-older" hidden>Carica messaggi precedenti</button><div id="chat-log" class="chat-log" role="log" aria-label="Messaggi della lega" aria-live="polite" aria-relevant="additions"><p class="muted">Apro il bar…</p></div><button class="secondary chat-new" id="chat-new" hidden>Nuovi messaggi ↓</button><form id="chat-form" class="chat-composer"><label class="sr-only" for="chat-text">Messaggio alla lega</label><textarea id="chat-text" maxlength="1200" rows="2" required>${esc(draft)}</textarea><div><span class="tiny muted" id="chat-counter">${draft.length}/1200 · bozza sul dispositivo</span><button class="primary" id="chat-send">Invia al bar ↗</button></div></form></div><p class="tiny muted">Solo testo · fino a 1200 caratteri · ultimi 3000 messaggi conservati. Puoi eliminare i tuoi messaggi; il presidente può moderare la stanza. La consegna delle notifiche può richiedere qualche minuto.</p></section>`;
}
export function bindChat({ league, user, api, notify, onUnread = () => {},onNotify=()=>{},consent }) {
  stopChat();
  const log = document.querySelector("#chat-log");
  if (!log) return;
  const form = document.querySelector("#chat-form"),
    text = document.querySelector("#chat-text"),
    older = document.querySelector("#chat-older"),
    push = document.querySelector("#chat-push"),
    note = document.querySelector("#chat-push-note"),
    jump = document.querySelector("#chat-new"),
    error = document.querySelector("#chat-error");
  let alive = true,
    messages = [...(roomCache.get(draftKey(league,user))?.messages||[])],
    latest = roomCache.get(draftKey(league,user))?.latest||0,
    hasOlder = roomCache.get(draftKey(league,user))?.hasOlder||false,
    reading = false,
    loading = false,
    refreshPending = false,
    sending = false,
    config = null,
    registered = false;
  let revision=roomCache.get(draftKey(league,user))?.revision||0,lastRead=0;
  const cache=()=>{roomCache.set(draftKey(league,user),{messages:messages.filter(m=>!m.pending).slice(-100),latest,revision,hasOlder});if(roomCache.size>10)roomCache.delete(roomCache.keys().next().value);};
  const bottom = () => log.scrollHeight - log.scrollTop - log.clientHeight < 65;
  const persist = () => {
    try {
      if (text.value) localStorage.setItem(draftKey(league, user), text.value);
      else localStorage.removeItem(draftKey(league, user));
    } catch {}
  };
  const report = (e) => {
    if (!alive) return;
    error.hidden = false;
    error.textContent =
      e.message || "Connessione interrotta. La bozza resta qui; riprova.";
  };
  async function read() {
    if (!alive || document.hidden || !bottom() || reading || !latest || lastRead>=latest) return;
    reading = true;
    const through=latest;
    try {
      const r = await api("chat-read", { league: league.id, through });
      if (alive) {
        lastRead=Math.max(lastRead,through);
        onUnread(r.unread);
        jump.hidden = true;
      }
    } catch {
    } finally {
      reading = false;
    }
  }
  function paint({ atBottom = true, prepend = false } = {}) {
    const oldHeight = log.scrollHeight,
      oldTop = log.scrollTop;
    log.innerHTML = messages.length
      ? messages
          .map(
            (m) =>
              `<article class="chat-message ${m.uid === user.id ? "mine" : ""} ${m.deleted ? "deleted" : ""}${m.system?" is-system":""}" data-message="${esc(m.id)}"><div class="chat-meta"><strong>${m.uid === user.id ? "Tu" : esc(m.name)}</strong><time datetime="${esc(m.created)}">${m.pending?'Invio in corso…':m.failed?'Invio non riuscito':new Date(m.created).toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</time></div><p>${esc(m.text)}</p>${m.failed?`<button type="button" class="text-button" data-chat-retry="${esc(m.id)}">Riprova</button>`:''}${!m.pending && !m.failed && !m.deleted && !m.system && (m.uid === user.id || league.admin === user.id) ? `<button class="text-button chat-delete" data-chat-delete="${esc(m.id)}" aria-label="Elimina messaggio di ${esc(m.name)}">Elimina</button>` : ""}</article>`,
          )
          .join("")
      : '<div class="chat-empty"><span aria-hidden="true">“</span><h2>Il primo giro di parole è tuo.</h2><p class="muted">Scrivi alla lega. Chi arriva dopo ritroverà la conversazione.</p></div>';
    older.hidden = !hasOlder;
    if (prepend) log.scrollTop = oldTop + log.scrollHeight - oldHeight;
    else if (atBottom) log.scrollTop = log.scrollHeight;
    log.querySelectorAll("[data-chat-retry]").forEach(button=>{
      button.onclick=()=>{
        const message=messages.find(m=>m.id===button.dataset.chatRetry);
        if(message&&!sending)void sendMessage(message);
      };
    });
    log.querySelectorAll("[data-chat-delete]").forEach(
      (b) =>
        (b.onclick = async () => {
          if (!confirm("Eliminare questo messaggio per tutta la lega?")) return;
          b.disabled = true;
          try {
            await api("chat-delete", {
              league: league.id,
              message: b.dataset.chatDelete,
            });
            await load();
          } catch (e) {
            report(e);
          }
        }),
    );
  }
  async function load(before) {
    if(!alive)return;
    if(loading){if(!before)refreshPending=true;return;}
    loading=true;
    try {
      const r = await api(
        "chat-messages?" +
          new URLSearchParams({
            league: league.id,
            ...(before ? { before } : {since:latest,revision}),
          }),
      );
      if (!alive) return;
      lastRead=Math.max(lastRead,r.read||0);
      if(r.unchanged){error.hidden=true;void read();return;}
      if(!before&&r.messages.length&&r.messages[0].seq>latest+1){messages=messages.filter(m=>m.pending||m.failed);hasOlder=r.hasOlder;}
      if((r.revision||0)!==revision)messages=messages.filter(m=>m.pending||m.failed);
      revision=r.revision||0;
      const atBottom = bottom() || !messages.length,
        previous = latest;
      const combined = new Map(messages.map((m) => [m.id, m]));
      r.messages.forEach((m) => combined.set(m.id, m));
      messages = [...combined.values()].sort((a, b) => a.seq - b.seq);
      latest = Math.max(latest,r.latest);
      if (before || !messages.length || messages[0]?.seq === r.messages[0]?.seq)
        hasOlder = r.hasOlder;
      paint({ atBottom: before ? false : atBottom, prepend: !!before });
      cache();
      error.hidden = true;
      if (!before && r.latest > previous && !atBottom) jump.hidden = false;
      if (!before && atBottom) void read();
    } catch (e) {
      report(e);
    } finally {
      loading=false;
      if(refreshPending){refreshPending=false;void load();}
    }
  }
  function pushLabel() {
    push.closest(".chat-notifications").hidden=!!(config?.notify&&registered);
    if(config)onNotify(!!config.notify);
    push.disabled = !config;
    const test=document.querySelector("#chat-push-test");if(test)test.hidden=!(config?.notify&&registered);
    push.textContent =
      config?.notify && registered
        ? "Silenzia questa lega"
        : config?.notify
          ? "Attiva su questo dispositivo"
          : "Attiva notifiche";
  }
  const supported = pushSupported;
  api("chat-config?" + new URLSearchParams({ league: league.id }))
    .then(async (r) => {
      if (!alive) return;
      config = r;
      pushLabel();
      if (!supported()) {
        push.disabled = true;
        push.textContent = "Notifiche non disponibili";
        note.textContent =
          "Su iPhone/iPad aggiungi la PWA alla schermata Home e aprila da lì. La chat funziona anche senza notifiche.";
      } else {
        registered = !!(await (
          await navigator.serviceWorker.ready
        ).pushManager.getSubscription());
        if (!alive) return;
        if(consent&&await consent==='granted'&&config.preference!=='muted'){
          await enableLeagueNotifications({league,user,api,config});if(!alive)return;registered=true;config.notify=true;
        }
        pushLabel();
        note.textContent = config.notify
          ? "Notifiche abilitate per questa lega. Attivale anche su ciascun dispositivo che vuoi usare."
          : "Ricevi un avviso anche con l’app chiusa, dopo aver autorizzato questo dispositivo.";
      }
    })
    .catch((e) => {
      report(e);
      push.textContent = "Notifiche non disponibili";
    });
  push.onclick = async () => {
    if (!config || user.demo) return;
    push.disabled = true;
    try {
      if (config.notify && registered) {
        await api("chat-preferences", { league: league.id, notify: false });
        config.notify = false;
        note.textContent =
          "Lega silenziata. I messaggi restano sempre nella chat.";
      } else {
        // Permission must be requested directly from the user's click, before any network wait.
        const permission = await Notification.requestPermission();
        if (permission !== "granted")
          throw Error(
            "Notifiche non autorizzate. Puoi abilitarle nelle impostazioni del browser.",
          );
        await enableLeagueNotifications({league,user,api,config});
        config.notify = true;
        registered = true;
        note.textContent =
          "Notifiche attive su questo dispositivo. Puoi silenziare questa lega quando vuoi.";
      }
    } catch (e) {
      report(e);
    } finally {
      if (alive) pushLabel();
    }
  };
  const testPush=document.querySelector('#chat-push-test');if(testPush)testPush.onclick=async()=>{testPush.disabled=true;try{const subscription=await(await navigator.serviceWorker.ready).pushManager.getSubscription();if(!subscription)throw Error('Attiva prima questo dispositivo.');await api('chat-test-push',{league:league.id,endpoint:subscription.endpoint});note.textContent='Notifica di prova in coda per questo dispositivo. Puoi chiudere l’app: la consegna può richiedere qualche minuto.';}catch(e){report(e);}finally{if(alive)testPush.disabled=false;}};
  text.oninput = () => {
    persist();
    document.querySelector("#chat-counter").textContent =
      text.value.length + "/1200 · bozza sul dispositivo";
  };
  text.onkeydown = (e) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      form.requestSubmit();
    }
  };
  async function sendMessage(message){
    const button=form.querySelector("button");
    sending=true;button.disabled=true;error.hidden=true;
    message.pending=true;message.failed=false;
    paint();
    try{
      const r=await api("chat-send",{league:league.id,text:message.text,nonce:message.nonce});
      messages=messages.filter(m=>m.id!==message.id);
      if(!messages.some(m=>m.id===r.message.id))messages.push(r.message);
      messages.sort((a,b)=>a.seq-b.seq);
      if(r.message.seq===latest+1)latest=r.message.seq;
      lastRead=Math.max(lastRead,r.message.seq);
      if(!alive)return;
      onUnread(0);cache();paint();
      if(r.message.seq>latest)void load();
    }catch(e){
      message.pending=false;message.failed=true;
      if(alive){cache();paint();report(e);}
      else {
        const key=draftKey(league,user),saved=roomCache.get(key);
        if(saved&&!saved.messages.some(m=>m.id===message.id))saved.messages.push(message);
      }
    }finally{
      sending=false;if(alive)button.disabled=false;
    }
  }
  form.onsubmit=e=>{
    e.preventDefault();
    const body=text.value.trim();
    if(sending||!body)return;
    const nonce=crypto.randomUUID().replace(/-/g,"");
    const message={id:"pending:"+nonce,nonce,seq:latest+0.5,uid:user.id,name:user.name,text:body,created:new Date().toISOString()};
    text.value="";text.oninput();
    messages.push(message);
    void sendMessage(message);
  };
  older.onclick = () => load(messages[0]?.seq);
  jump.onclick = () => {
    log.scrollTop = log.scrollHeight;
    read();
  };
  log.onscroll = () => {
    if (bottom()) read();
  };
  document.querySelector('#chat-refresh').onclick = () => load();
  if(messages.length)paint();
  load();
  stop = () => {
    alive = false;
    cache();
    persist();
  };
}
