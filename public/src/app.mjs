import {joinInvite} from './invite-join.mjs';
import {openMatchPage} from './match-page.mjs';
import {barHomeInvite} from './bar-home-invite.mjs';
import {leagueActions} from './league-actions.mjs';
import {settingsLogout,presidentEntry,presidentPanel,presidentTodos,barPresidentTasks,bindPresidentPanel} from './president-panel.mjs';
import {createSportsPush} from './sports-push.mjs';
import {paintAuctionBadges,trackAuctionBadges} from './auction-index.mjs';
import {nicknameNotice} from './nickname-notice.mjs';
import {pointTerms} from '../scoring.mjs';
import {applySlipReceipt} from './slip-receipt.mjs';
import {loadAppStyles} from './app-styles.mjs';
import {saveOnce,identifySlipSave} from './save-guard.mjs';
import {readAppRoute,writeAppRoute} from './routes.mjs';
import {placeAppFooter,restoreAppFooter} from './app-footer.mjs';
import {startOneScreen} from './one-screen.mjs';
import {leagueCreationFields,leagueCreationPayload} from './league-create-form.mjs';
import {displayCache,clearDisplayCaches} from './display-cache.mjs';
import {randomLeagueControls,bindRandomLeagues} from './random-leagues.mjs';
import {sportsWindowActive} from './sports-window.mjs';
import {mountPublic} from './pubblico/app.mjs';
import {rememberEntry,entryIntent,clearEntry} from './acquisition-intent.mjs';
import {createPublicApi} from './pubblico/api.mjs';
import {retainAppHeader} from './mode-switch.mjs';
import {barModeSwitch,enterFanta,leaveFanta,preferredFanta,clearFantaSessions} from './fanta-mode.mjs';
import {createLiveChannel,requestJson,mergeLiveSnapshot,patchRegion,patchDashboard} from "./live-channel.mjs";
import {withButtonFeedback} from './action-feedback.mjs';
import {isMatchEvent,matchEventLabel} from '../match-events.mjs';
import {playerSurname} from './player-label.mjs';
import {ballIcon,substitutionMark} from './pitch-events.mjs';
import {footballStatistics,bindFootballStatistics} from './football-statistics.mjs';
import {clubShirt} from './club-crest.mjs';
import { renderSlipV2, patchSlipV2, bindSlipV2, stakeInputValue } from "./v2/slip-v2.mjs";
import { quasiScene, showQuasi } from "./quasi-scene.mjs";
import {barSlipsView,barVerdictPatch,barProfileView} from "./bar-slips.mjs";
import { renderTabBar, bindTabBar, tabForPage, routeForTab, defaultSource } from "./v2/tabs.mjs";
import { renderLeagueChip, bindLeagueSwitcher, isLeagueAdmin } from "./v2/league-switcher.mjs";
import { showLanding, hideLanding, markSession, pendingInvite, clearPendingInvite } from "./v2/landing.mjs";
const PUBLIC_AUTH_HASHES={login:'accesso',register:'registrati',forgot:'recupera',resend:'reinvia',demo:'demo'};
let pendingAppRoute=readAppRoute(),inviteAttempt=null;
const initialPublicMode=Object.keys(PUBLIC_AUTH_HASHES).find(k=>PUBLIC_AUTH_HASHES[k]===location.hash.slice(1));
let v2Invite = pendingInvite(), landingDismissed = !!v2Invite||!!initialPublicMode, forceDemo = initialPublicMode==='demo';
let initialDemoRequested=initialPublicMode==='demo';
import {inlineResultView,patchSlipResults} from './slip-results.mjs';
import {renderLineup,bindLineupPitch} from './lineup-pitch.mjs';
let studioModule;const loadStudio=()=>studioModule??=import('./quasi-studio.mjs');
window.addEventListener?.('quasi:idle',()=>{if(state.user&&!studioModule)loadStudio().catch(()=>{studioModule=null;});});

import {rosterView,bindRoster} from './quasi-roster.mjs';
import {rewardById,rewardMark,rarityLabel,REWARD_TYPES} from './reward-catalog.mjs';
import {fantaQuasiTeaser,fantaQuasiPage,bindFantaQuasi} from './fanta-quasi.mjs';
import {achievementBoard} from './achievement-board.mjs';

import { LEAGUE_COLORS, LEAGUE_EMBLEMS, applyLeagueTheme } from "./league-theme.mjs";
import {shareLeagueInvite,whatsappInvite} from './league-invite.mjs';
import {renderAppInvite,bindAppInvites} from './app-invite.mjs';
import {rewardsView,bindRewards} from './progression-ui.mjs';
import {bindStyledSelects,syncStyledSelects,closeStyledSelect} from './styled-select.mjs';


import { leagueDashboard, countdownLabel } from './league-dashboard.mjs';
let dashboardSource = 'seriea';
let dashboardCompetition=null;
let requestedSlip=new URLSearchParams(location.search).get('slip'),requestedSlipRound=new URLSearchParams(location.search).get('round');
import { calendarSections } from "./calendar-order.mjs";
import { playerRanking, fantasyTableView } from "./bar-fanta-rankings.mjs";
import {
  sourceOf,
  roundAvailability,currentSlipRound,defaultSlipRound,selectableSlipRounds,currentPublicSlipRound,selectablePublicSlipRounds,slipRomeDay,
  deadlineOf,
  isClosed,
  slipSummary,
  fingerprint,
  draftKey,
  loadDraft,
  saveDraft,
  cleanPicks,
} from "./slip-state.mjs";
import { communityView, createVerdictCard } from "./community.mjs";
import { chatView, bindChat, stopChat } from "./chat.mjs";
import {
  requestChatConsent,
  maybeInvitePwaNotifications,
  enableLeagueNotifications,
  pushSupported,
} from "./notifications.mjs";
let chatConsent = null;
import { fantasyMatchView } from "./bar-fanta-match.mjs";
import {patchFantasyMatch} from './fantasy-live-detail.mjs';
import {fantasyAccount,fantasyGroup,fantasyWalletKey} from './fantasy-accounts.mjs';
let requestedChat = new URLSearchParams(location.search).get("chat");
let calendarScope = "seriea";
let editBaseSavedAt = null,
  editBaseFingerprint = null;
import { groupMatches } from "/match-layout.mjs";
import { predictionStatus } from "/prediction.mjs";
let sourceScope = "seriea",
  competitionScope = null,
  offline = false,
  lastRefresh = null,
  draftWarning = false,
  draftConflict = null,
  viewKey = null,
  refreshing = false;
let state = { user: null, leagues: [] },
  leagueId = null,
  page = "lega",
  tab = "points",
  register = true,
  picks = {},
  market = {},
  stake = 10,
  busy = false,
  selectedRoundId = null;
let rankingScope = "league",
  slipScope = "mine",
  activeMatchId = null;
let authMode = initialPublicMode&&initialPublicMode!=='demo'?initialPublicMode:v2Invite ? "register" : "login",
  authMessage = "",
  accountToken = "",
  accountAction = null;
const accountLink = new URLSearchParams(location.hash.slice(1));
if (["verify", "reset"].includes(accountLink.get("action"))) {
  accountAction = accountLink.get("action");
  accountToken = accountLink.get("token") || "";
  authMode = accountAction;

}
const $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const fmt = (n) =>
    Number(n).toLocaleString("it-IT", { maximumFractionDigits: 2 }),
  date = (s) =>
    new Date(s).toLocaleString("it-IT", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Rome",
    }),
  groups = {
    "Esito finale": ["1", "X", "2"],
    "Doppia chance": ["1X", "12", "X2"],
    "Under / Over 2,5": ["Under 2.5", "Over 2.5"],
    "Goal / No Goal": ["Goal", "No Goal"],
  };
function teamLabel(name,{vs,home,fantasy=page==='calendario'?calendarScope==='fantacalcio':sourceScope==='fantacalcio'}={}) {
  if(!fantasy)return `<span class="team-label">${clubShirt(name,{vs,home})}<span>${esc(name)}</span></span>`;
  const team=Object.values(L()?.fantasyTeams?.[competitionScope]||{}).find(t=>t.name===name);
  const logo=team?.logo||team?.shirt;
  const icon=logo?`<img class="team-logo" data-deferred-src="${esc(logo)}" alt="" width="32" height="32" loading="lazy" onerror="this.hidden=true">`:`<span class="crest">${esc(name.slice(0,2))}</span>`;
  return `<span class="team-label" data-fantasy-team="${esc(name)}" data-fantasy-competition="${esc(competitionScope)}">${icon}<span>${esc(name)}</span></span>`;
}
function fixtureTeams(home,away,fantasy) {
  return `<span class="fixture-teams">${teamLabel(home,{home:true,vs:away,fantasy})}<span class="fixture-separator muted">–</span>${teamLabel(away,{home:false,vs:home,fantasy})}</span>`;
}
function predictionFeedback(match, pick, closed) {
  const feedback = predictionStatus(match, pick, closed);
  return feedback
    ? `<p class="pick-feedback ${feedback.className}" role="status"><b>${feedback.winning ? "✓" : "✕"} ${esc(pick)} · ${feedback.label}</b><small>${feedback.note}</small></p>`
    : "";
}
function notify(t) {
  let e = $("#toast");
  if(!e){e=document.createElement("div");e.id="toast";document.body.append(e);}
  e.className = "toast";
  e.textContent = t;
  e.hidden = false;
  setTimeout(() => (e.hidden = true), 4500);
}
function chatLauncherView(league,user){
 if(!league||!user||!user.demo&&!user.emailVerified)return '';
 const n=league.chat?.unread||0;
 return `<button type="button" class="support-fab chat-fab" id="open-chat" aria-label="Apri Chiacchiere da bar" aria-controls="league-chat-widget" aria-expanded="false"><svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M7 8h10M7 12h7"/></svg><span class="chat-fab-label">Chiacchiere da bar</span><b class="chat-fab-unread" ${n?'':'hidden'}>${n>99?'99+':n}</b></button>`;
}
let chatLeagueId=null;
function chatLeague(){return state.leagues.find(l=>l.id===chatLeagueId)||L();}
function syncChatLauncher(league=L()){
 if(!document.createElement)return;
 const markup=chatLauncherView(league,state.user);
 if(!markup){document.querySelectorAll('#open-chat').forEach(b=>b.remove());chatLeagueId=null;closeLeagueChat();return;}
 chatLeagueId=league.id;
 let button=document.querySelector('#app #open-chat')||document.getElementById('open-chat');
 if(!button){const holder=document.createElement('div');holder.innerHTML=markup;button=holder.firstElementChild;}
 document.querySelectorAll('#open-chat').forEach(b=>{if(b!==button)b.remove();});
 if(button.parentElement!==document.body)document.body.append(button);
 button.onclick=openLeagueChat;bindSupportDrag();chatBadge();
}

let chatOpen = false,
  chatContext = null;
function chatBadge() {
  const button = $("#open-chat");
  if (!button) return;
  button.setAttribute("aria-expanded", String(chatOpen));
  button.setAttribute(
    "aria-label",
    chatOpen ? "Riduci Chiacchiere da bar" : "Apri Chiacchiere da bar",
  );
  const badge = button.querySelector(".chat-fab-unread"),
    n = chatLeague()?.chat?.unread || 0;
  if (badge) {
    badge.hidden = !n;
    badge.textContent = n > 99 ? "99+" : String(n);
  }
}
function closeLeagueChat() {
  chatOpen = false;
  stopChat();
  const widget = $("#league-chat-widget");
  if (widget) widget.hidden = true;
  chatContext = null;
  chatBadge();
  $("#open-chat")?.focus?.();
}
function updateChatWidget() {
  if (!document.createElement) return;
  const league = chatLeague(),
    user = state.user;
  if (!league || !user || (!user.demo && !user.emailVerified)) {
    closeLeagueChat();
    return;
  }
  if (!chatOpen) {
    chatBadge();
    return;
  }
  let widget = $("#league-chat-widget");
  if (!widget) {
    widget = document.createElement("aside");
    widget.id = "league-chat-widget";
    widget.className = "league-chat-widget";
    widget.setAttribute("role", "dialog");
    widget.setAttribute("aria-label", "Chiacchiere da bar");
    document.body.appendChild(widget);
  }
  const key = user.id + ":" + league.id;
  widget.hidden = false;
  if (chatContext !== key) {
    stopChat();
    widget.innerHTML =
      '<header class="chat-widget-header"><div><strong>Chiacchiere da bar</strong><small id="chat-widget-league"></small></div><button class="secondary" id="chat-minimize" aria-label="Riduci la chat"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></button></header>' +
      chatView(league, user);
    widget.querySelector("#chat-widget-league").textContent = league.name;
    widget.querySelector("#chat-minimize").onclick = closeLeagueChat;
    chatContext = key;
    bindChat({
      league,
      user,
      api,
      notify,
      consent: chatConsent,
      onUnread: (n) => {
        league.chat = { ...league.chat, unread: n };
        chatBadge();
      },
    });
    chatConsent = null;
  }
  chatBadge();
}
function openLeagueChat() {
  if (chatOpen) {
    closeLeagueChat();
    return;
  }
  const league = chatLeague();
  if (!league) return;
  chatConsent = requestChatConsent({ user: state.user, league });
  chatOpen = true;
  updateChatWidget();
}
let barDemo=null,initialViewReady=Promise.resolve();
async function prepareDemo(){const session=(await import('./demo-session.mjs')).getDemoSession();await session.ready;barDemo=session.bar;state=structuredClone(barDemo.state);if(!state.leagues.some(l=>l.id===leagueId))leagueId=state.leagues[0].id;return session;}
async function openBarDemo(target={}){await prepareDemo();await loadAppStyles();if(target?.page==='logout'){await returnToLanding();return;}leaveFanta();leagueId=target?.league||leagueId;page=({profilo:'profilo',invita:'profilo',schedina:'schedina',admin:'admin',regolamento:'regolamento'})[target?.page]||'lega';sourceScope=target?.sourceScope||'seriea';selectedRoundId=target?.round||null;hydrateDraft();render();writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page,league:leagueId});}
const accountAttempts=new Map();
async function api(path, data, options = {}) {
  if(barDemo&&state.user?.demo){const result=await barDemo.api(path,data);return options.meta?{data:result,etag:null}:result;}
  if(path==='slip'&&data)data=identifySlipSave(data,{user:state.user?.id});
  const account=['register','login','logout','forgot-password','resend-verification','activate','reset-password','set-email'].includes(path);
  if(data&&account&&path!=='login'&&path!=='logout'){
    const signature=path+'\n'+JSON.stringify(data),prior=accountAttempts.get(signature);if(prior&&Date.now()-prior.at<60000)data={...data,requestId:prior.id};else{const id=crypto.randomUUID();accountAttempts.clear();accountAttempts.set(signature,{id,at:Date.now()});data={...data,requestId:id};}
  }
  return saveOnce((data?'write:':'read:')+path+(data?':'+JSON.stringify(data):''),()=>requestJson('/api/'+path,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},...(data?{body:JSON.stringify(data)}:{}),...(account||path==='league-delete'?{timeoutMs:25000}:path==='slip'?{timeoutMs:20000}:{}),...options}));
}

function L() {
  return state.leagues.find((x) => x.id == leagueId) || state.leagues[0];
}
function fantasyAvailable(l = L()) {
  return !!l?.rounds?.some((r) => sourceOf(r) === "fantacalcio");
}
let displayedSlipRoundId=null;
const publicSlipView=()=>slipScope==='bar'||slipScope==='community';
function availableRounds() {
 const all=(L()?.rounds||[]).filter(r=>!r.archived&&sourceOf(r)===sourceScope&&(sourceScope!=='fantacalcio'||!competitionScope||r.competitionKey===competitionScope));
 const rounds=selectableSlipRounds(all,Date.now(),state.calendar);
 return rounds.sort((a,b)=>(Number(a.number)-Number(b.number))||Date.parse(a.kickoff)-Date.parse(b.kickoff));
}

function R() {
  const rounds = availableRounds();
  return (
    rounds.find((r) => r.id === selectedRoundId) ||
    defaultSlipRound(rounds,Date.now(),state.calendar)
  );
}
function me() {
  if(!preferredFanta())return L()?.members.find(x=>x.uid===state.user.id);
  const member = L()?.members.find((x) => x.uid === state.user.id),
    r = R();
  if (!member || sourceScope !== "fantacalcio" || !r?.virtualBookmaker)
    return member;
  const wallet = fantasyAccount(member,r,L());
  const committed = (L().rounds || [])
    .filter((x) => x.source === "fantacalcio" && x.virtualBookmaker && fantasyWalletKey(x,L())===fantasyWalletKey(r,L()))
    .reduce(
      (sum, x) => sum + (x.slip && !x.slip.creditsSettled ? x.slip.stake : 0),
      0,
    );
  return {
    ...member,
    ...wallet,
    committedCredits: committed,
    capital: wallet.credits + committed,
  };
}
async function refresh(reset = false) {
  if (refreshing) return false;
  refreshing = true;
  try {
    const next = await api("state?lite=1");
    if (!next || !Array.isArray(next.leagues))
      throw Error("Risposta del servizio non valida");
    const previousUser = state.user?.id,
      previousLeague = L()?.id,
      previousVerified = state.user?.emailVerified,
      previousRound = R();
    const wasDirty =
      previousRound &&
      slipSummary(previousRound, picks, stake, me()?.credits ?? Infinity).dirty;
    if (wasDirty && !reset) persistDraft();
    state = next;for(const league of state.leagues)for(const round of league.rounds||[])round.publicChoicesAvailable=!!round.closed&&Array.isArray(round.publicSlips);sportsFeedBlockedUntil=0;
    if(state.user&&state.user.id!==previousUser){const route=readAppRoute();pendingAppRoute=null;page=route?.mode==='bar'?({oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',profilo:'profilo',regolamento:'regolamento',admin:'admin',lega:'barleague'})[route.page]||'lega':'lega';if(state.leagues.some(l=>l.id===route?.league))leagueId=route.league;if(route?.mode==='bar'&&route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;}
    if(requestedSlip&&state.leagues.some(l=>l.id===requestedSlip)){
      leagueId=requestedSlip;const round=L().rounds.find(r=>r.id===requestedSlipRound);page='schedina';slipScope='mine';if(round){sourceScope=sourceOf(round);competitionScope=round.competitionKey||null;selectedRoundId=round.id;}
      requestedSlip=null;requestedSlipRound=null;const params=new URLSearchParams(location.search);params.delete('slip');params.delete('round');window.history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));
    }
    const invite=state.user?.emailVerified&&!state.user.demo?pendingInvite():null;
    if(invite&&inviteAttempt!==state.user.id+':'+invite){inviteAttempt=state.user.id+':'+invite;try{
      const joined=await joinInvite(invite,{join:code=>api('join',{code}),clear:()=>{clearPendingInvite();v2Invite=null;clearEntry(localStorage);}});
      state=await api('state?lite=1');leagueId=joined.league;selectedRoundId=null;page='lega';writeAppRoute({mode:'bar',page:'oggi',league:joined.league},{replace:true});
    }catch(error){notify(error.message);}}
    if(next.adminOnly){location.replace("/admin.html");return;}
    if(state.user?.emailVerified&&!state.user.demo&&new URLSearchParams(location.search).get('entry')==='fanta'&&!accountAction&&!pendingInvite()){rememberEntry(localStorage);location.replace('/entra-fanta.html'+location.search);return true;}
    if (!leagueId && state.user)
      try {
        const saved = localStorage.getItem(
          "quasi-active-league:" + state.user.id,
        );
        if (state.leagues.some((l) => l.id === saved)) leagueId = saved;
      } catch {}
    if (state.user && state.user.id !== previousUser && page !== "schedina") sourceScope = 'seriea';
    if (requestedChat && state.leagues.some((l) => l.id === requestedChat)) {
      leagueId = requestedChat;
      chatOpen = true;
      requestedChat = null;
      const params = new URLSearchParams(location.search);
      params.delete("chat");
      window.history.replaceState(
        null,
        "",
        location.pathname + (params.size ? "?" + params : ""),
      );
    }
    offline = false;
    lastRefresh = new Date();
    if (previousUser && state.user?.id !== previousUser) {
      detailCache.clear();detailPending.clear();
      picks = {};
      viewKey = null;
    }
    const key =
      state.user && L() && R() ? draftKey(state.user.id, L().id, R()) : null;
    if (reset || key !== viewKey) hydrateDraft();
    else if ((R()?.slip?.savedAt || null) !== editBaseSavedAt) {
      if (wasDirty)
        draftConflict = {
          picks: { ...picks },
          stake,
          base: editBaseFingerprint,
        };
      else hydrateDraft();
    }
    const active = document.activeElement;
    const editing =
      active?.matches?.("input,textarea,select") ||
      document.querySelector("dialog[open]");
    if (
      reset ||
      !previousUser ||
      state.user?.id !== previousUser ||
      state.user?.emailVerified !== previousVerified ||
      (previousLeague && !state.leagues.some((l) => l.id === previousLeague))
    )
      render();
    else {
      updateConnection();
      syncTeamAssets();
      chatBadge();
      updateDashboard();
    }
    return true;
  } catch (e) {
    offline = true;
    if (!state.user) {
      renderAuth();
    }
    updateConnection();
    if (reset)
      notify(
        "Connessione non disponibile. Le bozze restano su questo dispositivo.",
      );
    return false;
  } finally {
    refreshing = false;
    if(state.user){await loadAppStyles();const header=document.getElementById('app-header');if(header)document.documentElement.style.setProperty('--ux-header-height',header.offsetHeight+'px');}
    await initialViewReady;
    window.finishEntrySplash?.();
    if(state.user)showLiveStatus({state:"ready",at:Date.now()});
  }
}
function hydrateDraft() {
  if(sourceScope==='fantacalcio'&&slipScope==='standings')slipScope='mine';
  if (!fantasyAvailable()) {
    calendarScope = "seriea";
    competitionScope = null;
  }
  if (sourceScope === "fantacalcio" && !competitionScope)
    competitionScope =
      L()?.rounds.find((r) => sourceOf(r) === "fantacalcio" && !r.archived)?.competitionKey ||
      L()?.rounds.find((r) => sourceOf(r) === "fantacalcio")?.competitionKey ||
      null;
  const r = R();
  editBaseSavedAt = r?.slip?.savedAt || null;
  editBaseFingerprint = fingerprint(
    r?.slip?.picks,
    r?.pointsOnly ? 0 : r?.slip?.stake || 10,
  );
  viewKey = state.user && L() && r ? draftKey(state.user.id, L().id, r) : null;
  draftConflict = null;
  picks = { ...(r?.slip?.picks || {}) };
  stake = r?.pointsOnly ? 0 : r?.slip?.stake || 10;
  market = {};
  if (viewKey) {
    const d = loadDraft(localStorage, viewKey, r);
    if (d?.conflict) draftConflict = d;
    else if (d) {
      picks = d.picks;
      stake = d.stake;
    }
  }
  for (const [id, p] of Object.entries(picks))
    market[id] = Object.keys(groups).find((g) => groups[g].includes(p));
}
function persistDraft() {
  const r = R();
  if (!viewKey || !r || isClosed(r)) return;
  if (draftConflict) {
    draftWarning = !saveDraft(localStorage, viewKey, {
      round: r,
      picks: draftConflict.picks,
      stake: draftConflict.stake,
      base: draftConflict.base ?? editBaseFingerprint,
    });
    return;
  }
  if (
    fingerprint(picks, r.pointsOnly ? 0 : stake) ===
    fingerprint(r.slip?.picks, r.pointsOnly ? 0 : r.slip?.stake || 10)
  ) {
    try {
      localStorage.removeItem(viewKey);
    } catch {}
    return;
  }
  draftWarning = !saveDraft(localStorage, viewKey, {
    round: r,
    picks,
    stake,
    base: editBaseFingerprint,
  });
}
function updateConnection() {
  const b = $("#connection-status");
  if (!b) return;
  b.hidden = !offline;
  b.innerHTML = offline
    ? 'Connessione interrotta. Mostriamo gli ultimi dati disponibili. <button class="text-button" id="retry-connection">Riprova</button>'
    : "";
  if ($("#retry-connection"))
    $("#retry-connection").onclick = () => refresh(true);
}
function navIcon(id) {
  const paths = {
    schedina:
      '<rect x="6" y="3" width="12" height="18" rx="2"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    classifiche: '<path d="M8 21V11H3v10h18V7h-5v14M8 21h8V3H8z"/>',
    calendario:
      '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18m-13 4h2m4 0h2"/>',
    lega: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m2 10v-3a6 6 0 0 0-2-4"/>',
    admin: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7Z"/><path d="m8 12 3 3 5-6"/>',
    profilo:
      '<circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/>',
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[id] || paths.schedina}</svg>`;
}
function shell(content) {
  return `${!state.user ? '<header><div class="brand"><img class="brand-logo" src="/league-logo.svg" alt="Logo Quelli del Quasi" width="38" height="44">QUELLI DEL <b>QUASI.</b></div></header>' : ""}${state.user && (state.user.emailVerified || state.user.demo) && L() ? renderLeagueChip(L(), state.user.id, esc, fmt, barModeSwitch(), me(), 'crediti Bar',['admin','profilo'].includes(page)) : ""}${state.user && (state.user.emailVerified || state.user.demo) && !L() ? `<header class="v2-top">${barModeSwitch()}${presidentEntry('data-bar-page="profilo"')}</header>` : ""}${content}${state.user && (state.user.emailVerified || state.user.demo) ? renderTabBar(tabForPage(page, sourceScope)) : ""}${chatLauncherView(L(),state.user)}`;
}
function slipsPage(l, r, m) {
  if(sourceScope==='fantacalcio')return '<section class="card"><h1>Le schedine Fanta hanno il loro posto.</h1><p>Le trovi nella sezione Schedine del Fanta, insieme alla tua lega.</p><button type="button" class="primary" id="open-native-slips">Apri le schedine Fanta</button></section>';
  const fantaLeagues=state.leagues.filter(x=>fantasyAvailable(x));
  const fantaLeagueSelector=sourceScope==='fantacalcio'&&fantaLeagues.length>1?'<label class="field">Lega Fanta<select data-fanta-bar-select>'+fantaLeagues.map(x=>'<option value="'+esc(x.id)+'" '+(x.id===l.id?'selected':'')+'>'+esc(x.name)+'</option>').join('')+'</select></label>':'';
  const competitions = [
    ...new Map(
      (l.rounds || [])
        .filter((x) => sourceOf(x) === "fantacalcio")
        .map((x) => [x.competitionKey, x.competitionName || x.title]),
    ).entries(),
  ];
  const selector =
    sourceScope === "fantacalcio" && competitions.length
      ? '<label class="field competition-selector">Competizione<select id="competition-switch">' +
        competitions
          .map(
            ([id, label]) =>
              '<option value="' +
              esc(id) +
              '" ' +
              (id === competitionScope ? "selected" : "") +
              ">" +
              esc(label) +
              "</option>",
          )
          .join("") +
        "</select></label>"
      : "";
  const tabs =
    '<div class="slip-section-buttons" data-os-header aria-label="Le Schedine">' +
    [
      ["mine", "La mia schedina", "La mia"],
      ["bar", "Le schedine del Bar", "Del Bar"],
      ["community", "Il verdetto", "Verdetto"],
      ...(sourceScope==='seriea'?[["standings","Classifica Serie A","Serie A"]]:[]),
    ]
      .map(
        ([id, t, short]) =>
          '<button data-slip-scope="' +
          id +
          '" class="' +
          (slipScope === id ? "on" : "") +
          '" aria-pressed="' +
          (slipScope === id) +
          '" data-short="' + short + '"><span class="seg-long">' +
          t +
          "</span></button>",
      )
      .join("") +
    "</div>";
  const body =
    slipScope === 'standings' && sourceScope === 'seriea' ? serieATable() : slipScope === "community"
      ? (r ? '<div data-os-header>'+roundSelector(l,r)+'</div>' : '') + '<div data-os-content data-os-flow>'+communityView(
          l,
          sourceScope,
          esc,
          fmt,
          competitionScope,
          r,
        )+'</div>'
      : sourceScope === "fantacalcio" && !r
        ? fantasyEmpty(l)
        : slipScope === "bar"
          ? otherSlips(l, r)
          : (r ? '<div data-os-header>'+roundSelector(l,r)+'</div>' : "") +
            (draftConflict ? '<div class="notice"><b>La schedina è stata aggiornata da un altro dispositivo.</b><p>Puoi tenere la versione salvata oppure recuperare la bozza locale e rivederla.</p><button class="secondary" id="keep-server">Tieni quella salvata</button> <button class="secondary" id="recover-draft">Recupera la bozza</button></div>' : "") +
            renderSlipV2({ round: r, picks, stake, credits: m.credits, openMatch: activeMatchId, esc, fmt, date });
  return (
    fantaLeagueSelector + selector +
    tabs +
    body
  );
}
function fantasyEmpty(l) {
  return '<section class="card empty fantasy-empty"><div class="league-emblem">F</div><div class="eyebrow">LE SFIDE DEI TUOI AMICI</div><h1>Qui si aspettano le sfide.</h1><p class="muted">Questa lega non ha ancora una schedina Fanta. Puoi scegliere un’altra lega dal selettore in alto.</p></section>';
}
function render() {
  closeStyledSelect();
  trackAuctionBadges(accountAction?null:state.user,state.leagues);
  if(!state.user||accountAction)document.getElementById('app-header')?.remove();
  if(state.user&&!accountAction){markSession(true);hideLanding();publicUi?.destroy();publicUi=null;document.body.classList.remove('public-area');}
  if (state.user && !accountAction && (preferredFanta()||readAppRoute()?.mode==='fanta')) {
    closeLeagueChat();
    initialViewReady=enterFanta($('#app'), {user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:readAppRoute()?.league||L()?.nativeFantaLink?.leagueId,onBar:openBarTarget});
    return;
  }
  if (accountAction || !state.user) {
    closeLeagueChat();
    renderAuth();
    return;
  }
  if(state.adminOnly){location.replace('/admin.html');return;}
  loadAppStyles();if(typeof startOneScreen==='function')startOneScreen();
  sourceScope='seriea';
  const l = L(),
    r = R(),
    m = me();
  if(page==='profilo'&&l&&(state.user.emailVerified||state.user.demo)){page='admin';presidentGroup='account';}
  const content =
    (!state.user.emailVerified && !state.user.demo) || page === "profilo"
      ? profile()
      : page === "seriea"
        ? serieATable()
        : page === "altri"
          ? otherSlips(l, r)
          : page === "regolamento"
            ? '<button type="button" class="secondary" data-page="barleague">← Chiudi regolamento</button>'+regulation(l, r)
            : !l
              ? onboarding()
              : page === "fantaquasi" ? fantaQuasiPage(l, state.user, esc)
              : page === "barleague" ? barLeagueInfo(l)
              : page === "quasi" ? '<section class="hero"><div class="eyebrow">LA TUA LEGA</div><h1>I Quasi</h1><p>'+esc(l.name)+' · '+l.members.length+' al bancone.</p></section>'+rewardsView(state.user)+'<details class="card my-league" open><summary>La squadra dei Quasi</summary>'+rosterView(l,state.user.id)+'</details>'
              : page === "schedina" ? slipsPage(l, r, m)
                : page === "classifiche"
                  ? ranking(l)
                  : page === "admin"
                      ? leagueAdmin(l)
                    : page === "lega"
                      ? settings(l, r)
                      : page === "calendario"
                        ? calendarPage()
                        : settings(l, r);
  document.body.dataset.gameMode='bar';
  const palette = LEAGUE_COLORS.map(([color]) => color);
  applyLeagueTheme(L());
  $("#app").innerHTML = shell(
    '<main><div id="connection-status" class="notice connection-status" role="status" hidden></div>' +
      ((page==='lega'||page==='quasi')?nicknameNotice(state.user):'')+content +
      '<p id="live-channel-status" class="live-channel-status tiny muted" role="status" aria-live="polite"></p></main>',
  );

  displayedSlipRoundId=page==='schedina'?r?.id:null;
  retainAppHeader($('#app'));
  paintAuctionBadges();
  placeAppFooter($('#app'));
  syncChatLauncher(l);
  bind(l, r);
  bindPresidentPanel($('#app'));
  const deleteLeagueForm=$('#president-delete-league');
  if(deleteLeagueForm?.elements&&l){
    const field=deleteLeagueForm.elements.phrase,button=deleteLeagueForm.querySelector('button'),error=deleteLeagueForm.querySelector('[role=alert]');
    const phrase='ELIMINA LEGA E STORICO';
    field.oninput=()=>{button.disabled=field.value!==phrase;};
    deleteLeagueForm.onsubmit=async e=>{
      e.preventDefault();
      if(field.disabled||field.value!==phrase)return;
      field.disabled=button.disabled=true;button.textContent='Eliminazione…';error.textContent='';
      try{await api('league-delete',{league:l.id,phrase});}
      catch(err){error.textContent=err.message;field.disabled=button.disabled=false;button.textContent='Elimina la lega';return;}
      closeLeagueChat();clearFantaSessions();
      state.leagues=state.leagues.filter(item=>item.id!==l.id);leagueId=state.leagues[0]?.id;selectedRoundId=null;presidentGroup=null;page='lega';hydrateDraft();
      writeAppRoute({mode:'bar',page:'oggi',league:leagueId});render();notify('Lega eliminata.');
      void refresh(true);
    };
  }
  document.querySelectorAll('[data-president-group]').forEach(b=>b.addEventListener('click',()=>{presidentGroup=b.dataset.presidentGroup;}));
  document.querySelector('[data-president-copy-link]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/invito/'+encodeURIComponent(l.code));notify('Link copiato.');}catch{notify('Copia il codice della lega.');}});
  document.querySelector('[data-president-activate]')?.addEventListener('click',()=>{document.getElementById('v2-open-leagues')?.click();document.querySelector('[data-existing-bar]')?.click();});
  document.querySelectorAll('[data-president-section]').forEach(section=>section.addEventListener('toggle',()=>{if(!section.open&&presidentGroup===section.dataset.presidentSection)presidentGroup=null;}));
  bindNew(l, r);
  $("#edit-suggested-nickname")?.addEventListener("click",()=>{const section=$(".profile-account");if(section)section.open=true;const field=$("#profile-name input");field?.scrollIntoView({block:"center",behavior:"smooth"});field?.focus({preventScroll:true});});
  if(liveStatus)showLiveStatus(liveStatus);
  updateChatWidget();
  updateConnection();
  maybeRevealRewards();
  if (l && !chatOpen)
    maybeInvitePwaNotifications({ league: l, user: state.user, api, notify });
}

function publicHistory(mode){window.history?.pushState?.({quasiPublic:mode},'', '/'+(mode==='landing'?'':'#'+PUBLIC_AUTH_HASHES[mode]));}
function showPublicAuth(mode,push=true){
  if(push)publicHistory(mode);
  landingDismissed=true;authMode=mode;accountAction=null;accountToken='';authMessage='';render();window.scrollTo(0,0);
}
function startDemoPreview(push=true){
  if(push)publicHistory('demo');
  landingDismissed=true;forceDemo=true;authMode='login';render();setTimeout(()=>document.getElementById('demo')?.click(),0);
}
async function returnToLanding(button,push=true){
  if(button)button.disabled=true;
  try{
    if(state.user){persistDraft();await api('logout',{});clearDisplayCaches(state.user.id);}
    closeLeagueChat();leaveFanta();clearFantaSessions();if(barDemo){(await import('./demo-session.mjs')).resetDemoSession();barDemo=null;}publicUi?.destroy();publicUi=null;
    state={user:null,leagues:[],features:state.features};leagueId=null;selectedRoundId=null;competitionScope=null;
    picks={};market={};viewKey=null;draftConflict=null;editBaseSavedAt=null;activeMatchId=null;page='lega';
    accountAction=null;accountToken='';authMessage='';authMode='login';forceDemo=false;landingDismissed=false;
    markSession(false);if(push)publicHistory('landing');render();liveChannel.wake();window.scrollTo(0,0);return true;
  }catch(error){notify('Non siamo riusciti a uscire. Riprova tra poco.');return false;}
  finally{if(button?.isConnected)button.disabled=false;}
}
let publicUi=null;
function renderAuth(){
 restoreAppFooter(document);
 syncChatLauncher(null);
 hideLanding();document.getElementById('landing')?.remove();document.body.classList.add('public-area');if(publicUi)return;
 publicUi=mountPublic($('#app'),{api:createPublicApi(),onDemo:async mode=>{
  if(mode==='fanta'){publicUi?.destroy();publicUi=null;document.body.classList.remove('public-area');await prepareDemo();await enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,onBar:openBarDemo});}
  else{publicUi?.destroy();publicUi=null;await openBarDemo();}
 },onLoggedIn:async result=>{
  if(result.requireAdminCode){sessionStorage.setItem('quasi-admin-challenge',JSON.stringify(result));location.assign('/admin.html');return;}
  if(entryIntent(localStorage)&&!result.invite&&!pendingInvite()){location.assign('/entra-fanta.html'+location.search);return;}
  leaveFanta();try{localStorage.setItem('qdq:mode','bar');}catch{}
  const code=result.invite||pendingInvite();if(code){try{const joined=await joinInvite(code,{join:code=>api('join',{code}),clear:()=>{clearPendingInvite();v2Invite=null;clearEntry(localStorage);}});leagueId=joined.league;selectedRoundId=null;pendingAppRoute={mode:'bar',page:'oggi',league:joined.league};}catch(error){notify(error.message);}}
  if(pendingAppRoute){writeAppRoute(pendingAppRoute,{replace:true});pendingAppRoute=null;}
  await loadAppStyles();
  accountAction=null;if(!await refresh(true)||!state.user)throw Error('L’accesso è riuscito, ma il bar non si è ancora caricato. Premi di nuovo Accedi tra pochi secondi.');if(!readAppRoute())writeAppRoute({mode:'bar',page:'oggi'},{replace:true});
 }});
}

function onboarding() {
 return `<section class="hero"><div class="eyebrow">BENVENUTO, ${esc(state.user.name)}</div><h1>IL TUO BAR.<br>IL VOSTRO <em>CAMPIONATO.</em></h1><p>Crea una lega completa oppure raggiungi gli amici con il loro codice.</p></section><div class="league-create-onboarding"><form class="card league-create-card" id="create">${leagueCreationFields()}<button type="submit" class="primary">Crea Bar e Fanta</button></form><form class="card" id="join"><span class="league-create-badge">HAI GIÀ UN INVITO?</span><h3>Gli amici hanno tenuto il posto.</h3><label class="field">Codice lega<input name="code" required placeholder="ABC123" autocomplete="off" autocapitalize="characters"></label><button type="submit" class="secondary">Entra nella lega</button></form></div>`;
}
function roundSelector(l, r) {
  return (
    '<label class="field round-selector"><span class="sr-only">Giornata</span><select id="round-switch">' +
    availableRounds()
      .map(
        (x) =>
          '<option value="' +
          esc(x.id) +
          '" ' +
          (x.id === r?.id ? "selected" : "") +
          ">" +
          esc(x.title) +
          (x.archived?" · archivio":" · "+roundAvailability(x)) +
          "</option>",
      )
      .join("") +
    "</select></label>"
  );
}
function schedina(l, r, m) {
  if (!r)
    return '<section class="card empty"><h1>La prossima è quella buona.</h1><p>La prossima schedina sarà disponibile a breve.</p></section>';
  const d = slipSummary(r, picks, stake, m.credits),
    max = (r.rules || l.rules).maxStake;
  return (
    '<section class="round-heading"><div><div class="eyebrow">' +
    (sourceScope === "fantacalcio"
      ? "IL FANTA DEL TUO BAR"
      : "LA PROSSIMA È QUELLA BUONA") +
    '</div><h1 class="sr-only">' +
    esc(r.title) +
    "</h1>" +
    roundSelector(l, r) +
    "<p>" +
    (r.settled
      ? "Risultati confermati. Le prove restano."
      : d.closed
        ? "Pronostici chiusi · in attesa del verdetto"
        : deadlineOf(r)
          ? "Chiude " + date(deadlineOf(r))
          : "Scadenza da confermare") +
    '</p></div><span class="slip-state" data-slip-status>' +
    d.status +
    "</span></section>" +
    '<div class="balance-strip"><div><span>Disponibili</span><strong>' +
    fmt(m.credits) +
    " <small>cr</small></strong></div><div><span>Impegnati</span><strong>" +
    fmt(m.committedCredits || 0) +
    " <small>cr</small></strong></div><div><span>" +
    (sourceScope === "fantacalcio" ? "Punti Fantacalcio" : "Punti Serie A") +
    "</span><strong>" +
    fmt(
      sourceScope === "fantacalcio"
        ? fantasyGroup(L(), competitionScope)?.members.find((x) => x.uid === state.user.id)
            ?.points || 0
        : m.points,
    ) +
    " <small>pt</small></strong></div></div>" +
    (r.virtualBookmaker
      ? '<div class="tiny muted fantasy-stakes-note">Bookmaker virtuale · Un solo portafoglio Fantacalcio condiviso tra le competizioni della lega. Quote stimate con margine 5%; fissate alla conferma della schedina. Nessun denaro reale.</div>'
      : "") +
    "" +
    (draftConflict
      ? '<div class="notice"><b>La schedina è stata aggiornata da un altro dispositivo.</b><p>Puoi tenere la versione salvata oppure recuperare la bozza locale e rivederla.</p><button class="secondary" id="keep-server">Tieni quella salvata</button> <button class="secondary" id="recover-draft">Recupera la bozza</button></div>'
      : "") +
    (d.closed && !r.slip
      ? '<div class="notice">Non hai inviato una schedina per questa giornata. Le eventuali bozze locali non partecipano al gioco.</div>'
      : "") +
    '<div class="layout"><section aria-label="Partite da pronosticare"><div class="section-title"><h2>La tua schedina</h2><span class="tiny muted" id="selection-count">' +
    d.count +
    " / " +
    d.total +
    " scelte</span></div>" +
    groupMatches(r.matches)
      .map(
        (day) =>
          '<h3 class="day-heading">' +
          esc(sourceScope === "fantacalcio" ? "Sfide di giornata" : day.label) +
          "</h3>" +
          day.matches.map((x) => matchCard(x, r)).join(""),
      )
      .join("") +
    '</section><aside><div class="card ticket" id="ticket-summary" tabindex="-1">' +
    ticketView(l, r, m) +
    '</div><button class="secondary full" data-page="classifiche">Guarda la classifica ↗</button></aside></div>' +
    '<div class="slip-dock" aria-label="Riepilogo rapido schedina"><div><strong id="dock-count">' +
    d.count +
    "/" +
    d.total +
    ' scelte</strong><small id="dock-status">' +
    d.status +
    '</small></div><button class="primary" id="review-slip">Rivedi schedina ↑</button></div>'
  );
}
function matchCard(x, r) {
  return (
    '<article class="match" data-match-card="' +
    esc(x.id) +
    '" data-result-score="' + esc(JSON.stringify(x.status==='LIVE'?x.liveScore||null:x.score||null)) + '"><div><button class="match-link" data-detail="' +
    esc(x.id) +
    '" aria-label="Dettagli ' +
    esc(x.home) +
    " " +
    esc(x.away) +
    '"><span data-match-status class="tiny ' +
    (x.status === "LIVE" ? "orange" : "muted") +
    '">' +
    (x.status==='LIVE'?'In corso':x.score?'Risultato finale':matchStatus(x)) +
    '</span><div class="teams">' +
    [x.home, x.away]
      .map((n,i) => '<div class="team">' + teamLabel(n,{home:i===0,vs:i===0?x.away:x.home}) + "</div>")
      .join("") +
    '</div><span class="inline-result" data-inline-result aria-live="polite">' + inlineResultView(x) + '</span></button><span class="selected-caption" data-selected-caption>' +
    (picks[x.id] ? "Scelta: " + esc(picks[x.id]) : "") +
    '</span></div><div class="choices">' +
    choicesView(x, r) +
    "</div></article>"
  );
}
function choicesView(x, r) {
  const closed = isClosed(r),
    allowed = r.pointsOnly ? ["Esito finale"] : Object.keys(groups),
    active = allowed.includes(market[x.id]) ? market[x.id] : "Esito finale";
  const labels = {
    "Esito finale": "1 X 2",
    "Doppia chance": "Doppia",
    "Under / Over 2,5": "Under/Over",
    "Goal / No Goal": "Gol/No Gol",
  };
  return (
    '<div class="market-tabs" role="tablist" aria-label="Mercati ' +
    esc(x.home + " " + x.away) +
    '">' +
    allowed
      .map(
        (g, i) =>
          '<button type="button" role="tab" id="market-tab-' +
          esc(x.id) +
          "-" +
          i +
          '" aria-controls="market-panel-' +
          esc(x.id) +
          "-" +
          i +
          '" aria-selected="' +
          (g === active) +
          '" tabindex="' +
          (g === active ? "0" : "-1") +
          '" data-market-tab="' +
          esc(x.id) +
          '" data-group="' +
          esc(g) +
          '" data-index="' +
          i +
          '">' +
          labels[g] +
          "</button>",
      )
      .join("") +
    '</div><div class="market-track" data-market-track="' +
    esc(x.id) +
    '">' +
    allowed
      .map(
        (g, i) =>
          '<section class="market-panel" ' +
          (g === active ? "" : "inert") +
          ' role="tabpanel" id="market-panel-' +
          esc(x.id) +
          "-" +
          i +
          '" aria-labelledby="market-tab-' +
          esc(x.id) +
          "-" +
          i +
          '"><div class="market-title">' +
          esc(g) +
          '</div><div class="options">' +
          groups[g]
            .map(
              (p) =>
                "<button " +
                (closed ? "disabled" : "") +
                ' data-pick="' +
                esc(x.id) +
                '" data-value="' +
                esc(p) +
                '" class="odd ' +
                (picks[x.id] === p
                  ? "selected " +
                    (predictionStatus(x, p, closed)?.className || "")
                  : "") +
                '" aria-pressed="' +
                (picks[x.id] === p) +
                '" aria-label="' +
                esc(x.home + " – " + x.away + ": " + p) +
                '"><b>' +
                p.replace(" 2.5", " 2,5") +
                "</b><span>" +
                (r.pointsOnly
                  ? "1 punto"
                  : Number.isFinite(x.odds?.[p])
                    ? fmt(x.odds[p]) + (x.oddsEstimated?.[p] ? " · stima" : "")
                    : "in arrivo") +
                "</span>" +
                ((r.slip?.picks?.[x.id] === p
                  ? r.slip.pointTerms?.[x.id]
                  : null) || x.pointOffers?.[p]
                  ? '<small class="point-caption">+' +
                    fmt(
                      (
                        (r.slip?.picks?.[x.id] === p
                          ? r.slip.pointTerms?.[x.id]
                          : null) || x.pointOffers?.[p]
                      ).correct,
                    ) +
                    " / " +
                    fmt(
                      (
                        (r.slip?.picks?.[x.id] === p
                          ? r.slip.pointTerms?.[x.id]
                          : null) || x.pointOffers?.[p]
                      ).wrong,
                    ) +
                    " pt</small>"
                  : "") +
                "</button>",
            )
            .join("") +
          "</div></section>",
      )
      .join("") +
    "</div>" +
    (allowed.length > 1
      ? '<p class="market-swipe-hint tiny muted">Scorri ↔ per cambiare giocata</p>'
      : '<span class="pill">SOLO PUNTI</span>') +
    "<div data-pick-feedback>" +
    predictionFeedback(x, picks[x.id], closed) +
    "</div>"
  );
}
function ticketView(l, r, m) {
  const d = slipSummary(r, picks, stake, m.credits);
  return (
    '<div class="eyebrow">IL TUO PIANO INFALLIBILE</div><h3>Rivedi e conferma</h3><div class="row"><span>Pronostici</span><b data-ticket-count>' +
    d.count +
    " / " +
    d.total +
    '</b></div><div class="progress"><i data-ticket-progress style="width:' +
    (d.total ? (d.count / d.total) * 100 : 0) +
    '%"></i></div><p class="slip-state" data-slip-status>' +
    d.status +
    "</p>" +
    (r.pointsOnly
      ? '<p class="muted">Un punto per ogni esito corretto. Nessun credito impegnato. Classifica separata per questa competizione.</p>'
      : '<div class="row"><span>Quota totale' +
        (r.virtualBookmaker ? " · virtuale" : "") +
        '</span><b id="total-odds">' +
        (d.odds === null ? "—" : fmt(d.odds)) +
        '</b></div><label class="field">Puntata in crediti<input id="stake" type="number" min="1" step="0.01" max="' +
        (r.rules || l.rules).maxStake +
        '" value="' +
        stake +
        '" ' +
        (d.closed ? "disabled" : "") +
        '></label><div class="tiny muted">Massimo ' +
        (r.rules || l.rules).maxStake +
        ' crediti</div><hr><span class="tiny muted">Ritorno potenziale · puntata inclusa</span><div class="money" id="potential">' +
        (d.potential === null ? "—" : fmt(d.potential)) +
        "</div>") +
    '<p id="save-hint" class="muted tiny">' +
    summaryHint(d) +
    '</p><button class="primary full" id="save" ' +
    (!d.canSave || busy || offline || !!draftConflict ? "disabled" : "") +
    ">" +
    (busy
      ? "Salvataggio…"
      : d.closed
        ? "Schedina chiusa"
        : r.slip
          ? "Conferma modifiche"
          : "Conferma schedina") +
    '</button><p class="ticket-note" id="draft-note">' +
    (draftWarning
      ? "Bozza non salvata: lo spazio del dispositivo non è disponibile."
      : "La bozza resta su questo dispositivo. Partecipa solo la schedina confermata.") +
    "</p>" +
    (r.slip
      ? '<p class="tiny muted">Ultimo invio: ' + date(r.slip.savedAt) + "</p>"
      : "")
  );
}
function summaryHint(d) {
  return d.closed
    ? "Le scelte sono bloccate."
    : !d.validStake
      ? "Controlla puntata, limite e crediti disponibili."
      : d.count < d.total
        ? "Mancano " + (d.total - d.count) + " pronostici."
        : d.missing
          ? "Puoi confermare anche con quote in arrivo."
          : "Tutto pronto. Conferma per partecipare.";
}
function updateSlipUI() {
  const r = R(),
    m = me();
  if (!r || !m) return;
  const d = slipSummary(r, picks, stake, m.credits);
  document
    .querySelectorAll("[data-slip-status]")
    .forEach((e) => (e.textContent = d.status));
  if ($("#dock-count"))
    $("#dock-count").textContent = d.count + "/" + d.total + " scelte";
  if ($("#dock-status")) $("#dock-status").textContent = d.status;
  if ($("#selection-count"))
    $("#selection-count").textContent = d.count + " / " + d.total + " scelte";
  document
    .querySelectorAll("[data-ticket-count]")
    .forEach((e) => (e.textContent = d.count + " / " + d.total));
  document
    .querySelectorAll("[data-ticket-progress]")
    .forEach(
      (e) => (e.style.width = (d.total ? (d.count / d.total) * 100 : 0) + "%"),
    );
  if ($("#total-odds"))
    $("#total-odds").textContent = d.odds === null ? "—" : fmt(d.odds);
  if ($("#potential"))
    $("#potential").textContent = d.potential === null ? "—" : fmt(d.potential);
  if ($("#save-hint")) $("#save-hint").textContent = summaryHint(d);
  if ($("#stake")) $("#stake").disabled = d.closed || busy;
  if ($("#save")) {
    $("#save").disabled = !d.canSave || busy || offline || !!draftConflict;
    $("#save").textContent = busy
      ? "Salvataggio…"
      : d.closed
        ? "Schedina chiusa"
        : r.slip
          ? "Conferma modifiche"
          : "Conferma schedina";
  }
  if ($("#draft-note"))
    $("#draft-note").textContent = draftWarning
      ? "Bozza non salvata: lo spazio del dispositivo non è disponibile."
      : "La bozza resta su questo dispositivo. Partecipa solo la schedina confermata.";
}
async function saveCurrentSlip() {
  const r = R();
  if (
    busy ||
    offline ||
    draftConflict ||
    !slipSummary(r, picks, stake, me().credits).canSave
  )
    return;
  const key = viewKey,
    payload = {
      league: L().id,
      round: r.id,
      picks: structuredClone(picks),
      stake: r.pointsOnly ? 0 : stake,
      baseSavedAt: editBaseSavedAt,
    };
  busy = true;
  updateSlipUI();
  try {
    const result=await api("slip",payload);
    notify("Schedina ricevuta ✓ · aggiorniamo il saldo");
    try {
      localStorage.removeItem(key);
    } catch {}
    const ok=applyAcknowledgedSlip(result)?(markPublicSlipChoices(),hydrateDraft(),render(),true):Array.isArray(result?.state?.leagues)||Array.isArray(result?.leagues)?(state=result.state||result,markPublicSlipChoices(),render(),true):await refresh(true);
    notify(
      ok
        ? "Schedina confermata. Ora puoi iniziare a dubitare."
        : "Invio riuscito. Ricarica per verificare lo stato aggiornato.",
    );
  } catch (e) {
    notify(e.message);
    if (e.status === 409) await refresh(true);
  } finally {
    busy = false;
    updateSlipUI();
  }
}

function matchStatus(m) {
  if (m.source === "fantacalcio")
    return m.score
      ? "FINALE · " +
          m.score.join(" – ") +
          (m.fantasyPoints ? " · " + m.fantasyPoints.join(" – ") + " fp" : "")
      : "In attesa del calcolo";
  if (m.score && m.status !== "LIVE") return "FINALE · " + m.score.join(" – ");
  if (m.status === "LIVE")
    return (
      "LIVE · " +
      (m.liveScore ? m.liveScore.join(" – ") : "in corso") +
      (m.clock ? " · " + esc(m.clock) : " · minuto non disponibile")
    );
  if (m.kickoff && new Date(m.kickoff) < new Date())
    return "Risultato in aggiornamento";
  return m.kickoff ? date(m.kickoff) : "Orario da definire";
}
function ranking(l){return playerRanking(l,'seriea',tab,state.user,esc,fmt);}
function adminBudget() { return ""; }
function profile({embedded=false}={}) {
  const u = state.user,
    required = !u.emailVerified && !u.demo;
  return `${nicknameNotice(u,{profile:true})}${embedded?'':'<section class="hero"><h1>Impostazioni</h1></section>'}${required ? '<div class="notice" role="status">Per continuare devi inserire e confermare un indirizzo email. Punti, crediti e schedine restano salvati.</div>' : ""}${renderAppInvite()}${embedded?'<section class="profile-account profile-embedded">':'<details class="card profile-account" '+(required?'open':'')+'><summary>I tuoi dati e sicurezza</summary>'}<div class="split"><div class="card"><h3>I tuoi dati</h3>${u.username?`<p class="muted">Username del vecchio account: <b>${esc(u.username)}</b></p>`:""}<p class="muted">Email: ${esc(u.email || "Non inserita")}</p><p class="${u.emailVerified ? "green" : "orange"}">${u.emailVerified ? "✓ Email verificata" : "Email da verificare"}</p>${u.pendingEmail ? `<p class="muted">Conferma in attesa: ${esc(u.pendingEmail)}</p>` : ""}<form id="profile-name"><label class="field">Soprannome<input name="name" value="${esc(u.name)}" required maxlength="60"></label><button class="secondary">Salva soprannome</button></form></div><form id="account-email" class="card"><h3>${required ? "Attiva il tuo account" : "Email e sicurezza"}</h3><label class="field">Email<input name="email" type="email" required maxlength="254" autocomplete="email" value="${esc(u.pendingEmail || u.email || "")}"></label><label class="field">Password attuale<input name="password" type="password" required maxlength="200" autocomplete="current-password"></label><button class="primary">Invia conferma email</button><p class="tiny muted">Apri il link ricevuto, poi torna qui. Premi Aggiorna dopo aver confermato.</p>${u.pendingEmail || (u.email && !u.emailVerified) ? '<button type="button" class="secondary" id="resend-profile">Reinvia conferma</button>' : ""}</form></div>${embedded?'</section>':'</details>'}${!required?(embedded?'<section class="profile-reminder-settings profile-embedded"><h3>Avvisi e promemoria</h3>':'<details class="card profile-reminder-settings"><summary>Avvisi e promemoria</summary>')+'<section class="card profile-alerts"><h2>Il bar ti chiama</h2><label class="reminder-toggle"><input id="reminder-preference" type="checkbox" '+(u.remindersEnabled!==false?'checked':'')+'><span>Promemoria schedina · due ore prima</span></label><p class="tiny muted">Un avviso sul dispositivo per ogni lega prima della chiusura, anche se hai già salvato.'+(L()?' Notifiche sul telefono dopo il tuo consenso.</p><button type="button" class="secondary" id="enable-device-alerts">Attiva avvisi su questo dispositivo</button>':'</p>')+'</section>':''}${!required&&!u.demo?'<section class="card profile-email-reminders"><label class="reminder-toggle"><input id="email-reminder-preference" type="checkbox" '+(u.emailRemindersEnabled?'checked':'')+'><span>Ricevi avvisi via mail se ho dimenticato di inserire la schedina</span></label><p class="tiny muted">Una sola email a un’ora dalla chiusura, solo se manca la schedina. Niente pubblicità, niente newsletter. Puoi disattivarla anche dal link nell’email.</p></section>':''}${!required?(embedded?'</section>':'</details>'):''}${!required && state.user?.emailVerified && !state.user.demo ? supportSection() : ""}<div data-account-privacy></div>${embedded?'':settingsLogout()}`;
}
function updateDashboard() {
  const region = $('#league-dashboard');
  if (!region || !L() || region.contains(document.activeElement)) return;
  region.innerHTML = leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null);
  bindDashboard();
  updateObjectives();
  bindStyledSelects(region);
}
function showGoal(target,index){
 const tokens=[...target.querySelectorAll('[data-goal]')],panels=[...target.querySelectorAll('[data-goal-panel]')];
 tokens.forEach((t,i)=>{const on=i===index;t.classList.toggle('is-open',on);t.setAttribute('aria-expanded',String(on));});
 panels.forEach((p,i)=>{p.hidden=i!==index;});
 if(index===null||index<0)delete target.dataset.openGoal;else target.dataset.openGoal=String(index);
}
function updateObjectives(){const target=$('#league-objectives');if(!target||!L())return;const competition=dashboardSource==='fantacalcio'?$('.league-dashboard')?.dataset.selectedCompetition||dashboardCompetition:null;const html=achievementBoard(L(),esc,dashboardSource,competition,{calendar:state.calendar});if(target.dataset.objectivesHtml===html)return;const open=target.dataset.openGoal===undefined?-1:Number(target.dataset.openGoal);const scroll=target.querySelector('.goal-rail')?.scrollLeft||0;target.innerHTML=html;target.dataset.objectivesHtml=html;const rail=target.querySelector('.goal-rail');if(rail)rail.scrollLeft=scroll;if(open>=0)showGoal(target,open);}
function bindObjectives(){
 const target=$('#league-objectives');if(!target)return;
 target.onclick=e=>{const token=e.target.closest('[data-goal]');if(!token)return;const i=Number(token.dataset.goal);showGoal(target,target.dataset.openGoal===String(i)?-1:i);};
}
function bindDashboard() {
  document.querySelectorAll('[data-dashboard-source]').forEach(b=>b.onclick=()=>{
    dashboardSource=b.dataset.dashboardSource;
    const region=$('#league-dashboard');
    region.innerHTML=leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null);
    bindDashboard();
  updateObjectives();
    bindStyledSelects(region);
    region.querySelector(`[data-dashboard-source="${dashboardSource}"]`)?.focus({preventScroll:true});
  });
  const competition=$('#dashboard-competition');if(competition)competition.onchange=()=>{dashboardCompetition=competition.value;updateDashboardSelection();};
  document.querySelectorAll('#league-dashboard [data-page]').forEach(b=>b.onclick=()=>{void navigatePage(b.dataset.page);});
  const changeSource=()=>{
    persistDraft(); sourceScope=dashboardSource; selectedRoundId=null;
    competitionScope=sourceScope==='fantacalcio'?$('.league-dashboard')?.dataset.selectedCompetition||null:null;
  };
  document.querySelectorAll('[data-dashboard-rank]').forEach(b=>b.onclick=()=>{
    changeSource(); tab=b.dataset.dashboardRank; rankingScope=sourceScope==='fantacalcio'?'bet:'+fantasyGroup(L(),competitionScope)?.key:'league'; page='classifiche'; hydrateDraft(); render(); window.scrollTo(0,0);
  });
  document.querySelectorAll('[data-dashboard-slip]').forEach(b=>b.onclick=()=>{
    const targetRound=L().rounds.find(x=>x.id===b.dataset.dashboardSlip);if(targetRound?.source==='fantacalcio'){openNativeSlips();return;}
    changeSource(); const round=L().rounds.find(x=>x.id===b.dataset.dashboardSlip);
    if(round){sourceScope=sourceOf(round);selectedRoundId=round.id;competitionScope=round.competitionKey||null;}
    slipScope='mine';page='schedina';writeAppRoute({mode:'bar',page:'schedina',league:L()?.id,round:selectedRoundId});hydrateDraft();render();window.scrollTo(0,0);
  });
  const avatar=$('[data-open-quasi-studio]');
  if(avatar)avatar.onclick=()=>{void openStudio();};
  bindObjectives();
}
function updateDashboardSelection(){const region=$('#league-dashboard');region.innerHTML=leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null);bindDashboard();updateObjectives();bindStyledSelects(region);region.querySelector('#dashboard-competition')?.parentElement.querySelector('[role=combobox]')?.focus({preventScroll:true});}
async function openStudio(initialReward){persistDraft();const {openQuasiStudio}=await loadStudio();openQuasiStudio({initialReward:typeof initialReward==='string'?initialReward:undefined,user:state.user,api,onSaved:avatar=>{state.user.avatar=avatar;for(const league of state.leagues){const member=league.members.find(m=>m.uid===state.user.id);if(member)member.avatar=avatar;}render();notify('Il tuo Quasi è pronto.');}});}
let rewardRevealOpen=false;
// Quando arriva un premio nuovo (dopo la prima visita) lo mostriamo, con scorciatoia per indossarlo.
function maybeRevealRewards(){
 try{
  if(rewardRevealOpen||!state.user||!document.body?.append)return;
  const awards=state.user.rewards||[];if(!awards.length)return;
  const key='qdq:rewards-seen:'+state.user.id,seen=localStorage.getItem(key);
  const latest=Math.max(...awards.map(a=>Date.parse(a.earnedAt)||0));
  if(seen===null){localStorage.setItem(key,String(latest));return;}
  const fresh=awards.filter(a=>(Date.parse(a.earnedAt)||0)>Number(seen));
  if(!fresh.length)return;
  localStorage.setItem(key,String(latest));
  const ids=[...new Set(fresh.flatMap(a=>a.ids))].map(rewardById).filter(Boolean);
  if(!ids.length)return;
  const shown=ids.slice(0,3),first=shown[0],reason=fresh[fresh.length-1];
  const d=document.createElement('dialog');d.className='reward-reveal';d.setAttribute('aria-label','Nuovo premio');
  d.innerHTML='<div class="reward-reveal-card rarity-'+first.rarity+'"><span class="eyebrow">'+(ids.length>1?'NUOVI PREMI':'NUOVO PREMIO')+'</span><h2>'+(ids.length>1?'Il bottino è arrivato.':'Hai vinto qualcosa.')+'</h2><ul>'+shown.map(r=>'<li class="rarity-'+r.rarity+'">'+rewardMark(r)+'<div><strong>'+esc(r.name)+'</strong><small>'+esc(rarityLabel[r.rarity])+' · '+esc(REWARD_TYPES[r.type])+'</small></div></li>').join('')+'</ul>'+(ids.length>3?'<p class="tiny muted">…e altri '+(ids.length-3)+' nel guardaroba.</p>':'')+'<p class="tiny muted">'+esc(reason.title+' · '+reason.competitionName)+'</p><div class="reward-reveal-actions"><button type="button" class="primary" data-reveal-wear>Indossalo ora</button><button type="button" class="secondary" data-reveal-later>Più tardi</button></div></div>';
  document.body.append(d);rewardRevealOpen=true;
  const close=()=>{d.close();d.remove();rewardRevealOpen=false;};
  d.querySelector('[data-reveal-later]').onclick=close;d.addEventListener('cancel',close);
  d.querySelector('[data-reveal-wear]').onclick=()=>{close();void openStudio(first.id);};
  d.showModal();
 }catch{rewardRevealOpen=false;}
}
function fantasyNudge(){return '';}

function settings(l,r){
 return (isLeagueAdmin(l,state.user.id)?presidentTodos(barPresidentTasks(l)):'')+randomLeagueControls(l,state.user)+'<div id="league-dashboard">'+leagueDashboard(l,state.user,'seriea',false,esc,fmt,null)+'</div>'+barHomeInvite(l,state.user,esc)+fantasyNudge(l)+'<div id="league-objectives">'+achievementBoard(l,esc,dashboardSource,dashboardCompetition,{calendar:state.calendar})+'</div>';
}
let presidentGroup=null;
function barRulesForm(l){return `<form id="rules"><h3>Le regole del bar</h3><p class="muted">La modalità ponderata distingue gli esiti secchi dalle doppie chance. Le giornate già create conservano le proprie regole.</p><button type="button" class="secondary" id="balanced-rules">Ripristina ponderazione automatica</button>${adminBudget()}<div class="notice">Crediti iniziali per i nuovi iscritti. Le regole aggiornate si applicano alle giornate acquisite successivamente; le giornate già create mantengono le proprie regole.</div>${[
            ["initial", "Crediti iniziali"],
            ["maxStake", "Puntata massima"],
          ]
            .map(
              ([k, t]) =>
                `<label class="field">${t}<input name="${k}" type="number" step="0.25" value="${l.rules[k]}" required></label>`,
            )
            .join(
              "",
            )}<fieldset data-classic-points ${l.rules.mode === "classic" ? "" : "hidden"}><label class="field">Punti esito corretto<input name="correct" type="number" step="0.25" value="${l.rules.correct}" required></label><label class="field">Punti esito sbagliato<input name="wrong" type="number" step="0.25" value="${l.rules.wrong}" required></label></fieldset><label class="field">Modalità punti<select name="mode"><option value="classic" ${l.rules.mode === "classic" ? "selected" : ""}>Classica</option><option value="weighted" ${l.rules.mode === "weighted" ? "selected" : ""}>Ponderata</option></select></label><p class="tiny muted" data-auto-points ${l.rules.mode === "classic" ? "hidden" : ""}>Ponderazione automatica: 1/X/2 valgono +1 se corretti e −0,5 se sbagliati, dalle prossime giornate. Gli altri esiti hanno premi e penalità secondo la probabilità, a passi di 0,25 e fino a −2: i valori vengono mostrati sulle partite e fissati alla conferma.</p><label class="field"><span><input type="checkbox" name="points" ${l.rules.winners.includes("points") ? "checked" : ""}> Premia primo per punti</span></label><label class="field"><span><input type="checkbox" name="credits" ${l.rules.winners.includes("credits") ? "checked" : ""}> Premia primo per crediti</span></label><button class="primary">Salva regole</button></form>`;}
function barMembers(l){return '<ul class="bar-members">'+l.members.map(m=>'<li><span>'+esc(m.name)+'</span>'+(m.uid===l.admin?'<small>Presidente</small>':'')+'</li>').join('')+'</ul>';}
const HUB_ICON={gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',people:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 11a3 3 0 1 0 0-6M21 20c0-2.6-1.7-4.8-4-5.6"/>',rules:'<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6"/>',invite:'<path d="M4 12l16-8-6 16-3-6z"/>',chat:'<path d="M4 5h16v11H9l-5 4z"/>'};
const hubIcon=k=>'<span class="lega-tile-icon" aria-hidden="true"><svg viewBox="0 0 24 24">'+HUB_ICON[k]+'</svg></span>';
// Lega del Bar: una schermata a riquadri. Stessi pulsanti e destinazioni di prima.
function barLeagueInfo(l){
 const admin=isLeagueAdmin(l,state.user.id),tasks=admin?barPresidentTasks(l).length:0;
 const rules=(l.rules?.mode==='classic'?'Classica':'Ponderata')+(Number.isFinite(Number(l.rules?.maxStake))?' · max '+fmt(Number(l.rules.maxStake))+' cr':'');
 return '<section class="hero lega-hub-head" data-os-header><span class="eyebrow">LA TUA LEGA</span><h1>'+esc(l.name)+'</h1><p>'+l.members.length+' al bancone</p></section><div data-os-content><div class="lega-hub">'+
  (admin?'<button type="button" class="lega-tile is-admin" data-bar-page="admin">'+hubIcon('gear')+'<b>Pannello del presidente</b><small>'+(tasks?tasks+(tasks===1?' cosa da fare':' cose da fare'):'Tutto in ordine')+'</small></button>':'')+
  '<details class="lega-tile lega-tile-members"><summary>'+hubIcon('people')+'<b>Partecipanti · '+l.members.length+'</b><small>Chi è al bancone</small></summary>'+barMembers(l)+'</details>'+
  '<button type="button" class="lega-tile" data-bar-page="regolamento">'+hubIcon('rules')+'<b>Regolamento del Bar</b><small>'+esc(rules)+'</small></button>'+
  (l.code?'<button type="button" class="lega-tile" id="league-share-invite">'+hubIcon('invite')+'<b>Invita nella tua lega</b><small>Condividi l’invito</small></button>':'')+
  '<button type="button" class="lega-tile" id="league-open-chat">'+hubIcon('chat')+'<b>Chiacchiere da bar</b><small>Apri la chat della lega</small></button>'+
  '</div>'+leagueActions()+'</div>';
}
function leagueAdmin(l){
 const admin=isLeagueAdmin(l,state.user.id);
 const color=LEAGUE_COLORS.find(([v])=>v===l.branding?.accent)?.[1]||LEAGUE_COLORS[0][1];

 return presidentPanel({mode:'bar',open:presidentGroup,footer:settingsLogout(),tasks:admin?barPresidentTasks(l):[],groups:{
 persone:{summary:l.members.length+' membri · inviti'+(admin?' e premi':''),html:'<section class="president-invite"><h2>Invita nella tua lega</h2>'+(l.code?'<div class="money">'+esc(l.code)+'</div><div class="league-invite-actions"><button class="secondary" id="copy">Copia codice</button>'+whatsappInvite(l,esc)+'<button type="button" class="secondary" data-president-copy-link>Copia link</button></div>':'<p>Invito non disponibile.</p>')+'</section>'+(admin?leagueMembers(l,true):barMembers(l))},
 regole:{summary:(l.rules.mode==='weighted'?'Ponderata':'Classica')+' · '+l.rules.initial+' cr iniziali · max '+l.rules.maxStake,html:admin?barRulesForm(l):'<button type="button" class="secondary" data-bar-page="regolamento">Leggi il regolamento</button>'},
 ...(admin?{
 identita:{summary:'Simbolo '+(l.branding?.emblem||'Q')+' · '+color,html:brandingForm(l)}
 }:{}),
 account:{summary:'Soprannome, email, avvisi e assistenza',html:profile({embedded:true})},
 ...(l.admin===state.user.id&&state.user.emailVerified&&!state.user.demo?{elimina:{summary:'Bar, Fanta e storico',html:'<form id="president-delete-league"><p>Eliminerai definitivamente <b>'+esc(l.name)+'</b>, il suo Bar, il Fanta collegato e lo storico di gioco. Gli account dei partecipanti restano attivi.</p><label class="field">Scrivi <strong>ELIMINA LEGA E STORICO</strong><input name="phrase" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label><button class="secondary league-delete-action" disabled>Elimina la lega</button><p role="alert"></p></form>'}}:{})
 }});
}

function calendarStatus(m) {
  if(m.status==='LIVE')return 'LIVE · '+(m.liveScore?.join(' – ')||'—')+(m.clock?' · '+m.clock:'');
  return m.status === "FT" && m.score
    ? m.score.join(" – ")
    : m.kickoff
      ? date(m.kickoff)
      : "Da disputare";
}
function openBarRules(){
  const view=openMatchPage({label:'Regolamento del Bar'});
  view.classList.add('bar-rules-page');
  view.innerHTML='<button type="button" class="secondary rule-close" id="close-modal">← Chiudi regolamento</button>'+regulation(L(),R());
  view.querySelector('.rule-close').onclick=()=>view.close();
}
function regulation(l, r) {
  const rules = r?.rules ||
    l?.rules || {
      initial: 500,
      maxStake: 20,
      correct: 1,
      wrong: -1,
      mode: "classic",
      marketPoints: {
        1: 1,
        X: 1,
        2: 1,
        "1X": 0.25,
        12: 0.25,
        X2: 0.25,
        Goal: 0.5,
        "No Goal": 0.5,
        "Under 2.5": 0.5,
        "Over 2.5": 0.5,
      },
      winners: ["points", "credits"],
    };
  const markets = [
    ["1", "Vince la squadra di casa"],
    ["X", "Pareggio"],
    ["2", "Vince la squadra ospite"],
    ["1X", "Casa o pareggio"],
    ["12", "Vince una delle due squadre"],
    ["X2", "Pareggio o ospite"],
    ["Goal", "Entrambe segnano almeno un gol"],
    ["No Goal", "Almeno una squadra non segna"],
    ["Under 2.5", "Al massimo 2 gol totali"],
    ["Over 2.5", "Almeno 3 gol totali"],
  ];
  return `<section class="hero"><div class="eyebrow">PRIMA LE REGOLE, POI LE SCUSE</div><h1>IL REGOLAMENTO.<br><em>IL VAR NON ACCETTA RECLAMI.</em></h1><p>Una schedina completa, due classifiche e la consueta fiducia mal riposta nel novantesimo.</p></section><div class="rule-grid"><article class="card"><h3>1. Entra nella lega</h3><p>Registrati con email e password, poi attiva l’account dal link ricevuto via email. Crea una lega oppure usa il codice di invito. Chi crea la lega ne è l’amministratore.</p><p>Si gioca solo con crediti virtuali, senza acquisti o premi in denaro. La dotazione iniziale prevista dalle regole ${r ? "della giornata selezionata" : "attuali"} è <b>${fmt(rules.initial)} crediti</b>.</p></article><article class="card"><h3>2. Compila tutta la schedina</h3><p>Scegli <b>un solo pronostico per ciascuna partita</b> della giornata. Devi completarli tutti prima di salvare. La puntata minima è 1 credito; il massimo è <b>${fmt(rules.maxStake)} crediti</b>.</p><p>Puoi salvare già ora le giornate future e modificare scelte e puntata fino al calcio d’inizio della prima partita della giornata. Da quel momento tutte le scelte si bloccano, anche per le partite successive.</p></article><article class="card rule-wide"><h3>3. Scegli il tuo grado di ottimismo</h3><p>Gli esiti si riferiscono ai tempi regolamentari, recupero incluso. Under/Over usa la soglia di 2,5 gol.</p><table class="rule-table"><thead><tr><th>Esito</th><th>Quando è corretto</th><th>Punti se corretto</th></tr></thead><tbody>${markets.map(([p, t]) => `<tr><td><b>${p.replace("2.5", "2,5")}</b></td><td>${t}</td><td>${["difficulty-v1","difficulty-v2"].includes(rules.scoring) && !["1", "X", "2"].includes(p) ? "Variabile · vedi la partita" : fmt(rules.scoring==="difficulty-v2"&&["1","X","2"].includes(p)?1:rules.mode==="classic"?rules.correct:(rules.marketPoints?.[p]??1))}</td></tr>`).join("")}</tbody></table><p class="tiny muted">Modalità ${rules.mode === "classic" ? "classica: ogni esito corretto vale lo stesso punteggio." : "ponderata: i punteggi corretti dipendono dal mercato scelto."} ${["difficulty-v1","difficulty-v2"].includes(rules.scoring) ? "Doppie chance, Goal/No Goal e Under/Over hanno premi e penalità basati sulla probabilità delle quote, senza margine bookmaker, a passi di 0,25: una scelta più probabile rende meno e costa di più se sbagliata, fino a −2. I valori sono mostrati su ogni scelta e fissati alla conferma. Senza quote si usa una probabilità di base dichiarata." : "Ogni pronostico sbagliato vale " + fmt(rules.wrong) + " punti."} Le impostazioni dell’amministratore prevalgono sui valori predefiniti.</p></article><article class="card"><h3>4. Quote: arrivano anche dopo di te</h3><p>Puoi salvare la schedina anche senza quote. Dove mancano vedrai “in arrivo”: compariranno automaticamente, insieme alla vincita potenziale, senza modificare i tuoi pronostici.</p><p>Le quote reali sono la media di almeno due bookmaker, arrotondata a due decimali e congelata alla prima acquisizione. Dopo ogni recupero, se la giornata ha già quote reali ma ne manca qualcuna, quelle assenti vengono completate subito. In ogni caso da 72 ore prima della prima partita della giornata, con orari confermati, le quote ancora mancanti sono sostituite da stime del rendimento stagionale: gol fatti e subiti, medie del campionato, fattore campo e modello di Poisson con margine del 5%. Con pochi dati il modello usa maggiormente le medie di campionato. Ogni stima è etichettata, congelata alla pubblicazione e valida per tutti: non viene sostituita dalle quote arrivate dopo. Si può compilare e salvare anche prima. Se gli orari vengono confermati o anticipati tardivamente, non è possibile garantire retroattivamente le 72 ore.</p></article><article class="card"><h3>5. Crediti: serve la perfezione</h3><p>La puntata viene scalata al salvataggio; se la modifichi viene addebitata o restituita soltanto la differenza. Vinci crediti soltanto se indovini tutti gli esiti validi.</p><p><b>Ritorno lordo = puntata × prodotto delle quote.</b> Comprende la puntata iniziale. Esempio: 10 crediti × quota totale 12 = 120 crediti accreditati, con guadagno netto di 110. Se sbagli anche una sola partita non ricevi crediti, ma partecipi comunque alla classifica punti.</p></article><article class="card"><h3>6. Punti: anche quasi conta</h3><p>I punti si sommano partita per partita, indipendentemente dalla vincita in crediti. Con i valori predefiniti, 9 pronostici corretti e 1 sbagliato valgono <b>${fmt(9*pointTerms({},"1",rules).correct+pointTerms({},"1",rules).wrong)} punti</b> (9 × ${fmt(pointTerms({},"1",rules).correct)} ${pointTerms({},"1",rules).wrong<0?"−":"+"} ${fmt(Math.abs(pointTerms({},"1",rules).wrong))}).</p><p>La giornata selezionata usa ${rules.mode === "classic" ? `+${fmt(rules.correct)} per ogni esito corretto` : "i valori per mercato indicati nella tabella"} ${["difficulty-v1","difficulty-v2"].includes(rules.scoring) ? "con la penalità indicata per la scelta confermata" : "e " + fmt(rules.wrong) + " per ogni errore"}. Nessuna schedina salvata significa nessuna puntata e nessun punto per quella giornata.</p></article><article class="card"><h3>7. Risultati e casi particolari</h3><p>Nella schedina bloccata il pronostico scelto diventa verde se vincente sul punteggio attuale e rosso se perdente. Finché si gioca il colore è provvisorio e può cambiare. Il live è provvisorio. I punteggi e i crediti vengono assegnati automaticamente solo quando tutte le partite valide della giornata sono finite e i risultati sono confermati dal fornitore finale. Gol e cartellini sono consultabili nei dettagli, quando disponibili.</p><p>Una partita rinviata resta in attesa. Se un evento viene annullato e marcato nullo non assegna punti e pesa quota 1. Se tutti gli eventi sono nulli la puntata viene restituita. Se mancano quote di una schedina interamente corretta, i crediti restano in attesa: non si inventano moltiplicatori.</p></article><article class="card rule-wide"><h3>8. La gloria, in due classifiche</h3><p>Tutti i membri vedono la classifica punti e quella dei crediti residui. Il bilancio personale è la differenza fra crediti residui e dotazione iniziale. A pari merito la posizione è condivisa.</p><p><b>Vincitori previsti:</b> ${(rules.winners || []).map((w) => (w === "points" ? "primo in classifica punti" : w === "credits" ? "primo in classifica crediti" : esc(w))).join(" · ") || "da definire dall’amministratore"}.</p><p>L’amministratore può configurare dotazione, puntata massima, punti per esito e categorie dei vincitori. La nuova ponderazione aggiorna i default della lega e le giornate ancora aperte. Le giornate chiuse mantengono i propri punteggi; premi e penalità di ogni pronostico sono fissati alla conferma.</p><p class="tiny muted">${r ? "Valori mostrati: " + esc(r.title) + ". Puoi cambiare giornata dalla schedina." : "Valori mostrati: impostazioni attuali della lega."} Stemmi e nomi delle squadre appartengono ai rispettivi titolari e sono usati per identificarle; nessuna affiliazione è implicita.</p></article></div>`;
}
function calendarPage() {return serieACalendarPage();}

function renderCalendarSections(rounds, draw) {
  return calendarSections(rounds, state.calendar)
    .map((section) =>
      section.kind === "past"
        ? '<details class="calendar-past"><summary>Giornate precedenti · ' +
          section.rounds.length +
          "</summary>" +
          section.rounds.map((r) => draw(r, false)).join("") +
          "</details>"
        : '<section class="calendar-block"><h2>' +
          section.label +
          "</h2>" +
          section.rounds
            .map((r) => draw(r, section.kind === "current"))
            .join("") +
          "</section>",
    )
    .join("");
}
function serieACalendarPage() {
  const c = state.calendar;
  if (!c)
    return '<div class="card">Calendario ufficiale disponibile nella versione Netlify.</div>';
  return `<section class="hero"><div class="eyebrow">SERIE A · ${c.season}/${String(c.season + 1).slice(-2)}</div><h1>38 GIORNATE.<br><em>380 POSSIBILI SCUSE.</em></h1><p>Date, partite e risultati.</p></section>${renderCalendarSections(
    c.rounds,
    (r, focus) =>
      `<details class="card" ${focus ? "open" : ""}><summary style="cursor:pointer;font:600 24px Barlow Condensed">Giornata ${r.number} <span class="muted tiny">· ${r.matches.every((m) => m.status === "FT" && m.score) ? "Conclusa" : r.date.split("-").reverse().join("/")}</span></summary>${groupMatches(
        r.matches,
      )
        .map(
          (day) =>
            `<h3 class="day-heading">${esc(day.label)}</h3>${day.matches.map((m) => `<button class="row match-link full calendar-fixture" data-detail="${m.id}" style="border-bottom:1px solid var(--line);padding:12px 0"><span>${fixtureTeams(m.home, m.away)}</span><span class="${m.status === "FT" && m.score ? "green" : "muted"} tiny">${calendarStatus(m)}</span></button>`).join("")}`,
        )
        .join("")}</details>`,
  )}`;
}
let supportPosition = null;
try {
  const pos = JSON.parse(localStorage.getItem("quasiChatPosition"));
  if (pos && Number.isFinite(pos.x) && Number.isFinite(pos.y))
    supportPosition = pos;
} catch {}
function bindSupportDrag() {
  const button = $("#open-chat");
  if (!button?.addEventListener||button.dataset.chatDragBound) return;
  button.dataset.chatDragBound='true';
  let drag = null,
    suppressClick = false;
  const place = () => {
    if (!supportPosition || !button.isConnected) return;
    const nav = $(".v2-slipbar") || $(".v2-tabbar") || $(".bottom-nav"),
      bounds = nav?.getBoundingClientRect(),
      w = button.offsetWidth,
      h = button.offsetHeight;
    const maxX = Math.max(8, window.innerWidth - w - 8),
      maxY = Math.max(8, (bounds?.top>window.innerHeight/2?bounds.top:window.innerHeight-24) - h - 12);
    const x = Math.max(
        8,
        Math.min(maxX, supportPosition.x * window.innerWidth),
      ),
      y = Math.max(8, Math.min(maxY, supportPosition.y * window.innerHeight));
    button.style.left = x + "px";
    button.style.top = y + "px";
    button.style.right = "auto";
    button.style.bottom = "auto";
  };
  place();
  button.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    const rect = button.getBoundingClientRect();
    drag = {
      id: e.pointerId,
      x: e.clientX,
      y: e.clientY,
      left: rect.left,
      top: rect.top,
      moved: false,
    };
    suppressClick = false;
    button.setPointerCapture(e.pointerId);
  });
  button.addEventListener("pointermove", (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x,
      dy = e.clientY - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 7) return;
    drag.moved = true;
    button.classList.add("dragging");
    supportPosition = {
      x: (drag.left + dx) / window.innerWidth,
      y: (drag.top + dy) / window.innerHeight,
    };
    place();
    e.preventDefault();
  });
  const finish = (e) => {
    if (!drag || drag.id !== e.pointerId) return;
    suppressClick = drag.moved;
    if (drag.moved)
      try {
        localStorage.setItem(
          "quasiChatPosition",
          JSON.stringify(supportPosition),
        );
      } catch {}
    drag = null;
    button.classList.remove("dragging");
  };
  button.addEventListener("pointerup", finish);
  button.addEventListener("pointercancel", finish);
  button.addEventListener(
    "click",
    (e) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopImmediatePropagation();
        suppressClick = false;
      }
    },
    true,
  );
}
window.addEventListener?.("resize", () => {
  bindSupportDragPosition();
});
function bindSupportDragPosition() {
  const b = $("#open-chat");
  if (!b || !supportPosition) return;
  const nav = ($(".v2-slipbar") || $(".v2-tabbar") || $(".bottom-nav"))?.getBoundingClientRect();
  b.style.left =
    Math.max(
      8,
      Math.min(
        window.innerWidth - b.offsetWidth - 8,
        supportPosition.x * window.innerWidth,
      ),
    ) + "px";
  b.style.top =
    Math.max(
      8,
      Math.min(
        (nav?.top>window.innerHeight/2?nav.top:window.innerHeight-24) - b.offsetHeight - 12,
        supportPosition.y * window.innerHeight,
      ),
    ) + "px";
}
function navigatePage(next) {
  if(next===page)return;
  if(next==='schedina'){persistDraft();selectedRoundId=null;slipScope='mine';hydrateDraft();}
  sourceScope='seriea';dashboardSource='seriea';
  writeAppRoute({mode:'bar',page:({lega:'oggi',schedina:'schedina',classifiche:'classifica',quasi:'quasi',profilo:'profilo',regolamento:'regolamento',admin:'admin',barleague:'lega'})[next]||next,league:L()?.id});
  if (next === "chat") { openLeagueChat(); return; }
  persistDraft();
  page = next;
  // Navigation uses the authenticated snapshot already in memory. Mutations refresh
  // it explicitly; the single DB-only live channel patches results every minute.
  render();
  window.scrollTo(0, 0);
}
function nativeSlipServices(){return {
 account:{view:()=>profile({embedded:true}),bind:bindAccount},
 applyLive:data=>mergeLiveSnapshot(state,data),
 snapshot:()=>state,
 save:async(payload,{onAcknowledged}={})=>{let result;try{result=await api('slip',payload);onAcknowledged?.();}catch(error){if(error.status===409){const next=await api('state?lite=1');if(Array.isArray(next?.leagues)){state=next;markPublicSlipChoices();}}throw error;}if(applyAcknowledgedSlip(result)){markPublicSlipChoices();return;}const next=Array.isArray(result?.state?.leagues)?result.state:Array.isArray(result?.leagues)?result:await api('state?lite=1');if(!Array.isArray(next?.leagues))throw Error('Schedina inviata. Ricarica per verificarne lo stato.');state=next;markPublicSlipChoices();},
 refresh:async id=>{if(!sportsWindowActive(state.calendar?.rounds||[]))return false;const before=JSON.stringify(state.leagues.find(l=>l.id===id)?.rounds);const data=await api('live?'+new URLSearchParams({league:id}));mergeLiveSnapshot(state,data);return before!==JSON.stringify(state.leagues.find(l=>l.id===id)?.rounds);}
};}
function markPublicSlipChoices(){for(const l of state.leagues||[])for(const r of l.rounds||[])r.publicChoicesAvailable=!!r.closed&&Array.isArray(r.publicSlips);}
function openNativeSlips(target=L()){
 persistDraft();closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:target?.nativeFantaLink?.leagueId,onBar:openBarTarget,initialTab:'schedine',force:false});
}
function openBarTarget(target) {
  if(state.user?.demo&&barDemo)state=structuredClone(barDemo.state);
  if(target?.page==='logout'){void returnToLanding();return;}
  if(target?.group)presidentGroup=target.group;
  if (target?.league && state.leagues.some(l=>l.id===target.league)) {leagueId=target.league;try{localStorage.setItem('quasi-active-league:'+state.user.id,leagueId);}catch{}sourceScope='seriea';dashboardSource='seriea';competitionScope=null;selectedRoundId=null;hydrateDraft();}
  const round=target?.round && L()?.rounds.find(r=>r.id===target.round);
  if (target?.sourceScope || round) {
    sourceScope=round?sourceOf(round):target.sourceScope;
    competitionScope=round?.competitionKey||null;selectedRoundId=round?.id||null;
    slipScope='mine';hydrateDraft();
  }
  if(target?.page){page=['create-league','join-league'].includes(target.page)?'lega':target.page==='invita'?'profilo':target.page;writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page,league:L()?.id});}
  render();window.scrollTo(0,0);liveChannel.wake();if(['create-league','join-league'].includes(target?.page)){document.getElementById('v2-open-leagues')?.click();document.querySelector('[data-v2-action="'+(target.page==='join-league'?'join':'create')+'"]')?.click();}
  if(target?.page==='invita')document.querySelector('[data-app-invite]')?.scrollIntoView({block:'start'});
  if(target?.match)[...document.querySelectorAll('[data-match-card]')].find(row=>row.dataset.matchCard===target.match)?.scrollIntoView({block:'center'});
}
function bindAccount(onChanged=()=>{}) {
  if($("#edit-suggested-nickname"))$("#edit-suggested-nickname").onclick=()=>{const d=$(".profile-account");if(d)d.open=true;$("#profile-name input")?.focus();};
  if($('#email-reminder-preference'))$('#email-reminder-preference').onchange=async e=>{const enabled=e.target.checked;try{await api('profile-email-reminders',{enabled});state.user.emailRemindersEnabled=enabled;notify(enabled?'Promemoria email attivato':'Promemoria email disattivato');}catch(error){e.target.checked=!enabled;notify(error.message);}};
  if($('#reminder-preference'))$('#reminder-preference').onchange=async e=>{const enabled=e.target.checked;try{await api('profile-reminders',{enabled});state.user.remindersEnabled=enabled;notify(enabled?'Promemoria schedina attivi':'Promemoria schedina disattivati');}catch(error){e.target.checked=!enabled;notify(error.message);}};
  if($('#enable-device-alerts'))$('#enable-device-alerts').onclick=async e=>{if(state.user?.demo){notify('Nella demo gli avvisi sono simulati. Non attiviamo notifiche sul dispositivo.');return;}if(!pushSupported()){notify('Apri la PWA installata per attivare gli avvisi sul dispositivo.');return;}const permission=Notification.requestPermission();e.target.disabled=true;try{if(await permission!=='granted')throw Error('Consenso non concesso. Puoi cambiarlo nelle impostazioni del dispositivo.');await enableLeagueNotifications({league:L(),user:state.user,api});notify('Avvisi attivati su questo dispositivo');}catch(error){notify(error.message);}finally{e.target.disabled=false;}};
  if ($("#profile-name"))
    $("#profile-name").onsubmit = async (e) => {
      e.preventDefault();
      try {
        await api("profile", Object.fromEntries(new FormData(e.target)));
        await refresh(false);
        onChanged();
        notify("Profilo aggiornato");
      } catch (x) {
        notify(x.message);
      }
    };
  if ($("#resend-profile"))
    $("#resend-profile").onclick = async () => {
      try {
        const result = await api("resend-verification", {
          identity: state.user.email || state.user.username,
        });
        notify(result.message);
      } catch (x) {
        notify(x.message);
      }
    };
  if ($("#account-email"))
    $("#account-email").onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      try {
        const result = await api(
          "set-email",
          Object.fromEntries(new FormData(e.target)),
        );
        await refresh(false);
        onChanged();
        notify(result.message);
      } catch (x) {
        notify(x.message);
      } finally {
        busy = false;
      }
    };
  bindSupportInline();
  if($("#logout"))$("#logout").onclick=e=>void returnToLanding(e.currentTarget);
}
function bind(l, r) {
  bindRandomLeagues(document);
  if($('#league-share-invite'))$('#league-share-invite').onclick=()=>void shareLeagueInvite(l);
  if($('#league-open-chat'))$('#league-open-chat').onclick=()=>openLeagueChat();
  if($('#open-native-slips'))$('#open-native-slips').onclick=()=>openNativeSlips();
  const fantaSelect=document.querySelector('[data-fanta-bar-select]');if(fantaSelect)fantaSelect.onchange=e=>{persistDraft();leagueId=e.target.value;sourceScope='fantacalcio';competitionScope=null;selectedRoundId=null;hydrateDraft();render();};
  bindAppInvites();
  document.body.classList.add("v2-on");
  const v2go = (x) => {
    if(x.page==='schedina'&&x.sourceScope==='fantacalcio'){openNativeSlips(state.leagues.find(l=>l.id===x.leagueId)||L());return;}
    if (x.page === "chat") { openLeagueChat(); return; }
    if (x.leagueId || x.sourceScope && x.sourceScope !== sourceScope) {
      persistDraft();
      if(x.leagueId&&state.leagues.some(l=>l.id===x.leagueId))leagueId=x.leagueId;
      sourceScope = x.sourceScope;
      selectedRoundId = null;
      competitionScope = null;
      hydrateDraft();
    }
    void navigatePage(x.page);
  };
  bindTabBar((t) => v2go(routeForTab(t,L(),state.leagues)));
  if (state.user) bindLeagueSwitcher({ leagues: state.leagues, activeId: L()?.id, uid: state.user.id, esc,
    onSelect: (id) => { try { persistDraft(); } catch {} leagueId = id; sourceScope = defaultSource(L()); selectedRoundId = null; competitionScope = null; hydrateDraft(); try { localStorage.setItem("quasi-active-league:" + state.user.id, id); } catch {} render(); window.scrollTo(0, 0); liveChannel.wake(); },
    onSubmit: submitLeague });
  bindDashboard();
  updateObjectives();
  if (page === "quasi" && l) bindRoster(l, openStudio);
  if (page === "fantaquasi") bindFantaQuasi({ api, user: state.user, notify, onDone: () => { render(); if(page==='fantaquasi')document.querySelector('.fq-signup')?.scrollIntoView({block:'center',behavior:'smooth'}); } });
  if(state.user?.demo){
    const top=document.createElement('aside');top.className='demo-session-bar';top.setAttribute('aria-label','Modalità demo');
    top.innerHTML='<span>Stai esplorando la demo</span><button type="button" class="public-home-button">← Pagina iniziale</button>';
    top.querySelector('button').onclick=e=>void returnToLanding(e.currentTarget);document.getElementById('app').prepend(top);
  }
  bindRewards(state.user,esc,(slot,id)=>{void openStudio(id);});
  bindStyledSelects();
  document.querySelectorAll('[data-close-section]').forEach(b=>b.onclick=()=>{const d=b.closest('details');if(d){d.open=false;d.querySelector('summary')?.scrollIntoView({block:'nearest'});}});
  bindAccount();
  document.querySelectorAll("[data-live-id]").forEach(
    (d) =>
      (d.ontoggle = () => {
        if (d.open) expandedLiveMatches.add(d.dataset.liveId);
        else expandedLiveMatches.delete(d.dataset.liveId);
      }),
  );
  bindSupportDrag();
  document.querySelectorAll("[data-slip-scope]").forEach(
    (b) =>
      (b.onclick = () => {
        if(slipScope===b.dataset.slipScope)return;
        persistDraft();selectedRoundId=r?.id||null;slipScope = b.dataset.slipScope;hydrateDraft();
        render();
      }),
  );
  if ($("#open-chat")) $("#open-chat").onclick = openLeagueChat;
  if ($("#open-studio")) $("#open-studio").onclick = openStudio;
  document.querySelectorAll("[data-ranking]").forEach(
    (b) =>
      (b.onclick = () => {
        rankingScope = b.dataset.ranking;
        render();
      }),
  );
  document
    .querySelectorAll("[data-analyze]")
    .forEach(
      (b) =>
        (b.onclick = () => openAnalysis(b.dataset.analyze, b.dataset.round)),
    );
  if($('#ranking-select'))$('#ranking-select').onchange=e=>{
    persistDraft();rankingScope=e.target.value;
    const group=L().fantasyRanking?.groups?.find(g=>'bet:'+g.key===rankingScope);
    sourceScope=group?'fantacalcio':'seriea';competitionScope=group?.competitionKeys[0]||null;selectedRoundId=null;hydrateDraft();render();
  };
  document.querySelectorAll('[data-ranking-metric]').forEach(b=>b.onclick=()=>{tab=b.dataset.rankingMetric;render();});
  if($('#ranking-metric'))$('#ranking-metric').onchange=e=>{tab=e.target.value;render();};
  bindBarSlips();
  document
    .querySelectorAll("[data-detail]")
    .forEach((b) => (b.onclick = () => openMatch(b.dataset.detail)));
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.page === "chat") {
          openLeagueChat();
          return;
        }
        void navigatePage(b.dataset.page);
      }),
  );
  document.querySelectorAll("[data-tab]").forEach(
    (b) =>
      (b.onclick = () => {
        tab = b.dataset.tab;
        render();
      }),
  );
  document.querySelectorAll("[data-market]").forEach(
    (e) =>
      (e.onchange = () => {
        market[e.dataset.market] = e.value;
        render();
      }),
  );
  document.querySelectorAll("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        picks[b.dataset.pick] = b.dataset.value;
        render();
      }),
  );
  if ($("#round-switch"))
    $("#round-switch").onchange = async (e) => {
      selectedRoundId=e.target.value;writeAppRoute({mode:'bar',page:'schedina',league:L()?.id,round:selectedRoundId});
      await refresh(true);
    };
  if ($("#stake"))
    $("#stake").oninput = (e) => {
      stake = Number(e.target.value);
      let missing = r.matches.some(
          (x) => picks[x.id] && !Number.isFinite(x.odds?.[picks[x.id]]),
        ),
        q = r.matches.reduce((a, x) => a * (x.odds?.[picks[x.id]] || 1), 1);
      $("#potential").textContent = missing
        ? "Quote in arrivo"
        : Object.keys(picks).length === r.matches.length
          ? fmt(q * stake) + " crediti"
          : "—";
    };
  if ($("#save"))
    $("#save").onclick = () =>
      act(
        "slip",
        { round: r.id, picks, stake },
        "Schedina salvata. Ora puoi iniziare a dubitare.",
      );
  for (let k of ["create", "join"])
    if ($("#" + k))
      $("#" + k).onsubmit = async (e) => {
        e.preventDefault();
        const form=e.target;
        if(form.dataset.submitting==='true')return;
        form.dataset.submitting='true';
        const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);
        try { await submitLeague(k,k==='create'?leagueCreationPayload(form):Object.fromEntries(new FormData(form))); }
        finally { form.dataset.submitting='false';buttons.forEach(b=>b.disabled=false); }
      };
  if ($("#copy"))
    $("#copy").onclick = () =>
      navigator.clipboard
        .writeText(l.code)
        .then(() => notify("Codice copiato"));
  if ($("#switch"))
    $("#switch").onchange = async (e) => {
      leagueId = e.target.value;
      selectedRoundId = null;
      await refresh(true);
    };
  if ($("#rules"))
    $("#rules").onsubmit = (e) => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target)),
        rules = {
          initial: +d.initial,
          maxStake: +d.maxStake,
          correct: +d.correct,
          wrong: +d.wrong,
          mode: d.mode,
          marketPoints: Object.fromEntries(
            Object.entries(d)
              .filter(([k]) => k.startsWith("market:"))
              .map(([k, v]) => [k.slice(7), +v]),
          ),
          winners: [
            ...(d.points ? ["points"] : []),
            ...(d.credits ? ["credits"] : []),
            ...(l.rules.winners||[]).filter(x=>!["points","credits"].includes(x)),
          ],
        };
      act("rules", { rules }, "Regole salvate");
    };
  if ($("#results"))
    $("#results").onsubmit = (e) => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target)),
        scores = Object.fromEntries(
          r.matches.map((x) => [x.id, [+d["h" + x.id], +d["a" + x.id]]]),
        );
      if (
        confirm(
          "Confermi tutti i risultati? La giornata verrà liquidata una sola volta.",
        )
      )
        act(
          r.title === "Giornata demo" ? "demo-close" : "results",
          { round: r.id, scores },
          "Giornata liquidata. La matematica ha parlato.",
        );
    };
  if ($("#import"))
    $("#import").onsubmit = (e) => {
      e.preventDefault();
      try {
        act(
          "import",
          { data: JSON.parse(new FormData(e.target).get("data")) },
          "Giornata acquisita: quote congelate",
        );
      } catch (x) {
        notify("JSON non valido");
      }
    };
}
function serieATable() {
  const t = state.standings;
  if (!t) return '<div class="card">Classifica in aggiornamento.</div>';
  const columns=["#","Squadra","Pt","PG","V","N","P","GF","GS","DR"];
  const table=(rows,start)=>`<div class="serie-standings-page"><div class="serie-table-card"><table class="serie-table"><thead><tr>${columns.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows.map((x,i)=>`<tr data-ranking-team="${esc(x.name)}"><td>${start+i+1}</td><td>${teamLabel(x.name,{fantasy:false})}</td><td><b class="green">${x.points}</b></td>${["played","won","drawn","lost","gf","gs","dr"].map(k=>`<td>${x[k]}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
  const middle=Math.ceil(t.rows.length/2);
  return `<h1 class="sr-only">Classifica Serie A</h1><div data-os-content class="serie-standings">${table(t.rows.slice(0,middle),0)}${middle<t.rows.length?table(t.rows.slice(middle),middle):''}</div>`;
}
function otherSlips(l, r) {
  if (!l || !r)
    return '<div class="card">Entra in una lega per consultare le schedine.</div>';
  return barSlipsView({ l, r, uid: state.user.id, fmt, rounds: availableRounds(), sourceOf });
}
// Verdicts for the whole table arrive in one light request; tiles and popup share the same cache.
const barVerdicts = new Map(),
  barVerdictPending = new Map();
function applyAcknowledgedSlip(result){const ok=applySlipReceipt(state,result);if(ok)barVerdicts.delete(result.receipt.league+':'+result.receipt.round);return ok;}
function barVerdictKey(r) {
  return L().id + ":" + r.id;
}
function loadBarVerdicts(r) {
  const key = barVerdictKey(r),
    cached = barVerdicts.get(key);
  if (cached && Date.now() - cached.at < 120000) return Promise.resolve(cached.players);
  if (!barVerdictPending.has(key))
    barVerdictPending.set(
      key,
      api("analysis?" + new URLSearchParams({ league: L().id, round: r.id }))
        .then((data) => {
          barVerdicts.set(key, { at: Date.now(), players: data.players || [] });
          return data.players || [];
        })
        .finally(() => barVerdictPending.delete(key)),
    );
  return barVerdictPending.get(key);
}
function bindBarSlips() {
  const root = document.querySelector(".bar-table"),
    l = L(),
    r = R();
  if (!root || !l || !r?.closed || r.pointsOnly || sourceOf(r) === "fantacalcio") return;
  const round = r.id;
  loadBarVerdicts(r)
    .then((players) => {
      if (R()?.id === round) barVerdictPatch(document.querySelector(".bar-table"), players);
    })
    .catch(() => {
      document.querySelectorAll('[data-bar-quip]').forEach(q=>{q.hidden=true;});
      document.querySelectorAll("[data-bar-archetype]").forEach((q) => (q.textContent = ""));
    });
  root.querySelectorAll("[data-quasi-member]").forEach(
    (b) => (b.onclick = () => {
      const member = l.members.find((m) => m.uid === b.dataset.quasiMember);
      if (member) showQuasi(member);
    }),
  );
}
function popup() {
  activeMatchId = null;
  let d = $("#match-modal");
  if (!d) {
    d = document.createElement("dialog");
    d.id = "match-modal";
    document.body.appendChild(d);
    d.addEventListener("click", (e) => {
      if (e.target === d) d.close();
    });
  }
  d.dataset.match = "";
  d.classList.remove("bar-profile-dialog");
  d.innerHTML =
    '<button class="secondary" id="close-modal">Chiudi ×</button><p class="muted">Caricamento…</p>';
  if (!d.open) d.showModal();
  $("#close-modal").onclick = () => d.close();
  return d;
}
async function openAnalysis(uid, round) {
  const r = (L()?.rounds || []).find((x) => x.id === round) || R(),
    d = popup();
  d.classList.add("bar-profile-dialog");
  $("#close-modal").onclick = () => d.close();
  try {
    const players = await loadBarVerdicts(r),
      a = players.find((x) => x.uid === uid);
    if (!a) throw new Error("Nessun profilo disponibile per questa giornata");
    const member = L().members.find((m) => m.uid === uid) || {},
      slip = (r.publicSlips || []).find((x) => x.uid === uid);
    d.innerHTML = barProfileView(a, { name: member.name || "Giocatore", avatar: member.avatar, slip, fmt });
  } catch (e) {
    d.innerHTML = `<button class="secondary" id="close-modal">Chiudi ×</button><p class="muted">${esc(e.message)}</p>`;
  }
  $("#close-modal").onclick = () => d.close();
}
function eventColumns(data, events) {
  const norm = (s) =>
      String(s || "")
        .toLowerCase()
        .replace(/[^a-z0-9]/g, ""),
    aliases = {
      acmilan: "milan",
      internazionale: "inter",
      intermilan: "inter",
      asroma: "roma",
      ssclazio: "lazio",
      sscnapoli: "napoli",
      hellasverona: "verona",
    };
  const key = (s) => aliases[norm(s)] || norm(s);
  const home = [],
    away = [],
    unknown = [];
  for (const e of events) {
    if (e.side === "home" || key(e.team) === key(data.home)) home.push(e);
    else if (e.side === "away" || key(e.team) === key(data.away)) away.push(e);
    else unknown.push(e);
  }
  const event=e=>{
    const icon=e.kind==='goal'||e.kind==='own-goal'?ballIcon(e.kind==='own-goal'):e.kind==='substitution'?substitutionMark():({yellow:'🟨',red:'🟥','penalty-missed':'✕','penalty-saved':'🧤',var:'▣'})[e.kind];
    const names=[(e.players||[]).map(playerSurname).filter(Boolean).join(', '),playerSurname(e.incoming)].filter(Boolean).join(' → ');
    const description=[names,e.kind==='var'?e.detail:''].filter(Boolean).join(' · ');
    return `<div class="event-item match-event-row"><b class="green">${esc(e.minute)}</b><span role="img" aria-label="${esc(matchEventLabel(e))}">${icon}</span><strong title="${esc(description)}">${esc(description)}</strong></div>`;
  };
  return `<div class="events-columns"><section><h3>${esc(data.home)}</h3>${home.length ? home.map(event).join("") : '<p class="tiny muted">Nessun evento disponibile.</p>'}</section><section><h3>${esc(data.away)}</h3>${away.length ? away.map(event).join("") : '<p class="tiny muted">Nessun evento disponibile.</p>'}</section></div>${unknown.length ? '<div class="notice">Squadra non indicata dalla fonte</div>' + unknown.map(event).join("") : ""}`;
}

const detailCache=new Map(),detailPending=new Map();
async function matchSnapshot(match,round=null){
 if(!state.compact)return match;
 const params=new URLSearchParams({id:match.id});if(round){params.set('league',L().id);params.set('round',round.id);}
 const key=state.user.id+':'+params,revision=String(match.lineupRevision||'')+':'+String(match.detailRevision||''),cached=detailCache.get(key)||displayCache('bar:'+state.user.id).get(key,match.status==='FT'?86400000:45000),ttl=match.status==='FT'?86400000:45000;
 if(cached&&cached.revision===revision&&Date.now()-cached.at<ttl)return {...match,...cached.data};
 if(!detailPending.has(key))detailPending.set(key,api('match?'+params).then(data=>{detailCache.set(key,{data,revision,at:Date.now()});if(state.user?.id===key.split(':')[0])displayCache('bar:'+state.user.id).set(key,{data,revision,at:Date.now()});if(detailCache.size>60)detailCache.delete(detailCache.keys().next().value);return data;}).finally(()=>detailPending.delete(key)));
 return {...match,...await detailPending.get(key)};
}
async function openMatch(id, quiet = false) {
  const fantasyRound = L()?.rounds.find(
    (r) => r.source === "fantacalcio" && r.matches.some((m) => m.id === id),
  );
  let match = fantasyRound?.matches.find((m) => m.id === id);
  if (match) {
    if (quiet && !document.querySelector("#match-page-root")) {
      activeMatchId = null;
      return;
    }
    const d = quiet ? document.querySelector("#match-page-root") : openMatchPage({onClose:()=>{activeMatchId=null;}}),
      scroll = d.scrollTop;
    activeMatchId = id;
    try{match=await matchSnapshot(match,fantasyRound);}catch(error){d.innerHTML='<button class="secondary" id="close-modal">Chiudi ×</button><p>'+esc(error.message)+'</p>';$('#close-modal').onclick=()=>d.close();return;}
    if(!d.open||activeMatchId!==id)return;
    d.innerHTML = fantasyMatchView(
      match,
      fantasyRound,
      esc,
      (home,away)=>fixtureTeams(home,away,true),
      fmt,
    );
    d.dataset.match = id;
    d.dataset.fantasyRevision=match.detailRevision||match.details?.at||'';
    const fantasyScore=d.querySelector(".live-score");if(fantasyScore)fantasyScore.setAttribute("data-live-detail-score", "");
    d.querySelectorAll('details[open]').forEach(x=>x.open=false);
    const bookmaker=d.querySelector('details.card');if(bookmaker)d.append(bookmaker);
    bindLineupPitch(d);
    if (quiet) d.scrollTop = scroll;
    $("#close-modal").onclick = () => {
      activeMatchId = null;
      d.close();
    };
    // Opening a match only reads the already downloaded database snapshot.
    return;
  }

  let dialog = $("#match-page-root");
  if (quiet && (!dialog?.open || dialog.dataset.match !== id)) return;
  if (!quiet) {
    dialog = openMatchPage({onClose:()=>{activeMatchId=null;}});
    dialog.dataset.match = id;
    activeMatchId = id;
  }
  try {
    const scroll = dialog.scrollTop,
      baseData = structuredClone(
        state.calendar?.rounds
          .flatMap((r) => r.matches)
          .find((m) => m.id === id) ||
          L()
            ?.rounds.flatMap((r) => r.matches)
            .find((m) => m.id === id),
      );
    if (!baseData) throw Error("Partita non presente nel calendario salvato.");
    const data=await matchSnapshot(baseData);
    if (!dialog.open || dialog.dataset.match !== id) return;

    const events = (data.details?.events || []).filter(isMatchEvent);
    const detailsOpen=quiet&&dialog.querySelector('.match-detail-drill')?.open;
    dialog.innerHTML = `<div class="match-toolbar"><button class="secondary" id="close-modal">Chiudi ×</button><details class="match-detail-drill" ${detailsOpen?'open':''}><summary><span class="match-details-forward">Dettagli della partita ›</span><span class="match-details-back">← Formazioni</span></summary><div class="match-details-body"><h3>Dettagli della partita</h3><div data-live-detail-events>${events.length?eventColumns(data,events):'<p class="muted">Eventi non ancora disponibili.</p>'}</div><div data-live-detail-statistics>${footballStatistics(data,{compact:true})}</div></div></details></div><h2 class="match-page-title">${fixtureTeams(data.home,data.away,false)}</h2><div class="match-scoreline"><div class="match-page-score" data-live-detail-score>${data.score?data.score.join(' – '):data.liveScore?data.liveScore.join(' – '):'—'}</div><p class="muted" data-live-detail-status>${data.status==='FT'?'Finale'+(data.officialConfirmed?' · confermato':' · in attesa di conferma'):data.status==='LIVE'?'In corso · '+esc(data.clock||'minuto non disponibile'):'Da giocare'}</p></div>${lineupView(data)}`;
    $("#close-modal").onclick = () => {
      activeMatchId = null;
      dialog.dataset.match = "";
      dialog.close();
    };
    const drill=dialog.querySelector('.match-detail-drill'),body=drill.querySelector('.match-details-body');
    const fitDetails=()=>{if(!drill.open)return;const nav=document.querySelector('nav.v2-tabbar')?.getBoundingClientRect();const bottom=nav?.top>innerHeight/2?nav.top:innerHeight;body.style.setProperty('--match-detail-height',Math.max(120,bottom-body.getBoundingClientRect().top-10)+'px');};
    drill.ontoggle=()=>{if(drill.open)fitDetails();else window.dispatchEvent(new Event('resize'));};
    let touchStart=null;
    drill.addEventListener('touchstart',e=>{touchStart=e.touches[0];},{passive:true});
    drill.addEventListener('touchend',e=>{const end=e.changedTouches[0];if(drill.open&&touchStart&&end&&end.clientX-touchStart.clientX>55&&end.clientX-touchStart.clientX>Math.abs(end.clientY-touchStart.clientY)*1.4)drill.open=false;touchStart=null;},{passive:true});
    bindFootballStatistics(body);
    fitDetails();
    bindLineupPitch(dialog);
    if (quiet) dialog.scrollTop = scroll;
  } catch (e) {
    if (!quiet) {
      dialog.innerHTML = `<button class="secondary" id="close-modal">Chiudi ×</button><p class="muted">${esc(e.message || "Dettagli momentaneamente non disponibili.")}</p>`;
      $("#close-modal").onclick = () => {
        activeMatchId = null;
        dialog.dataset.match = "";
        dialog.close();
      };
    }
  }
}

function lineupView(data){return renderLineup(data,{paged:true});}
function supportSection() {
  return '<details class="card inline-support"><summary>Invia un suggerimento o segnala un bug</summary><p class="muted">Scrivici un’idea o descrivi cosa non funziona. Risponderemo alla tua email verificata.</p><form id="support-form"><label class="field">Tipo<select name="kind"><option value="suggestion">Suggerimento</option><option value="bug">Bug</option></select></label><label class="field">Titolo<input name="subject" minlength="3" maxlength="100" required></label><label class="field">Messaggio<textarea name="message" minlength="10" maxlength="4000" required></textarea></label><button class="primary">Invia messaggio</button><p id="support-status" role="status"></p></form></details>';
}
function bindSupportInline() {
  const form = $("#support-form");
  if (!form) return;
  form.dataset.request = crypto.randomUUID();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector("button");
    b.disabled = true;
    try {
      const result = await api("support", {
        ...Object.fromEntries(new FormData(form)),
        page,
        requestId: form.dataset.request,
      });
      form.reset();
      form.dataset.request = crypto.randomUUID();
      $("#support-status").textContent = result.message;
    } catch (error) {
      $("#support-status").textContent = error.message;
    } finally {
      b.disabled = false;
    }
  };
}

async function submitLeague(kind, payload) {
  try {
    const result=await api(kind,payload);
    if(state.user?.id)displayCache('fanta:'+state.user.id).clear();
    leagueId = result.league||null;
    selectedRoundId = null;
    page = "lega";
    await refresh(true);
    if(result.message)notify(result.message);else if(result.reused)notify('Questa lega esiste già. Ti abbiamo riportato al suo bancone.');
    return true;
  } catch (x) {
    notify(x.message);
    return false;
  }
}

function bindNew(l, r) {
  document.querySelectorAll("[data-member-remove]").forEach(
    (button) =>
      (button.onclick = () => {
        const member = l.members.find(
          (m) => m.uid === button.dataset.memberRemove,
        );
        if (
          confirm(
            "Rimuovere " +
              member.name +
              " da questa lega? Perderà l’accesso e uscirà dalle classifiche. Storico e schedine restano conservati; potrai riammetterlo.",
          )
        )
          act(
            "member-remove",
            { uid: member.uid },
            "Partecipante rimosso dalla lega.",
          );
      }),
  );
  document
    .querySelectorAll("[data-member-restore]")
    .forEach(
      (button) =>
        (button.onclick = () =>
          act(
            "member-restore",
            { uid: button.dataset.memberRestore },
            "Partecipante riammesso.",
          )),
    );
  if ($("#league-prizes"))
    $("#league-prizes").onsubmit = (e) => {
      e.preventDefault();
      act(
        "league-prizes",
        { winners: new FormData(e.target).getAll("winner") },
        "Premiati aggiornati.",
      );
    };
  const theme = $("#branding-form");
  if (theme?.elements?.emblem) {
    const preview = () => {
      const emblem = theme.elements.emblem.value;
      $("#branding-preview").textContent = emblem;
      $("#branding-preview").style.color = theme.elements.accent.value;
    };
    theme.oninput = preview;
    document.querySelectorAll("[data-emblem]").forEach(
      (button) =>
        (button.onclick = () => {
          theme.elements.emblem.value = button.dataset.emblem;
          preview();
        }),
    );
    preview();
  }
  const rulesForm = $("#rules");
  if (rulesForm?.elements?.mode)
    rulesForm.elements.mode.onchange = () => {
      rulesForm.querySelector("[data-classic-points]").hidden =
        rulesForm.elements.mode.value !== "classic";
      rulesForm.querySelector("[data-auto-points]").hidden =
        rulesForm.elements.mode.value === "classic";
    };
  document.querySelectorAll("[data-calendar-source]").forEach(
    (b) =>
      (b.onclick = () => {
        calendarScope = b.dataset.calendarSource;
        render();
      }),
  );
  if ($("#calendar-competition"))
    $("#calendar-competition").onchange = (e) => {
      persistDraft();
      competitionScope = e.target.value;
      selectedRoundId = null;
      hydrateDraft();
      render();
    };
  document.querySelectorAll("[data-source]").forEach(
    (b) =>
      (b.onclick = () => {
        persistDraft();
        sourceScope = b.dataset.source;
        selectedRoundId = null;
        competitionScope =
          sourceScope === "fantacalcio"
            ? l.rounds.find((x) => sourceOf(x) === "fantacalcio")
                ?.competitionKey || null
            : null;
        hydrateDraft();
        render();
      }),
  );
  if ($("#competition-switch"))
    $("#competition-switch").onchange = (e) => {
      persistDraft();
      competitionScope = e.target.value;
      selectedRoundId = null;
      hydrateDraft();
      render();
    };
  if ($("#league-switch"))
    $("#league-switch").onchange = (e) => switchLeague(e.target.value);
  if ($("#switch")) $("#switch").onchange = (e) => switchLeague(e.target.value);
  if ($("#round-switch"))
    $("#round-switch").onchange = (e) => {
      persistDraft();
      selectedRoundId=e.target.value;writeAppRoute({mode:'bar',page:'schedina',league:L()?.id,round:selectedRoundId});
      hydrateDraft();
      render();
    };
  if ($("#share-verdict"))
    $("#share-verdict").onclick = () => {
      const d=openMatchPage({kind:'postcard',label:'Cartolina del Bar'});
      const fit=()=>{
        const card=d.querySelector('.verdict-postcard'),portrait=d.querySelector('.postcard-quasi');
        if(!card||!portrait)return;
        const nav=document.querySelector('.v2-tabbar')?.getBoundingClientRect();
        const bottom=nav?.top>window.innerHeight/2?nav.top:window.innerHeight;
        d.style.setProperty('--postcard-height',Math.floor(bottom-d.getBoundingClientRect().top)+'px');
        const width=Math.floor(portrait.clientWidth+(bottom-card.getBoundingClientRect().bottom-10)*.8);
        d.style.setProperty('--postcard-quasi-width',Math.max(76,Math.min(220,width))+'px');
      };
      const show=uid=>{
        d.innerHTML='<div class="verdict-page-toolbar"><button type="button" class="secondary" id="close-modal">← Verdetto</button></div>'+createVerdictCard(l,sourceScope,competitionScope,uid,r?.id);
        d.querySelector('#close-modal').onclick=()=>d.close();
        d.querySelectorAll('[data-verdict-player]').forEach(b=>b.onclick=()=>show(b.dataset.verdictPlayer));
        fit();
      };
      window.addEventListener('resize',fit);
      d.addEventListener('close',()=>window.removeEventListener('resize',fit),{once:true});
      show();
    };
  bindChoices(r);
  if ($("#stake"))
    $("#stake").oninput = (e) => {
      stake = Number(e.target.value);
      persistDraft();
      updateSlipUI();
    };
  if ($("#save")) $("#save").onclick = saveCurrentSlip;
  if (document.querySelector(".v2-slip")) {
    const controls = () => {
      const template = document.createElement("template");
      template.innerHTML = renderSlipV2({ round: R(), picks, stake, credits: me().credits, openMatch: activeMatchId, esc, fmt, date });
      const bar = $(".v2-slipbar"), fresh = template.content.querySelector(".v2-slipbar");
      if (!bar || !fresh) return;
      const save = bar.querySelector("#save-slip"), next = fresh.querySelector("#save-slip");
      save.innerHTML = next.innerHTML;
      save.className = next.className;
      save.disabled = next.disabled || busy || offline || !!draftConflict;
      if(busy){save.innerHTML='<span>Salvataggio in corso…</span>';save.setAttribute('aria-busy','true');}else save.removeAttribute('aria-busy');
      const state = bar.querySelector(".v2-state"), nextState = fresh.querySelector(".v2-state");
      if (state && nextState) { state.className = nextState.className; state.textContent = nextState.textContent; }
      if(state&&nextState)state.title=nextState.title;
      for(const selector of ['[data-v2-stake-current]','[data-v2-slip-total]']){const current=bar.querySelector(selector),next=fresh.querySelector(selector);if(current&&next){current.textContent=next.textContent;current.title=next.title;}}
      bar.querySelectorAll("[data-v2-stake]").forEach(b => b.classList.toggle("is-on", Number(b.dataset.v2Stake) === stake));
      const stakeInput = bar.querySelector("#stake");
      if (stakeInput && stakeInput !== document.activeElement) stakeInput.value = stakeInputValue(stake, Number(R()?.rules?.maxStake || 20));
      bar.querySelector(".v2-error")?.remove();
      if (fresh.querySelector(".v2-error")) bar.append(fresh.querySelector(".v2-error"));
    };
    const redrawChoices=()=>{
      if(!patchSlipV2(document,{round:R(),picks,stake,credits:me().credits,openMatch:activeMatchId,esc,fmt,date})){render();return;}
      bindSlipV2(document,choiceHandlers);controls();patchSlipResults($('#app'),R(),picks,isClosed(R()));
    };
    const choiceHandlers={
      onPick: (id, value) => {
        if (isClosed(r) || busy) return;
        if (picks[id] === value) delete picks[id]; else picks[id] = value;
        persistDraft(); redrawChoices();
      },
      onToggle: (id) => { activeMatchId = activeMatchId === id ? null : id; redrawChoices(); },
      onStake: (value) => { if (busy || isClosed(r)) return; stake = value; persistDraft(); controls(); },
      onSave: async () => { const pending = saveCurrentSlip(); controls(); await pending; controls(); },
      onGo: (target) => { void navigatePage(target); },
    };
    bindSlipV2(document,choiceHandlers);
    controls();
    patchSlipResults($("#app"), r, picks, isClosed(r));
  }
  if ($("#review-slip"))
    $("#review-slip").onclick = () => {
      $("#ticket-summary").scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
      $("#ticket-summary").focus({ preventScroll: true });
    };
  if ($("#keep-server"))
    $("#keep-server").onclick = () => {
      try {
        localStorage.removeItem(viewKey);
      } catch {}
      hydrateDraft();
      render();
    };
  if ($("#recover-draft"))
    $("#recover-draft").onclick = () => {
      picks = draftConflict.picks;
      stake = draftConflict.stake;
      draftConflict = null;
      editBaseSavedAt = R()?.slip?.savedAt || null;
      editBaseFingerprint = fingerprint(
        R()?.slip?.picks,
        R()?.pointsOnly ? 0 : R()?.slip?.stake || 10,
      );
      market = {};
      for (const [id, p] of Object.entries(picks))
        market[id] = Object.keys(groups).find((g) => groups[g].includes(p));
      persistDraft();
      render();
    };
  if ($("#logout"))
    $("#logout").onclick = e => void returnToLanding(e.currentTarget);
  document.querySelectorAll("[data-page]").forEach(
    (b) =>
      (b.onclick = () => {
        if (b.dataset.page === "chat") {
          openLeagueChat();
          return;
        }
        persistDraft();
        void navigatePage(b.dataset.page);
      }),
  );
  if ($("#branding-form"))
    $("#branding-form").onsubmit = (e) => {
      e.preventDefault();
      act(
        "league-profile",
        { branding: Object.fromEntries(new FormData(e.target)) },
        "Il bar ha un nuovo stemma. Le scuse sono le solite.",
      );
    };
  if ($("#balanced-rules"))
    $("#balanced-rules").onclick = () => {
      const form = $("#rules");
      form.elements.mode.value = "weighted";
      form.elements.correct.value = 1;
      form.elements.wrong.value = -1;
      form.elements.mode.onchange?.();
      for (const [p, v] of Object.entries({
        1: 1,
        X: 1,
        2: 1,
        "1X": 0.25,
        12: 0.25,
        X2: 0.25,
        Goal: 1,
        "No Goal": 1,
        "Under 2.5": 1,
        "Over 2.5": 1,
      }))
        if (form.elements["market:" + p])
          form.elements["market:" + p].value = v;
      notify(
        "Proposta applicata al modulo. Salva per usarla nelle prossime giornate.",
      );
    };
  bindFantasy?.(l);
}
function bindChoices(r) {
  if (!r) return;
  document.querySelectorAll("[data-pick]").forEach(
    (b) =>
      (b.onclick = () => {
        if (isClosed(r) || busy) return;
        picks[b.dataset.pick] = b.dataset.value;
        persistDraft();
        const article = b.closest("[data-match-card]");
        article.querySelectorAll("[data-pick]").forEach((p) => {
          const chosen = p.dataset.value === picks[b.dataset.pick];
          p.classList.toggle("selected", chosen);
          p.setAttribute("aria-pressed", String(chosen));
        });
        article.querySelector("[data-selected-caption]").textContent =
          "Scelta: " + b.dataset.value;
        updateSlipUI();
      }),
  );
  document.querySelectorAll("[data-market-track]").forEach((track) => {
    const id = track.dataset.marketTrack,
      article = track.closest("[data-match-card]"),
      tabs = [...article.querySelectorAll("[data-market-tab]")];
    const select = (i) => {
      market[id] = tabs[i].dataset.group;
      track
        .querySelectorAll(".market-panel")
        .forEach((panel, j) => (panel.inert = i !== j));
      tabs.forEach((tab, j) => {
        tab.setAttribute("aria-selected", String(i === j));
        tab.tabIndex = i === j ? 0 : -1;
      });
    };
    const initial = Math.max(
      0,
      tabs.findIndex((t) => t.dataset.group === market[id]),
    );
    track.scrollLeft = initial * track.clientWidth;
    track.onscroll = () => {
      if (track.clientWidth)
        select(
          Math.max(
            0,
            Math.min(
              tabs.length - 1,
              Math.round(track.scrollLeft / track.clientWidth),
            ),
          ),
        );
    };
    tabs.forEach((tab, i) => {
      const go = (j) => {
        select(j);
        track.scrollTo({
          left: j * track.clientWidth,
          behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "instant"
            : "smooth",
        });
      };
      tab.onclick = () => go(i);
      tab.onkeydown = (e) => {
        let j = i;
        if (e.key === "ArrowRight") j = (i + 1) % tabs.length;
        else if (e.key === "ArrowLeft") j = (i + tabs.length - 1) % tabs.length;
        else if (e.key === "Home") j = 0;
        else if (e.key === "End") j = tabs.length - 1;
        else return;
        e.preventDefault();
        tabs[j].focus();
        go(j);
      };
    });
  });
}
function switchLeague(id) {
  persistDraft();
  leagueId = id;
  try {
    localStorage.setItem("quasi-active-league:" + state.user.id, id);
  } catch {}
  selectedRoundId = null;
  competitionScope = null;
  hydrateDraft();
  render();
}
function brandingForm(l) {
  if (l.admin !== state.user.id) return "";
  const emblem=l.branding?.emblem||'Q',accent=l.branding?.accent||LEAGUE_COLORS[0][0];
  const names=new Set(['Lime','Menta','Ambra','Lilla','Rosa','Corallo','Prato','Blu','Cielo','Avio']);
  const colors=LEAGUE_COLORS.filter(([color,label])=>color===accent||names.has(label));
  const emblems=LEAGUE_EMBLEMS.filter(value=>['⚽','🏆','🍺','🔥','🦅','🐺','⭐','⚡'].includes(value));
  return (
    '<form id="branding-form"><div class="branding-identity"><span class="league-emblem" id="branding-preview" aria-hidden="true">' +
    esc(emblem) +
    '</span><label class="field">Sigla <small>Max 4</small><input name="emblem" maxlength="4" value="' +
    esc(emblem) +
    '" required></label></div><div class="emblem-presets" role="group" aria-label="Simboli della lega">' +
    emblems.map(
      (v) =>
        '<button type="button" class="secondary" data-emblem="' +
        esc(v) +
        '">' +
        esc(v) +
        "</button>",
    ).join("") +
    '</div><fieldset class="theme-palette"><legend>Colore</legend>' +
    colors.map(
      ([color, label]) =>
        '<label class="theme-option" title="'+esc(label)+'"><input type="radio" name="accent" data-color-name="'+esc(label)+'" aria-label="'+esc(label)+'" value="' +
        color +
        '" ' +
        (accent === color
          ? "checked"
          : "") +
        ' required><span style="--swatch:' +
        color +
        '" class="theme-swatch"></span><span>' +
        label +
        "</span></label>",
    ).join("") +
    '</fieldset><label class="field">Il vostro motto<input name="motto" maxlength="100" value="' +
    esc(l.branding?.motto || "") +
    '" placeholder="Qui il pareggio è una scelta di vita."></label><button class="primary">Salva identità</button></form>'
  );
}
function leagueMembers(l, admin) {
 if(!admin)return '';
 const winners=l.prizeWinners||[];
 return '<section class="member-management"><h2>Partecipanti e premi</h2><p class="tiny muted">Scegli chi va a premio, poi salva.</p>'+
 (l.members.length>12?'<label class="field">Cerca partecipante<input type="search" data-member-search placeholder="Nome del partecipante"></label><p class="tiny muted" data-member-count role="status">'+l.members.length+' partecipanti mostrati</p>':'')+
 '<form id="league-prizes">'+l.members.map(m=>'<div class="member-management-row" data-member-name="'+esc(m.name)+'"><span class="member-name">'+esc(m.name)+'</span><label class="member-prize"><input type="checkbox" name="winner" value="'+esc(m.uid)+'" '+(winners.includes(m.uid)?'checked':'')+'><span>a premio</span><span class="sr-only"> · '+esc(m.name)+'</span></label>'+(m.uid!==l.admin?'<details class="member-menu"><summary aria-label="Azioni per '+esc(m.name)+'">⋯</summary><button class="text-button" type="button" data-member-remove="'+esc(m.uid)+'">Rimuovi dalla lega</button></details>':'<span class="sr-only">Presidente</span>')+'</div>').join('')+'<div class="member-save"><button class="secondary">Salva premiati</button></div></form>'+((l.removedMembers||[]).length?'<details><summary>Partecipanti rimossi · '+l.removedMembers.length+'</summary>'+l.removedMembers.map(m=>'<div class="member-management-row"><span>'+esc(m.name)+'</span><button type="button" class="secondary" data-member-restore="'+esc(m.uid)+'">Riammetti</button></div>').join('')+'</details>':'')+'</section>';
}

function bindFantasy(l) {
}
async function act(route, data, msg) {
  if (busy) return;
  busy = true;
  try {
    await api(route, { league: L().id, ...data });
    await refresh(true);
    notify(msg);
  } catch (x) {
    notify(x.message);
  } finally {
    busy = false;
  }
}
if ("serviceWorker" in navigator)
  navigator.serviceWorker.register("/sw.js").catch(() => {});
if ("serviceWorker" in navigator)
  navigator.serviceWorker.addEventListener("message", (e) => {
    if(e.data?.type==='open-fanta'){
      try{localStorage.setItem('qdq:mode','fanta');if(typeof e.data.league==='string')localStorage.setItem('qdq:fantaLeague',e.data.league);}catch{}
      if(state.user){const target=typeof e.data.url==='string'?new URL(e.data.url,location.origin):null;const route=target?.origin===location.origin?readAppRoute(target.hash):null;const targetLeague=typeof e.data.league==='string'?e.data.league:L()?.nativeFantaLink?.leagueId;const targetPage=route?.page==='asta'?'asta':'oggi';writeAppRoute({mode:'fanta',page:targetPage,league:targetLeague});closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:targetLeague,initialTab:targetPage,onBar:openBarTarget,force:true});}
      return;
    }
    if(e.data?.type==='open-slip'&&!state.user&&typeof e.data.league==='string'){
      requestedSlip=e.data.league;requestedSlipRound=e.data.round;return;
    }
    if(e.data?.type==='open-slip'&&state.leagues.some(l=>l.id===e.data.league)){
      persistDraft();leagueId=e.data.league;const round=L().rounds.find(r=>r.id===e.data.round);if(round){sourceScope=sourceOf(round);competitionScope=round.competitionKey||null;selectedRoundId=round.id;}page='schedina';slipScope='mine';hydrateDraft();render();window.scrollTo(0,0);return;
    }
    if (
      e.data?.type === "open-chat" &&
      state.leagues.some((l) => l.id === e.data.league)
    ) {
      persistDraft();
      leagueId = e.data.league;
      chatOpen = true;
      hydrateDraft();
      render();
      window.scrollTo(0, 0);
    }
  });
let liveStatus=null;
let liveDisplayFailures=0;
function showLiveStatus(value){
 if(value!==liveStatus)liveDisplayFailures=value.state==='ready'?0:liveDisplayFailures+1;
 liveStatus=value;const el=$('#live-channel-status');if(!el)return;
 const show=page==='schedina'&&slipScope!=='standings'&&(value.state==='ready'||liveDisplayFailures>=3);el.hidden=!show;
 if(!show){el.textContent='';return;}
 const text=value.state==='ready'?'Ultimo aggiornamento '+new Date(value.at).toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Rome'}):'Aggiornamento in pausa';
 if(el.textContent!==text)el.textContent=text;
}
function applyLive(data){
  if(L()?.id!==data.league)return;
  mergeLiveSnapshot(state,data);
  if(preferredFanta())return;
  if(R()&&isClosed(R()))document.querySelectorAll("#save-slip,#stake,[data-v2-stake]").forEach(e=>e.disabled=true);
  if(R())patchSlipResults($('#app'),R(),picks,isClosed(R()));
  const matches=[...(L().rounds||[]),...(state.calendar?.rounds||[])].flatMap(r=>r.matches);
  const credit=$('.v2-credits b');if(credit){const value=fmt(me()?.credits||0);if(credit.textContent!==value)credit.textContent=value;}
  const dashboard=$('#league-dashboard');if(dashboard){patchDashboard(dashboard,leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null));}
  if(page==='classifiche'){
    const template=document.createElement('template');template.innerHTML=ranking(L());
    const current=$('main .card'),fresh=template.content.querySelector('.card');if(current&&fresh)patchRegion(current,fresh.outerHTML);
  }
  for(const row of document.querySelectorAll('.calendar-fixture[data-detail]')){
    const m=matches.find(m=>m.id===row.dataset.detail),score=row.lastElementChild;if(!m||!score)continue;
    const text=calendarStatus(m);if(score.textContent!==text)score.textContent=text;
    score.classList.toggle('green',m.status==='FT'&&!!m.score);
  }
  const dialog=$('#match-page-root');if(dialog?.open){
    const m=matches.find(m=>m.id===dialog.dataset.match);if(m){
      const fantasyRound=L().rounds.find(r=>sourceOf(r)==='fantacalcio'&&r.matches.some(x=>x.id===m.id));
      if(fantasyRound){
        patchFantasyMatch(dialog,m);
        const revision=m.detailRevision||'';
        if(revision&&revision!==dialog.dataset.fantasyRevision)void matchSnapshot(m,fantasyRound).then(fresh=>{
          if(dialog.open&&dialog.dataset.match===m.id&&m.detailRevision===revision){patchFantasyMatch(dialog,fresh);dialog.dataset.fantasyRevision=revision;}
        }).catch(()=>{});
        return;
      }
      const score=dialog.querySelector('[data-live-detail-score]'),value=(m.status==='LIVE'?m.liveScore:m.score)?.join(' – ')||'—';
      if(score&&score.textContent!==value)score.textContent=value;
      const status=dialog.querySelector('[data-live-detail-status]'),label=m.status==='LIVE'?'In corso · '+(m.clock||'minuto non disponibile'):m.status==='FT'?'Finale'+(m.officialConfirmed?' · confermato':' · in attesa di conferma'):'Da giocare';
      if(status&&status.textContent!==label)status.textContent=label;
      const events=dialog.querySelector('[data-live-detail-events]');if(events){const html=eventColumns(m,(m.details?.events||[]).filter(isMatchEvent));if(events.dataset.revision!==html){patchRegion(events,'<div data-live-detail-events>'+html+'</div>');events.dataset.revision=html;}}
      const numbers=dialog.querySelector('[data-live-detail-statistics]');if(numbers){const html=footballStatistics(m,{compact:true});if(numbers.dataset.revision!==html){patchRegion(numbers,'<div data-live-detail-statistics>'+html+'</div>');numbers.dataset.revision=html;bindFootballStatistics(dialog);}}
    }
  }
}
document.addEventListener('quasi:chat-context',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league||l.id===e.detail?.league);syncChatLauncher(linked||null);if(linked)updateChatWidget();});
document.addEventListener('quasi:fanta-team-claimed',()=>{void refresh();});
document.addEventListener('quasi:open-chat',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league);if(linked)syncChatLauncher(linked);openLeagueChat();});
document.addEventListener('click',e=>{const target=e.target.closest('[data-bar-page]');if(target&&!target.hasAttribute('data-mode')&&['join-league','create-league'].includes(target.dataset.barPage)){openBarTarget({page:target.dataset.barPage});return;}if(target&&!target.hasAttribute('data-mode')&&['profilo','regolamento','admin','invita'].includes(target.dataset.barPage)){const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}if(target.dataset.barPage==='regolamento'){openBarRules();return;}void navigatePage(target.dataset.barPage==='invita'?'profilo':target.dataset.barPage);if(target.dataset.barPage==='invita')document.querySelector('.app-invite')?.scrollIntoView({block:'start'});return;}const mode=e.target.closest('[data-app-mode]')?.dataset.appMode;if(!mode)return;if(mode==='fanta'){closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:L()?.nativeFantaLink?.leagueId,onBar:openBarTarget});}else{leaveFanta();try{localStorage.setItem('qdq:mode','bar');}catch{}render();}});
let liveScoresRevision=null,sportsFeedBlockedUntil=0;
const liveChannel=createSportsPush({
  context:()=>!preferredFanta()&&state.user&&!state.user.demo&&state.user.emailVerified&&L()?{mode:'bar',league:L().id}:null,
  apply:applyLive,status:showLiveStatus,
});
liveChannel.start();

refresh(true);
let lastSlipNavigationDay=slipRomeDay();
setInterval(() => {
  if(preferredFanta())return;
  const day=slipRomeDay();if(day!==lastSlipNavigationDay){lastSlipNavigationDay=day;if(page==='schedina'){if(R()?.id!==displayedSlipRoundId)hydrateDraft();render();}}
  if(page==='schedina'&&publicSlipView()&&R()?.id!==displayedSlipRoundId){hydrateDraft();render();}
  const countdown = document.querySelector('[data-dashboard-countdown][data-deadline]');
  if(countdown)countdown.textContent=countdownLabel(countdown.dataset.deadline);
  if (
    page === "schedina" &&
    R() &&
    !R().closed &&
    R().kickoff &&
    new Date() >= new Date(R().kickoff)
  ) {
    R().closed = true;
    document
      .querySelectorAll("[data-pick],[data-market]")
      .forEach((e) => (e.disabled = true));
    updateSlipUI();
    notify("Giornata chiusa. Le schedine sono bloccate.");
  }
}, 1000);



window.addEventListener("pagehide", persistDraft);
window.addEventListener('popstate',()=>{const route=readAppRoute();if(!route||!state.user)return;if(route.mode==='fanta'){void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),onBar:openBarTarget,initialTab:route.page,leagueId:route.league,force:false});return;}leaveFanta();page=({oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',profilo:'profilo',regolamento:'regolamento',admin:'admin',lega:'barleague'})[route.page]||'lega';if(state.leagues.some(l=>l.id===route.league))leagueId=route.league;sourceScope='seriea';if(route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;hydrateDraft();render();});
// Formations remain a stable DB snapshot. The live channel patches only scores,
// events and small numeric regions, never formations, accordions or portraits.

window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && chatOpen) closeLeagueChat();
});
window.addEventListener("offline", () => {
  offline = true;
  persistDraft();
  updateConnection();
  updateSlipUI();
});

function syncTeamAssets() {
  document.querySelectorAll("[data-fantasy-team]").forEach((label) => {
    const teams = L()?.fantasyTeams?.[label.dataset.fantasyCompetition],
      team =
        teams &&
        Object.values(teams).find((t) => t.name === label.dataset.fantasyTeam),
      url = team?.logo || team?.shirt;
    if (!url) return;
    let img = label.querySelector("img");
    if (!img) {
      img = document.createElement("img");
      img.className = "team-logo";
      img.width = 32;
      img.height = 32;
      img.alt = "";
      img.loading = "lazy";
      img.onerror = () => (img.hidden = true);
      label.querySelector(".crest")?.remove();
      label.prepend(img);
    }
    if (img.getAttribute("src") !== url && img.getAttribute("data-deferred-src") !== url || img.hidden) {
      img.hidden = false;
      img.setAttribute("data-deferred-src", url);
    }
  });
}



