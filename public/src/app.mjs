import {joinInvite} from './invite-join.mjs';
import {bindSwipeBack,openMatchPage} from './match-page.mjs';
import {barHomeInvite} from './bar-home-invite.mjs';
import {leagueActions} from './league-actions.mjs';
import {settingsFooter,presidentEntry,presidentPanel,barPresidentTasks,bindPresidentPanel} from './president-panel.mjs';
import {createSportsPush} from './sports-push.mjs';
import {paintAuctionBadges,trackAuctionBadges} from './auction-index.mjs';
import {nicknameNotice} from './nickname-notice.mjs';
import {slipCreditReserve,slipStakeLimit} from "../slip-events.mjs";
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
import {footballPenalties} from './football-statistics.mjs';
import {clubShirt} from './club-crest.mjs';
import { renderSlipV2, patchSlipV2, patchSlipBar, bindSlipV2 } from "./v2/slip-v2.mjs";
import { quasiScene, bindQuasiZoom } from "./quasi-scene.mjs";
import {barSlipsView,barVerdictPatch,barProfileView,bindBarSlipPages} from "./bar-slips.mjs";
import { renderTabBar, bindTabBar, tabForPage, routeForTab, defaultSource } from "./v2/tabs.mjs";
import { renderLeagueChip, bindLeagueSwitcher, isLeagueAdmin } from "./v2/league-switcher.mjs";
import { showLanding, hideLanding, markSession, pendingInvite, clearPendingInvite } from "./v2/landing.mjs";
const PUBLIC_AUTH_HASHES={login:'accesso',register:'registrati',forgot:'recupera',resend:'reinvia',demo:'demo'};
let pendingAppRoute=readAppRoute(),inviteAttempt=null;
const initialPublicMode=Object.keys(PUBLIC_AUTH_HASHES).find(k=>PUBLIC_AUTH_HASHES[k]===location.hash.slice(1));
let v2Invite = pendingInvite(), landingDismissed = !!v2Invite||!!initialPublicMode, forceDemo = initialPublicMode==='demo';
let initialDemoRequested=initialPublicMode==='demo';
import {inlineResultView,patchSlipResults} from './slip-results.mjs';
import {renderLineup,bindLineupPitch,matchAvailability,setPitchFlip} from './lineup-pitch.mjs';
let studioModule;const loadStudio=()=>studioModule??=import('./quasi-studio.mjs');
window.addEventListener?.('quasi:idle',()=>{if(state.user&&!studioModule)loadStudio().catch(()=>{studioModule=null;});});

import {rosterView,bindRoster} from './quasi-roster.mjs';
import {rewardById,rewardMark,rarityLabel,REWARD_TYPES} from './reward-catalog.mjs';
import {fantaQuasiTeaser,fantaQuasiPage,bindFantaQuasi} from './fanta-quasi.mjs';
import {achievementBoard} from './achievement-board.mjs';

import { LEAGUE_COLORS, LEAGUE_EMBLEMS, applyLeagueTheme } from "./league-theme.mjs";
import {hubHead,hubTile} from './league-hub.mjs';
import {shareLeagueInvite,whatsappInvite} from './league-invite.mjs';
import {createFantaApi} from './fanta/api.mjs';
import {renderFantaNotificationSettings} from './fanta/io.mjs';
import {bindAppInvites} from './app-invite.mjs';
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
  isClosed,editingClosed,editingEventLocked,editablePicks,
  slipSummary,
  fingerprint,
  draftKey,
  loadDraft,
  saveDraft,
  cleanPicks,
} from "./slip-state.mjs";
import { communityView, createVerdictCard } from "./community.mjs";
import { chatView, bindChat, stopChat, refreshChat } from "./chat.mjs";
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
let requestedChat=new URLSearchParams(location.search).get("chat");
try{requestedChat??=sessionStorage.getItem("qdq:pending-chat");if(requestedChat)sessionStorage.setItem("qdq:pending-chat",requestedChat);}catch{}
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
  stake = 1,
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
let chatLeagueId=null,chatOpen=false,chatContext=null,chatReturnFocus=null;
function chatLeague(){return state.leagues.find(l=>l.id===chatLeagueId)||L();}
function syncChatLauncher(league=L()){
 const next=league?.id||null;
 if(chatContext&&next!==chatLeagueId)closeLeagueChat();
 chatLeagueId=next;chatBadge();
}
function chatBadge(){
 const count=state.leagues.reduce((sum,l)=>sum+(l.chat?.unread||0),0);
 for(const badge of document.querySelectorAll('[data-chat-badge]')){
  badge.hidden=!count;
  badge.setAttribute('aria-label',count===1?'1 messaggio da leggere':count+' messaggi da leggere');
 }
 const unread=chatLeague()?.chat?.unread||0;
 for(const badge of document.querySelectorAll('[data-chat-tile-badge]')){
  badge.hidden=!unread;
  badge.textContent=unread>99?'99+':String(unread);
  badge.setAttribute('aria-label',unread===1?'1 messaggio da leggere':unread+' messaggi da leggere');
 }
}
function closeLeagueChat() {
  chatOpen = false;
  stopChat();
  const widget = $("#league-chat-widget");
  if (widget) widget.hidden = true;
  chatContext = null;
  chatBadge();
  if(chatReturnFocus?.isConnected)chatReturnFocus.focus({preventScroll:true});
  chatReturnFocus=null;
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
      '<header class="chat-widget-header"><div><strong>Chiacchiere da bar</strong><small id="chat-widget-league"></small></div><button class="secondary" id="chat-minimize" aria-label="Chiudi la chat"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>' +
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
      onNotify:enabled=>{league.chat={...league.chat,notify:enabled};},
      onUnread: (n) => {
        league.chat = { ...league.chat, unread: n };
        chatBadge();
      },
    });
    chatConsent = null;
  }
  chatBadge();
}
function openLeagueChat(trigger=document.activeElement) {
  if (chatOpen) {
    closeLeagueChat();
    return;
  }
  const league = chatLeague();
  if (!league) return;
  chatReturnFocus=trigger;
  chatConsent = requestChatConsent({ user: state.user, league });
  chatOpen = true;
  updateChatWidget();
}
function clearRequestedChat(){
  requestedChat=null;
  try{sessionStorage.removeItem("qdq:pending-chat");}catch{}
  const params=new URLSearchParams(location.search);
  if(!params.has("chat"))return;
  params.delete("chat");
  window.history.replaceState(null,"",location.pathname+(params.size?"?"+params:"")+location.hash);
}
function openChatNotification(id){
  if(!state.user?.emailVerified||!state.leagues.some(l=>l.id===id))return false;
  closeLeagueChat();leaveFanta();
  try{localStorage.setItem("qdq:mode","bar");}catch{}
  leagueId=id;selectedRoundId=null;sourceScope="seriea";competitionScope=null;page="barleague";
  chatLeagueId=id;chatOpen=true;
  writeAppRoute({mode:"bar",page:"lega",league:id},{replace:true});
  return true;
}
let barDemo=null,initialViewReady=Promise.resolve();
async function prepareDemo(){const session=(await import('./demo-session.mjs')).getDemoSession();await session.ready;barDemo=session.bar;state=structuredClone(barDemo.state);if(!state.leagues.some(l=>l.id===leagueId))leagueId=state.leagues[0].id;return session;}
async function openBarDemo(target={}){await prepareDemo();await loadAppStyles();if(target?.page==='logout'){await returnToLanding();return;}leaveFanta();leagueId=target?.league||leagueId;page=({profilo:'profilo',impostazioni:'impostazioni',invita:'impostazioni',schedina:'schedina',admin:'admin',regolamento:'regolamento'})[target?.page]||'lega';sourceScope=target?.sourceScope||'seriea';selectedRoundId=target?.round||null;hydrateDraft();render();writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page,league:leagueId});}
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
let activeMarketId=null,refreshBarTicket=null;
const publicSlipView=()=>slipScope==='bar'||slipScope==='community';
function availableRounds() {
 const all=(L()?.rounds||[]).filter(r=>!r.archived&&sourceOf(r)===sourceScope&&(sourceScope!=='fantacalcio'||!competitionScope||r.competitionKey===competitionScope));
 return selectableSlipRounds(all,Date.now(),state.calendar).sort((a,b)=>(Number(a.number)-Number(b.number))||Date.parse(a.kickoff)-Date.parse(b.kickoff));
}

function R() {
  const rounds = availableRounds();
  const round=rounds.find(r=>r.id===selectedRoundId)||defaultSlipRound(rounds,Date.now(),state.calendar);
  const league=L();
  if(round)round.stakeReserve=slipCreditReserve(round,league.rounds,league,state.user?.id);
  return round;
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
    const next = await api("state?lite=1&ledger=0");
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
    if(state.user&&state.user.id!==previousUser){const route=readAppRoute();pendingAppRoute=null;page=route?.mode==='bar'?({oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',profilo:'profilo',impostazioni:'impostazioni',regolamento:'regolamento',admin:'admin',lega:'barleague'})[route.page]||'lega':'lega';if(state.leagues.some(l=>l.id===route?.league))leagueId=route.league;if(route?.mode==='bar'&&route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;}
    if(requestedSlip&&state.leagues.some(l=>l.id===requestedSlip)){
      leagueId=requestedSlip;const round=L().rounds.find(r=>r.id===requestedSlipRound);page='schedina';slipScope='mine';if(round){sourceScope=sourceOf(round);competitionScope=round.competitionKey||null;selectedRoundId=round.id;}
      requestedSlip=null;requestedSlipRound=null;const params=new URLSearchParams(location.search);params.delete('slip');params.delete('round');window.history.replaceState(null,'',location.pathname+(params.size?'?'+params:''));
    }
    const invite=state.user?.emailVerified&&!state.user.demo?pendingInvite():null;
    if(invite&&inviteAttempt!==state.user.id+':'+invite){inviteAttempt=state.user.id+':'+invite;try{
      const joined=await joinInvite(invite,{join:code=>api('join',{code}),clear:()=>{clearPendingInvite();v2Invite=null;clearEntry(localStorage);}});
      state=await api('state?lite=1&ledger=0');leagueId=joined.league;selectedRoundId=null;page='lega';writeAppRoute({mode:'bar',page:'oggi',league:joined.league},{replace:true});
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
    const openRequestedChat=!!requestedChat&&!!state.user?.emailVerified&&openChatNotification(requestedChat);
    if(requestedChat&&state.user?.emailVerified)clearRequestedChat();
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
      openRequestedChat ||
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
    r?.pointsOnly ? 0 : r?.slip?.stake || 1,
  );
  const nextViewKey=state.user && L() && r && !r.preview ? draftKey(state.user.id,L().id,r) : null;
  if(nextViewKey!==viewKey)activeMarketId=null;
  viewKey=nextViewKey;
  draftConflict = null;
  picks = { ...(r?.slip?.picks || {}) };
  stake = r?.pointsOnly ? 0 : r?.slip?.stake || 1;
  market = {};
  if (viewKey) {
    const d = loadDraft(localStorage, viewKey, r);
    if (d?.conflict) draftConflict = d;
    else if (d) {
      picks = d.picks;
      stake = d.stake;
    }
  }
  reconcileSlipDraft(r);
  for (const [id, p] of Object.entries(picks))
    market[id] = Object.keys(groups).find((g) => groups[g].includes(p));
}
function reconcileSlipDraft(round){
  if(!round?.eventBetting)return;
  picks=editablePicks(round,picks);
  if(slipSummary(round,picks,stake).fixedStake)stake=round.slip.stake;
  else if(!round.pointsOnly)stake=Math.max(1,Math.min(stake,slipStakeLimit(me()?.credits??0,round.slip?.stake,round.stakeReserve)));
}
function eventLockKey(round){
  return round?.eventBetting?round.id+':'+round.matches.map(m=>(editingEventLocked(round,m)?'1':'0')+(m.kickoff||m.officialKickoff||'')).join('|'):'';
}
let displayedEventLocks='';
function persistDraft() {
  const r = R();
  if (!viewKey || !r || editingClosed(r)) return;
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
    fingerprint(r.slip?.picks, r.pointsOnly ? 0 : r.slip?.stake || 1)
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
  return `${!state.user ? '<header><div class="brand"><img class="brand-logo" src="/league-logo.svg" alt="Logo Quelli del Quasi" width="38" height="44">QUELLI DEL <b>QUASI.</b></div></header>' : ""}${state.user && (state.user.emailVerified || state.user.demo) && L() ? renderLeagueChip(L(), state.user.id, esc, fmt, barModeSwitch(), me(), 'crediti Bar',page==='impostazioni') : ""}${state.user && (state.user.emailVerified || state.user.demo) && !L() ? `<header class="v2-top">${barModeSwitch()}${presidentEntry('data-bar-page="impostazioni"')}</header>` : ""}${content}${state.user && (state.user.emailVerified || state.user.demo) ? renderTabBar(tabForPage(page, sourceScope)) : ""}`;
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
          '<button type="button" data-slip-scope="' +
          id +
          '" class="' +
          (slipScope === id ? "on" : "") +
          '" aria-pressed="' +
          (slipScope === id) +
          '" aria-label="' + t + '" data-short="' + short + '"><span class="seg-long">' +
          t +
          "</span></button>",
      )
      .join("") +
    "</div>";
  const body =
    slipScope === 'standings' && sourceScope === 'seriea' ? serieATable() : slipScope === "community"
      ? (r ? '<div data-os-header>'+roundSelector(l,r)+'</div>' : '') + '<div data-os-content class="verdict-content">'+communityView(
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
          : renderSlipV2({ round: r, picks, stake, credits: m.credits, openMatch: activeMarketId, esc, fmt, date,
            barTicket: true, roundPicker: r ? roundSelector(l,r) : '',
            conflictNotice: draftConflict ? '<div class="notice"><b>La schedina è stata aggiornata da un altro dispositivo.</b><p>Puoi tenere la versione salvata oppure recuperare la bozza locale e rivederla.</p><button class="secondary" id="keep-server">Tieni quella salvata</button> <button class="secondary" id="recover-draft">Recupera la bozza</button></div>' : '' });
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
  if(page==='profilo'&&(state.user.emailVerified||state.user.demo)){page='impostazioni';presidentGroup='account';}
  const content =
    (!state.user.emailVerified && !state.user.demo)
      ? profile()
      : page === "impostazioni"
        ? presidentPanel({mode:'bar',title:'Impostazioni',open:presidentGroup,footer:settingsFooter(),groups:accountGroups()})
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
  displayedEventLocks=page==='schedina'?eventLockKey(r):'';
  retainAppHeader($('#app'));
  paintAuctionBadges();
  placeAppFooter($('#app'));
  syncChatLauncher(l);
  bind(l, r);
  bindPresidentPanel($('#app'));
  const panel=document.querySelector('.president-panel:has(.league-settings-back)');
  if(panel)bindSwipeBack(panel,()=>navigatePage('barleague'),'right',()=>!panel.querySelector('.os-drill'));
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
          (x.archived?" · archivio":x.preview?" · anteprima":" · "+roundAvailability(x)) +
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
                (r.pointsOnly && ((r.slip?.picks?.[x.id] === p
                  ? r.slip.pointTerms?.[x.id]
                  : null) || x.pointOffers?.[p])
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
  const r=R(),summary=slipSummary(r,picks,stake,me().credits);
  if(busy||offline||draftConflict||!summary.canSave)
    return;
  const key = viewKey,
    payload = {
      league: L().id,
      round: r.id,
      picks: summary.picks,
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
 const u=state.user,required=!u.emailVerified&&!u.demo;
 const email=`<p class="profile-email-value">${esc(u.email||"Email non inserita")}${u.emailVerified?' <span class="green" role="img" aria-label="Email verificata">✓</span>':''}</p>`;
 const verification=required?`<form id="account-email" class="profile-password"><h3>Email e sicurezza</h3><label class="field">Email<input name="email" type="email" required maxlength="254" autocomplete="email" value="${esc(u.pendingEmail||u.email||"")}"></label><label class="field">Password attuale<input name="password" type="password" required maxlength="200" autocomplete="current-password"></label><button class="primary">Invia conferma email</button>${u.pendingEmail||u.email?'<button type="button" class="secondary" id="resend-profile">Reinvia conferma</button>':''}</form>`:'';
 const password=u.emailVerified&&u.hasLocalPassword?`<form id="account-password" class="profile-password"><h3>Cambia password</h3><label class="field">Password attuale<input name="currentPassword" type="password" required maxlength="200" autocomplete="current-password"></label><label class="field">Nuova password<input name="newPassword" type="password" required minlength="10" maxlength="200" autocomplete="new-password"></label><label class="field">Conferma nuova password<input name="confirmPassword" type="password" required minlength="10" maxlength="200" autocomplete="new-password"></label><button class="secondary">Salva password</button></form>`:'';
 return `${embedded?'':'<section class="hero"><h1>Impostazioni</h1></section>'}${nicknameNotice(u,{profile:true})}<section class="profile-account profile-embedded">${email}<form id="profile-name" class="profile-name-form"><label class="field">Soprannome<input name="name" value="${esc(u.name)}" required maxlength="60"></label><button class="secondary" aria-label="Salva soprannome">Salva</button></form>${verification}${password}</section>${embedded?'':settingsFooter()}`;
}
function accountGroups(settings){
 const u=state.user;
 const toggle=(id,label,checked=false,attrs='')=>`<label class="account-toggle" ${attrs}><span>${label}</span><input type="checkbox" role="switch" class="fanta-switch" id="${id}" ${checked?'checked':''}></label>`;
 const bar=`<section class="account-alerts"><h2>Il bar ti chiama</h2>${toggle('chat-notify-preference','Messaggi di Chiacchiere da bar',false,'data-chat-preference-row hidden')}${toggle('reminder-preference','Promemoria schedina - due ore prima',u.remindersEnabled!==false)}${toggle('email-reminder-preference','Promemoria mail schedina o formazione - due ore prima',u.emailRemindersEnabled)}<button type="button" class="secondary" id="enable-device-alerts">Attiva avvisi su questo dispositivo</button></section>`;
 return {account:{summary:'Soprannome e accesso',html:profile({embedded:true})},avvisi:{summary:'Bar e Fanta',html:bar+renderFantaNotificationSettings(settings,{disabled:!settings,compact:true})},...(u.emailVerified&&!u.demo?{assistenza:{summary:'Segnalazioni e suggerimenti',html:supportSection()}}:{})};
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
  const dashboard=$('#league-dashboard');
  if(dashboard)dashboard.onclick=e=>{
    const reward=e.target.closest('[data-recap-reward]')?.dataset.recapReward;
    if(reward)void openStudio(reward);
    const slip=e.target.closest('[data-dashboard-slip]');
    if(slip)openDashboardSlip(slip);
  };
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
  function openDashboardSlip(b){
    const targetRound=L().rounds.find(x=>x.id===b.dataset.dashboardSlip);if(targetRound?.source==='fantacalcio'){openNativeSlips();return;}
    changeSource(); const round=L().rounds.find(x=>x.id===b.dataset.dashboardSlip);
    if(round){sourceScope=sourceOf(round);selectedRoundId=round.id;competitionScope=round.competitionKey||null;}
    slipScope='mine';page='schedina';writeAppRoute({mode:'bar',page:'schedina',league:L()?.id,round:selectedRoundId});hydrateDraft();render();window.scrollTo(0,0);
  }
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
 return randomLeagueControls(l,state.user)+'<div id="league-dashboard">'+leagueDashboard(l,state.user,'seriea',false,esc,fmt,null)+'</div>'+barHomeInvite(l,state.user,esc)+fantasyNudge(l)+'<div id="league-objectives">'+achievementBoard(l,esc,dashboardSource,dashboardCompetition,{calendar:state.calendar})+'</div>';
}
let presidentGroup=null;
function barRulesForm(l){
 return `<form id="rules"><h3>Le regole del Bar</h3><p>Ogni esito corretto vale la sua quota. Un errore vale zero punti.</p>
 <label class="field">Crediti iniziali per i nuovi iscritti<input name="initial" type="number" step="0.25" value="${l.rules.initial}" required></label>
 <label class="field"><span><input type="checkbox" name="points" ${l.rules.winners.includes("points")?"checked":""}> Premia primo per punti</span></label>
 <label class="field"><span><input type="checkbox" name="credits" ${l.rules.winners.includes("credits")?"checked":""}> Premia primo per crediti</span></label>
 <button class="primary">Salva regole</button></form>`;
}
function barMembers(l){return '<ul class="bar-members">'+l.members.map(m=>'<li><span>'+esc(m.name)+'</span>'+(m.uid===l.admin?'<small>Presidente</small>':'')+'</li>').join('')+'</ul>';}
// Lega del Bar: una schermata a riquadri. Stessi pulsanti e destinazioni di prima.
function barLeagueInfo(l){
 const admin=isLeagueAdmin(l,state.user.id),tasks=admin?barPresidentTasks(l).length:0;
 const rules='Punti pari alla quota';
 return hubHead(l.name,l.members.length+' al bancone')+'<div data-os-content><div class="lega-hub">'+
  (admin?hubTile('gear','Pannello del presidente',tasks?tasks+(tasks===1?' cosa da fare':' cose da fare'):'Tutto in ordine',{action:'data-bar-page="admin"',admin:true}):'')+
  hubTile('people','Partecipanti · '+l.members.length,'Chi è al bancone',{html:admin?leagueMembers(l,true):barMembers(l)})+
  hubTile('rules','Regolamento del Bar',rules,{action:'data-bar-page="regolamento"',arrow:true})+
  (l.code?hubTile('invite','Invita nella tua lega','Condividi l’invito',{action:'data-share-league',whatsapp:whatsappInvite(l,esc,{iconOnly:true})}):'')+
  hubTile('chat','Chiacchiere da bar','Apri la chat della lega',{action:'data-league-chat aria-controls="league-chat-widget"'})+
  '</div>'+leagueActions()+'</div>';
}
function leagueAdmin(l){
 const admin=isLeagueAdmin(l,state.user.id);
 if(!admin)return barLeagueInfo(l);
 const color=LEAGUE_COLORS.find(([v])=>v===l.branding?.accent)?.[1]||LEAGUE_COLORS[0][1];

 return presidentPanel({mode:'bar',title:'Pannello del presidente',back:'data-bar-page="barleague"',open:presidentGroup,tasks:admin?barPresidentTasks(l):[],groups:{
 regole:{summary:'Punti a quota · '+l.rules.initial+' cr iniziali',html:admin?barRulesForm(l):'<button type="button" class="secondary" data-bar-page="regolamento">Leggi il regolamento</button>'},
 ...(admin?{
 identita:{summary:'Simbolo '+(l.branding?.emblem||'Q')+' · '+color,html:brandingForm(l)}
 }:{}),
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
  const view=openMatchPage({label:'Regolamento del Bar',swipeBack:'both'});
  view.classList.add('bar-rules-page');
  view.innerHTML='<button type="button" class="secondary rule-close" id="close-modal">← Chiudi regolamento</button>'+regulation(L(),R());
  view.querySelector('.rule-close').onclick=()=>view.close();
}
function regulation(l){
 const initial=fmt(l?.rules?.initial??500);
 return `<section class="hero"><h1>IL REGOLAMENTO.</h1></section><div class="rule-grid">
  <article class="card"><h3>Come giocare</h3><p>Scegli le partite che vuoi, con un esito per partita. Ogni scelta si chiude al suo calcio d’inizio. La puntata si blocca quando inizia la prima partita che hai scelto.</p></article>
  <article class="card"><h3>Punti</h3><p>Ogni esito giusto vale la quota accettata. Quota 1,35 significa 1,35 punti. Esiti sbagliati o saltati valgono zero. Si parte dalla giornata 11 di Serie A 2026/27 e dalle giornate Fanta corrispondenti ancora da liquidare.</p></article>
  <article class="card"><h3>Puntata</h3><p>Hai ${initial} crediti virtuali iniziali. Puoi puntare da 1 credito al saldo disponibile, tenendo da parte 1 credito per ogni giornata successiva in cui devi ancora giocare.</p></article>
  <article class="card"><h3>Crediti</h3><p>Se indovini tutte le partite giocate, ricevi la puntata moltiplicata per il prodotto delle quote. Gli eventi annullati valgono quota 1. Se sono tutti annullati, ti viene restituita la puntata.</p></article>
  <article class="card"><h3>Risultati</h3><p>Live, punti e crediti diventano definitivi dopo la conferma dei risultati. Le quote mancanti sono indicate con ?. Le giornate già liquidate conservano il loro punteggio.</p></article>
 </div>`;
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
function navigatePage(next) {
  if(next===page)return;
  if(next!=='chat'&&chatOpen)closeLeagueChat();
  if(next==='schedina'){persistDraft();selectedRoundId=null;slipScope='mine';hydrateDraft();}
  sourceScope='seriea';dashboardSource='seriea';
  writeAppRoute({mode:'bar',page:({lega:'oggi',schedina:'schedina',classifiche:'classifica',quasi:'quasi',profilo:'profilo',impostazioni:'impostazioni',regolamento:'regolamento',admin:'admin',barleague:'lega'})[next]||next,league:L()?.id});
  if (next === "chat") { openLeagueChat(); return; }
  persistDraft();
  page = next;
  // Navigation uses the authenticated snapshot already in memory. Mutations refresh
  // it explicitly; the single DB-only live channel patches results every minute.
  render();
  window.scrollTo(0, 0);
}
function nativeSlipServices(){return {
 account:{groups:accountGroups,bind:(onChanged,barLeague)=>bindAccount(onChanged,{manageFanta:false,barLeague})},
 applyLive:data=>mergeLiveSnapshot(state,data),
 snapshot:()=>state,
 save:async(payload,{onAcknowledged}={})=>{let result;try{result=await api('slip',payload);onAcknowledged?.();}catch(error){if(error.status===409){const next=await api('state?lite=1&ledger=0');if(Array.isArray(next?.leagues)){state=next;markPublicSlipChoices();}}throw error;}if(applyAcknowledgedSlip(result)){markPublicSlipChoices();return;}const next=Array.isArray(result?.state?.leagues)?result.state:Array.isArray(result?.leagues)?result:await api('state?lite=1&ledger=0');if(!Array.isArray(next?.leagues))throw Error('Schedina inviata. Ricarica per verificarne lo stato.');state=next;markPublicSlipChoices();},
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
  if(target?.page){page=['create-league','join-league'].includes(target.page)?'lega':target.page==='invita'?'impostazioni':target.page;writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page,league:L()?.id});}
  render();window.scrollTo(0,0);liveChannel.wake();if(['create-league','join-league'].includes(target?.page)){document.getElementById('v2-open-leagues')?.click();document.querySelector('[data-v2-action="'+(target.page==='join-league'?'join':'create')+'"]')?.click();}
  if(target?.page==='invita')document.querySelector('[data-app-invite]')?.scrollIntoView({block:'start'});
  if(target?.match)[...document.querySelectorAll('[data-match-card]')].find(row=>row.dataset.matchCard===target.match)?.scrollIntoView({block:'center'});
}
function bindAccount(onChanged=()=>{},{manageFanta=true,barLeague}={}) {
  const chatSetting=$('#chat-notify-preference'),room=barLeague??chatLeague();
  const chatRow=chatSetting?.closest?.('[data-chat-preference-row]');
  if(chatRow&&room&&!state.user?.demo){
    chatRow.hidden=false;
    chatSetting.checked=!!room.chat?.notify;
    chatSetting.onchange=async()=>{
      const desired=chatSetting.checked;
      chatSetting.disabled=true;
      try{
        if(desired){
          if(!pushSupported()||await Notification.requestPermission()!=='granted')throw Error('Autorizza gli avvisi sul dispositivo per ricevere i messaggi.');
          await enableLeagueNotifications({league:room,user:state.user,api});
        }else await api('chat-preferences',{league:room.id,notify:false});
        room.chat={...room.chat,notify:desired};
        notify(desired?'Avvisi della chat attivi.':'Avvisi della chat silenziati.');
      }catch(error){chatSetting.checked=!desired;notify(error.message);}
      finally{chatSetting.disabled=false;}
    };
  }
  if($("#edit-suggested-nickname"))$("#edit-suggested-nickname").onclick=()=>{const d=$(".profile-account");if(d)d.open=true;$("#profile-name input")?.focus();};
  if($('#email-reminder-preference'))$('#email-reminder-preference').onchange=async e=>{const enabled=e.target.checked;try{await api('profile-email-reminders',{enabled});state.user.emailRemindersEnabled=enabled;notify(enabled?'Promemoria email attivato':'Promemoria email disattivato');}catch(error){e.target.checked=!enabled;notify(error.message);}};
  if($('#reminder-preference'))$('#reminder-preference').onchange=async e=>{const enabled=e.target.checked;try{await api('profile-reminders',{enabled});state.user.remindersEnabled=enabled;notify(enabled?'Promemoria schedina attivi':'Promemoria schedina disattivati');}catch(error){e.target.checked=!enabled;notify(error.message);}};
  if($('#enable-device-alerts'))$('#enable-device-alerts').onclick=async e=>{if(state.user?.demo){notify('Nella demo gli avvisi sono simulati. Non attiviamo notifiche sul dispositivo.');return;}if(!pushSupported()){notify('Apri la PWA installata per attivare gli avvisi sul dispositivo.');return;}const permission=Notification.requestPermission();e.target.disabled=true;try{if(await permission!=='granted')throw Error('Consenso non concesso. Puoi cambiarlo nelle impostazioni del dispositivo.');await enableLeagueNotifications({league:room||L(),user:state.user,api,notifyChat:false});notify('Avvisi attivati su questo dispositivo');}catch(error){notify(error.message);}finally{e.target.disabled=false;}};
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
  const password=$('#account-password');
  if(password)password.onsubmit=async event=>{
    event.preventDefault();
    const data=Object.fromEntries(new FormData(password)),button=password.querySelector('button');
    if(data.newPassword!==data.confirmPassword){notify('Le nuove password non coincidono.');return;}
    button.disabled=true;
    try{await api('change-password',data);password.reset();notify('Password aggiornata.');}catch(error){notify(error.message);}finally{button.disabled=false;}
  };
  if(manageFanta)bindBarFantaAlerts();
  bindSupportInline();
  if($("#logout"))$("#logout").onclick=e=>void returnToLanding(e.currentTarget);
}
function bindBarFantaAlerts(){
 const section=document.querySelector('[data-president-section="avvisi"]');
 if(!section)return;
 const toggles=[...section.querySelectorAll('[data-notify]')];
 let pending=false,settings;
 let client;
 const paint=()=>{for(const toggle of toggles){toggle.disabled=pending||!settings;toggle.checked=settings?.notify?.[toggle.dataset.notify]!==false;}};
 const load=async()=>{if(!section.open||pending||settings)return;pending=true;try{client??=state.user.demo?(await import('./demo-session.mjs')).getDemoSession().fanta:createFantaApi({userId:state.user.id});settings=(await client.me()).settings;}catch(error){notify(error.message);}finally{pending=false;paint();}};
 section.addEventListener('toggle',load);
 void load();
 for(const toggle of toggles)toggle.onchange=async()=>{
   if(pending||!settings)return;
   const next={...settings,notify:{...settings.notify,[toggle.dataset.notify]:toggle.checked}};
   pending=true;for(const input of toggles)input.disabled=true;
   try{await client.saveSettings(next);settings=next;}catch(error){notify(error.message);}finally{pending=false;paint();}
 };
}
function bind(l, r) {
  bindRandomLeagues(document);
  for(const button of document.querySelectorAll('[data-share-league]'))button.onclick=()=>void shareLeagueInvite(l,{notify});
  const chatButton=$('[data-league-chat]');if(chatButton)chatButton.onclick=()=>openLeagueChat(chatButton);
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
  document.querySelectorAll("[data-slip-scope]").forEach(
    (b) =>
      (b.onclick = () => {
        if(slipScope===b.dataset.slipScope)return;
        persistDraft();selectedRoundId=r?.id||null;slipScope = b.dataset.slipScope;hydrateDraft();
        render();
      }),
  );
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
        (b.onclick = () => flipAnalysis(b)),
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
        ? "?"
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
          maxStake: l.rules.maxStake,
          correct: l.rules.correct,
          wrong: l.rules.wrong,
          mode: l.rules.mode,
          marketPoints: l.rules.marketPoints,
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
  const rows=t.rows.map((x,i)=>`<tr data-ranking-team="${esc(x.name)}"><td>${i+1}</td><td>${teamLabel(x.name,{fantasy:false})}</td><td><b class="green">${x.points}</b></td>${["played","won","drawn","lost","gf","gs","dr"].map(k=>`<td>${x[k]}</td>`).join('')}</tr>`).join('');
  return `<h1 class="sr-only">Classifica Serie A</h1><div data-os-content data-os-flow class="serie-standings"><div class="serie-table-card"><table class="serie-table"><thead><tr>${columns.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
}
function otherSlips(l, r) {
  if (!l || !r)
    return '<div class="card">Entra in una lega per consultare le schedine.</div>';
  return barSlipsView({ l, r, uid: state.user.id, fmt, rounds: availableRounds(), sourceOf });
}
// Verdicts for the whole table arrive in one light request shared by both sides of every tile.
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
  bindBarSlipPages(root);
  if (!root || !l || !r?.closed) return;
  root.querySelectorAll("[data-quasi-member]").forEach((button) => {
    const member = l.members.find((m) => m.uid === button.dataset.quasiMember);
    if (member) bindQuasiZoom(button, member);
  });
  if (r.pointsOnly || sourceOf(r) === "fantacalcio") return;
  const round = r.id;
  loadBarVerdicts(r)
    .then((players) => {
      if (R()?.id === round) barVerdictPatch(document.querySelector(".bar-table"), players);
    })
    .catch(() => {
      document.querySelectorAll('[data-bar-quip]').forEach(q=>{q.hidden=true;});
      document.querySelectorAll("[data-bar-archetype]").forEach((q) => (q.textContent = ""));
    });
}
async function flipAnalysis(button) {
  const flipped=button.getAttribute('aria-pressed')==='true';
  setPitchFlip(button,!flipped);
  const back=button.closest('.bar-tile').querySelector('[data-bar-profile]');
  if(flipped||back.dataset.profileState==='ready'||back.dataset.profileState==='loading')return;
  const l=L(),uid=button.dataset.analyze,r=l?.rounds?.find(x=>x.id===button.dataset.round)||R();
  back.dataset.profileState='loading';
  back.innerHTML='<p role="status">Caricamento…</p>';
  try {
    const players = await loadBarVerdicts(r),
      a = players.find((x) => x.uid === uid);
    if (!a) throw new Error("Nessun profilo disponibile per questa giornata");
    const member = l.members.find((m) => m.uid === uid) || {},
      slip = (r.publicSlips || []).find((x) => x.uid === uid);
    back.innerHTML = barProfileView(a, { name: member.name || "Giocatore", avatar: member.avatar, slip, round:r, fmt });
    bindQuasiZoom(back.querySelector('.bar-dossier-quasi'), { ...member, name: member.name || 'Giocatore' });
    back.dataset.profileState='ready';
  } catch (e) {
    back.innerHTML = `<p class="muted">${esc(e.message)}</p>`;
    back.dataset.profileState='error';
  }
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
const liveMatchStatus=status=>['LIVE','1H','HT','2H','ET','BT','P'].includes(status);
const matchDetailScore=match=>(liveMatchStatus(match.status)?match.liveScore||match.score:match.score)?.join('–')||'—';
function matchDetailStatus(match){
  if(['FT','AET','PEN'].includes(match.status))return 'Finale';
  if(liveMatchStatus(match.status))return match.clock?'Live · '+match.clock:'Live';
  return 'Da giocare';
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
      name=>teamLabel(name,{fantasy:true}),
      fmt,
    );
    d.dataset.match = id;
    d.dataset.fantasyRevision=match.detailRevision||match.details?.at||'';
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
    const availability=matchAvailability(data),hasDetails=!!(events.length||availability);
    const details=`<div class="match-details-body">
      <h3>Dettagli della partita</h3>
      <div data-match-availability ${availability?'':'hidden'}>${availability}</div>
      <div data-live-detail-events ${events.length?'':'hidden'}>${events.length?eventColumns(data,events):''}</div>
      <div data-live-detail-penalties ${events.length?'':'hidden'}>${footballPenalties(data,{compact:true})}</div>
    </div>`;
    dialog.innerHTML = `<div class="match-headline">
      <button type="button" class="secondary match-nav-button match-close" id="close-modal" aria-label="Chiudi partita">×</button>
      <h2 class="match-page-title">${teamLabel(data.home,{home:true,vs:data.away,fantasy:false})}<b class="match-page-score" data-live-detail-score>${matchDetailScore(data)}</b>${teamLabel(data.away,{home:false,vs:data.home,fantasy:false})}</h2>
      <p class="muted" data-live-detail-status>${esc(matchDetailStatus(data))}</p>
      <button type="button" class="secondary match-nav-button" data-match-details-button aria-label="Dettagli della partita" ${hasDetails?'':'hidden'}>›</button>
    </div>${renderLineup(data,{paged:true,details,detailsAvailable:hasDetails})}`;
    dialog.querySelector('#close-modal').onclick=()=>dialog.close();
    const arrow=dialog.querySelector('[data-match-details-button]');
    let returnPage=null;
    const carousel=bindLineupPitch(dialog,{onPage:showing=>{
      if(!showing&&arrow.textContent==='‹')returnPage=null;
      if(arrow.textContent===(showing?'‹':'›'))return;
      arrow.textContent=showing?'‹':'›';
      arrow.setAttribute('aria-label',showing?'Torna alle formazioni':'Dettagli della partita');
    }});
    arrow.onclick=()=>{
      if(dialog._pitchPage===carousel.teamCount){carousel.go(returnPage??carousel.teamCount-1);return;}
      returnPage=dialog._pitchPage;
      carousel.go(carousel.teamCount);
    };
    const headline=dialog.querySelector('.match-headline');
    let start=null;
    headline.addEventListener('touchstart',event=>{start=event.touches.length===1?event.touches[0]:null;},{passive:true});
    headline.addEventListener('touchcancel',()=>{start=null;},{passive:true});
    headline.addEventListener('touchend',event=>{
      const first=start,point=event.changedTouches[0];start=null;
      if(!first||!point)return;
      const dx=point.clientX-first.clientX,dy=point.clientY-first.clientY;
      if(Math.abs(dx)>=22&&Math.abs(dx)>Math.abs(dy)*1.4)carousel.go(dialog._pitchPage+(dx<0?1:-1));
    },{passive:true});
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

function supportSection() {
  return '<p class="muted">Scrivici un’idea o descrivi cosa non funziona. Risponderemo alla tua email verificata.</p><form id="support-form"><div class="support-fields"><label class="field">Tipo<select name="kind"><option value="suggestion">Suggerimento</option><option value="bug">Bug</option></select></label><label class="field">Titolo<input name="subject" minlength="3" maxlength="100" required></label></div><label class="field">Messaggio<textarea name="message" rows="3" minlength="10" maxlength="4000" required></textarea></label><button class="primary">Invia messaggio</button><p id="support-status" role="status"></p></form>';
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
      const d=openMatchPage({kind:'postcard',label:'Cartolina del Bar',swipeBack:true});
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
    const controls=()=>{
      const bar=$(".v2-slipbar");
      patchSlipBar(bar,{round:R(),picks,stake,credits:me().credits,esc,fmt,date});
      const save=bar?.querySelector("#save-slip");
      if(!save)return;
      save.disabled=save.disabled||busy||offline||!!draftConflict;
      if(busy){save.textContent="Salvataggio in corso…";save.setAttribute("aria-busy","true");}
      else save.removeAttribute("aria-busy");
      if(busy)bar.querySelectorAll("#stake,[data-stake-step],[data-ticket-stake]").forEach(control=>control.disabled=true);
    };
    const redrawChoices=(fromLive=false)=>{
      const round=R();
      if(!patchSlipV2(document,{round,picks,stake,credits:me().credits,openMatch:activeMarketId,esc,fmt,date})){if(!fromLive)render();return;}
      controls();bindSlipV2(document,choiceHandlers);
      if(!fromLive)patchSlipResults($('#app'),round,picks,isClosed(round));
    };
    const choiceHandlers={
      onPick: (id, value) => {
        const round=R();
        if(busy||editingEventLocked(round,round?.matches.find(m=>m.id===id)))return;
        if (picks[id] === value) delete picks[id]; else picks[id] = value;
        persistDraft(); redrawChoices();
      },
      onToggle: (id) => { activeMarketId = activeMarketId === id ? null : id; redrawChoices(); },
      onStake: (value) => { if(busy||editingClosed(r)||slipSummary(r,picks,stake).fixedStake)return; stake = value; persistDraft(); controls(); },
      onSave: async () => { const pending = saveCurrentSlip(); controls(); await pending; controls(); },
    };
    controls();
    bindSlipV2(document,choiceHandlers);
    refreshBarTicket=()=>redrawChoices(true);
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
      reconcileSlipDraft(R());
      editBaseSavedAt = R()?.slip?.savedAt || null;
      editBaseFingerprint = fingerprint(
        R()?.slip?.picks,
        R()?.pointsOnly ? 0 : R()?.slip?.stake || 1,
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
      const target=typeof e.data.url==="string"?new URL(e.data.url,location.origin):null;
      const route=target?.origin===location.origin?readAppRoute(target.hash):null;
      const league=typeof e.data.league==="string"?e.data.league:route?.league;
      if(!league)return;
      const page=route?.mode==='fanta'&&['asta','squadra','giornata'].includes(route.page)?route.page:'oggi';
      const navigation={...route,mode:'fanta',page,league};
      try{localStorage.setItem('qdq:mode','fanta');localStorage.setItem('qdq:fantaLeague',league);}catch{}
      if(!state.user){pendingAppRoute=navigation;return;}
      writeAppRoute(navigation);closeLeagueChat();
      void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:league,initialTab:page,onBar:openBarTarget,force:true});
      return;
    }
    if(e.data?.type==='open-slip'&&!state.user&&typeof e.data.league==='string'){
      requestedSlip=e.data.league;requestedSlipRound=e.data.round;return;
    }
    if(e.data?.type==='open-slip'&&state.leagues.some(l=>l.id===e.data.league)){
      persistDraft();leagueId=e.data.league;const round=L().rounds.find(r=>r.id===e.data.round);if(round){sourceScope=sourceOf(round);competitionScope=round.competitionKey||null;selectedRoundId=round.id;}page='schedina';slipScope='mine';hydrateDraft();render();window.scrollTo(0,0);return;
    }
    if(e.data?.type==="open-chat"&&typeof e.data.league==="string"){
      requestedChat=e.data.league;
      try{sessionStorage.setItem("qdq:pending-chat",requestedChat);}catch{}
      if(state.user?.emailVerified){
        persistDraft();
        if(openChatNotification(requestedChat)){clearRequestedChat();hydrateDraft();render();window.scrollTo(0,0);}
        else void refresh();
      }
    }
  });
let liveStatus=null;
let liveDisplayFailures=0;
function showLiveStatus(value){
 if(value!==liveStatus)liveDisplayFailures=value.state==='ready'?0:liveDisplayFailures+1;
 liveStatus=value;const el=$('#live-channel-status');if(!el)return;
 const show=page==='schedina'&&slipScope!=='standings'&&value.state!=='ready'&&liveDisplayFailures>=3;el.hidden=!show;
 if(!show){el.textContent='';return;}
 const text='Aggiornamento in pausa';
 if(el.textContent!==text)el.textContent=text;
}
function applyLive(data){
  if(L()?.id!==data.league)return;
  mergeLiveSnapshot(state,data);
  if(preferredFanta())return;
  const round=R();
  if(round&&editingClosed(round))document.querySelectorAll("#save-slip,#stake,[data-stake-step],[data-ticket-stake]").forEach(e=>e.disabled=true);
  if(round){
    if($('.bar-ticket')&&!busy&&!offline&&!draftConflict)refreshBarTicket?.();
    patchSlipResults($('#app'),round,picks,isClosed(round));
  }
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
      const score=dialog.querySelector('[data-live-detail-score]'),value=matchDetailScore(m);
      if(score&&score.textContent!==value)score.textContent=value;
      const status=dialog.querySelector('[data-live-detail-status]'),label=matchDetailStatus(m);
      if(status&&status.textContent!==label)status.textContent=label;
      const events=dialog.querySelector('[data-live-detail-events]');
      const availability=dialog.querySelector('[data-match-availability]');
      if(events&&Array.isArray(m.details?.events)){
        const items=m.details.events.filter(isMatchEvent),html=items.length?eventColumns(m,items):'';
        if(events.dataset.revision!==html){patchRegion(events,'<div data-live-detail-events'+(items.length?'':' hidden')+'>'+html+'</div>');events.dataset.revision=html;}
      }
      if(availability&&(m.lineups||matchDetailStatus(m)!=='Da giocare')){
        const html=matchAvailability(m);
        if(availability.dataset.revision!==html){patchRegion(availability,'<div data-match-availability'+(html?'':' hidden')+'>'+html+'</div>');availability.dataset.revision=html;}
      }
      if(events&&availability){
        const hidden=events.hidden&&availability.hidden;
        dialog.querySelector('.pitch-details-panel').hidden=hidden;
        dialog.querySelector('[data-match-details-button]').hidden=hidden;
      }
      const penalties=dialog.querySelector('[data-live-detail-penalties]');
      if(penalties&&events){
        if(m.details?.penalties!==undefined){const html=footballPenalties(m,{compact:true});if(penalties.dataset.revision!==html){patchRegion(penalties,'<div data-live-detail-penalties>'+html+'</div>');penalties.dataset.revision=html;}}
        penalties.hidden=events.hidden;
      }
    }
  }
}
document.addEventListener('quasi:chat-context',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league||l.id===e.detail?.league);syncChatLauncher(linked||null);if(linked)updateChatWidget();});
document.addEventListener('quasi:chat-update',e=>{
 const {league,unread,latest,revision,read,changed}=e.detail||{},entry=state.leagues.find(l=>l.id===league);
 if(!entry||!Number.isSafeInteger(unread)||latest<(entry.chat?.latest||0)||revision<(entry.chat?.revision||0)||read<(entry.chat?.read||0))return;
 entry.chat={...entry.chat,unread,latest,revision,read};chatBadge();
 if(changed&&chatOpen&&chatLeagueId===league)refreshChat();
});
document.addEventListener('quasi:chat-reconnect',()=>{if(state.user&&!state.user.demo)void refresh();});
document.addEventListener('quasi:fanta-team-claimed',()=>{void refresh();});
document.addEventListener('quasi:open-chat',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league);if(linked){syncChatLauncher(linked);openLeagueChat(e.detail.trigger);}});
document.addEventListener('click',e=>{const target=e.target.closest('[data-bar-page]');if(target&&!target.hasAttribute('data-mode')&&['join-league','create-league'].includes(target.dataset.barPage)){openBarTarget({page:target.dataset.barPage});return;}if(target&&!target.hasAttribute('data-mode')&&['profilo','impostazioni','regolamento','admin','barleague','invita'].includes(target.dataset.barPage)){const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}if(target.dataset.barPage==='regolamento'){openBarRules();return;}void navigatePage(target.dataset.barPage==='invita'?'impostazioni':target.dataset.barPage);if(target.dataset.barPage==='invita')document.querySelector('.settings-app-invite')?.scrollIntoView({block:'start'});return;}const mode=e.target.closest('[data-app-mode]')?.dataset.appMode;if(!mode)return;if(mode==='fanta'){closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:L()?.nativeFantaLink?.leagueId,onBar:openBarTarget});}else{leaveFanta();try{localStorage.setItem('qdq:mode','bar');}catch{}render();}});
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
  if(page==='schedina'&&R()?.eventBetting){
    if(!busy&&eventLockKey(R())!==displayedEventLocks){reconcileSlipDraft(R());persistDraft();render();}
    return;
  }
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
window.addEventListener('popstate',()=>{const route=readAppRoute();if(!route||!state.user)return;if(route.mode==='fanta'){void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),onBar:openBarTarget,initialTab:route.page,leagueId:route.league,force:false});return;}leaveFanta();page=({oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',profilo:'profilo',impostazioni:'impostazioni',regolamento:'regolamento',admin:'admin',lega:'barleague'})[route.page]||'lega';if(state.leagues.some(l=>l.id===route.league))leagueId=route.league;sourceScope='seriea';if(route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;hydrateDraft();render();});
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



