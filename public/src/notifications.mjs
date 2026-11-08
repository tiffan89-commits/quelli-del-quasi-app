const invited = new Set();
const inviteKey = (user, league) =>
  "quasi-push-invite:" + user.id + ":" + league.id;
export const pushSupported = () =>
  typeof window !== "undefined" &&
  window.isSecureContext &&
  "serviceWorker" in navigator &&
  "PushManager" in window &&
  "Notification" in window;
function snoozed(user, league) {
  try {
    return (
      Date.now() - Number(localStorage.getItem(inviteKey(user, league)) || 0) <
      7 * 86400000
    );
  } catch {
    return false;
  }
}
export function requestChatConsent({ user, league }) {
  if (user?.demo || !pushSupported()) return null;
  if (Notification.permission === "granted") return Promise.resolve("granted");
  if (Notification.permission !== "default" || snoozed(user, league))
    return null;
  // Called directly from the chat-opening click, before rendering or awaiting network requests.
  return Notification.requestPermission().catch(() => "default");
}
export async function enableLeagueNotifications({ league, user, api, config, notifyChat = true }) {
  if(user?.demo)throw Error('Le notifiche sono simulate nella demo.');
  if (!pushSupported() || Notification.permission !== "granted")
    throw Error("Autorizza le notifiche per questo dispositivo.");
  const current =
    config ||
    (await api("chat-config?" + new URLSearchParams({ league: league.id })));
  const registration = await navigator.serviceWorker.ready;
  const key = Uint8Array.from(
    atob(current.publicKey.replace(/-/g, "+").replace(/_/g, "/")),
    (c) => c.charCodeAt(0),
  );
  const subscription =
    (await registration.pushManager.getSubscription()) ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: key,
    }));
  await api("chat-subscribe", {
    league: league.id,
    subscription: subscription.toJSON(),
    ...(!notifyChat?{notifyChat:false}:{}),
  });
  if (user)
    try {
      localStorage.removeItem(inviteKey(user, league));
    } catch {}
  return subscription;
}
export function maybeInvitePwaNotifications({ league, user, api, notify }) {
  if (
    !league ||
    !user || user.demo ||
    !pushSupported() ||
    Notification.permission !== "default"
  )
    return;
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches ||
    navigator.standalone === true;
  const key = inviteKey(user, league);
  if (
    !standalone ||
    invited.has(key) ||
    snoozed(user, league) ||
    document.querySelector("dialog[open]")
  )
    return;
  invited.add(key);
  const d = document.createElement("dialog");
  d.className = "push-invite";
  d.setAttribute("aria-labelledby", "push-invite-title");
  d.innerHTML =
    '<div class="eyebrow">IL BAR TI ASPETTA</div><h2 id="push-invite-title">Il bar ti chiama, anche quando non ci sei.</h2><p>Vuoi ricevere notifiche dei messaggi e promemoria delle schedine? Gli avvisi della chat riguardano <strong id="push-invite-league"></strong>? Il promemoria arriva due ore prima della chiusura, per tutte le tue leghe. Puoi gestirlo dal Profilo e silenziare ogni chat quando vuoi.</p><p class="tiny muted">Il testo del messaggio non compare nell’avviso sul blocco schermo.</p><div class="push-invite-actions"><button class="primary" id="push-invite-yes">Attiva notifiche</button><button class="secondary" id="push-invite-no">Non ora</button></div><p class="tiny muted" id="push-invite-status" role="status"></p>';
  d.querySelector("#push-invite-league").textContent = league.name;
  const defer = () => {
    try {
      localStorage.setItem(key, String(Date.now()));
    } catch {}
    d.close();
    d.remove();
  };
  d.querySelector("#push-invite-no").onclick = defer;
  d.addEventListener("cancel", (e) => {
    e.preventDefault();
    defer();
  });
  d.querySelector("#push-invite-yes").onclick = async (e) => {
    const permission = Notification.requestPermission();
    e.target.disabled = true;
    try {
      if ((await permission) !== "granted") {
        d.querySelector("#push-invite-status").textContent =
          "Consenso non concesso. La chat resta disponibile; puoi attivare gli avvisi dalle sue impostazioni.";
        return;
      }
      await enableLeagueNotifications({ league, user, api });
      d.close();
      d.remove();
      notify("Notifiche attive per " + league.name + ".");
    } catch (error) {
      d.querySelector("#push-invite-status").textContent = error.message;
    } finally {
      if (e.target.isConnected) e.target.disabled = false;
    }
  };
  document.body.appendChild(d);
  d.showModal();
}
