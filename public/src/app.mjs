import {joinInvite} from './invite-join.mjs';
import {bindSwipeBack,openMatchPage} from './match-page.mjs';
import {backButton,bindScreenBack} from './back-navigation.mjs';
import {withMembershipProgress} from './membership-progress.mjs';
import {bindSiteValidation} from './site-validation.mjs';
import {askConfirmation} from './site-confirm.mjs';
import {presidentWorkspace,presidentOperationButtons} from './president-workspace.mjs';
import {barReminder,bindPresidentReminders,renderPresidentReminders} from './president-reminders.mjs';
import {settingsFooter,presidentEntry,presidentPanel,bindPresidentPanel} from './president-panel.mjs';
import {createSportsPush} from './sports-push.mjs';
import {paintAuctionBadges,trackAuctionBadges} from './auction-index.mjs';
import {nicknameNotice} from './nickname-notice.mjs';
import {slipCreditReserve,slipStakeLimit} from "../slip-events.mjs";
import {applySlipReceipt} from './slip-receipt.mjs';
import {loadAppStyles} from './app-styles.mjs';
import {saveOnce,identifySlipSave} from './save-guard.mjs';
import {readAppRoute,writeAppRoute,isSubmissionRoute} from './routes.mjs';
import {placeAppFooter,restoreAppFooter} from './app-footer.mjs';
import {startOneScreen} from './one-screen.mjs';
import {bindLeagueCreation,leagueCreationFields} from './league-create-form.mjs';
import {isLeagueEntryPage,renderLeagueEntry,renderLeagueOnboarding} from './league-onboarding.mjs';
import {bindLeagueDirectory} from './league-directory.mjs';
import {displayCache,clearDisplayCaches} from './display-cache.mjs';
import {randomLeagueControls,bindRandomLeagues} from './random-leagues.mjs';
import {sportsWindowActive} from './sports-window.mjs';
import {mountPublic} from './pubblico/app.mjs';
import {rememberEntry,entryIntent,clearEntry} from './acquisition-intent.mjs';
import {createPublicApi} from './pubblico/api.mjs';
import {retainAppHeader} from './mode-switch.mjs';
import {barModeSwitch,enterFanta,leaveFanta,preferredFanta,clearFantaSessions,refreshFantaMembership} from './fanta-mode.mjs';
import {createLiveChannel,requestJson,mergeLiveSnapshot,patchRegion} from "./live-channel.mjs";
import {withButtonFeedback} from './action-feedback.mjs';
import {mountFootballMatch,updateFootballMatch} from './live-match-view.mjs';
import {clubShirt} from './club-crest.mjs';
import { renderSlipV2, patchSlipV2, patchSlipBar, bindSlipV2 } from "./v2/slip-v2.mjs";
import { quasiScene, bindQuasiZoom } from "./quasi-scene.mjs";
import {barSlipsView,barVerdictPatch,barProfileView,bindBarSlipPages} from "./bar-slips.mjs";
import { renderTabBar, bindTabBar, tabForPage, routeForTab, defaultSource } from "./v2/tabs.mjs";
import { renderLeagueChip, bindLeagueSwitcher, fantaHomeStatus } from "./v2/league-switcher.mjs";
import { showLanding, hideLanding, markSession, pendingInvite, clearPendingInvite } from "./v2/landing.mjs";
const PUBLIC_AUTH_HASHES={login:'accesso',register:'registrati',forgot:'recupera',resend:'reinvia',demo:'demo'};
const submissionRouteKey='qdq:pending-submission-route';
let pendingAppRoute=readAppRoute(),inviteAttempt=null;
try{
 if(isSubmissionRoute(pendingAppRoute))sessionStorage.setItem(submissionRouteKey,JSON.stringify({hash:location.hash,at:Date.now()}));
 else if(location.hash==='#social'||location.hash.startsWith('#social-error=')){
  const saved=JSON.parse(sessionStorage.getItem(submissionRouteKey)||'null');
  const route=saved&&readAppRoute(saved.hash);
  if(isSubmissionRoute(route)&&Date.now()-saved.at<30*60000)pendingAppRoute=route;
 }
}catch{/* The link still works with the in-page login. */}
const initialPublicMode=Object.keys(PUBLIC_AUTH_HASHES).find(k=>PUBLIC_AUTH_HASHES[k]===location.hash.slice(1));
let v2Invite = pendingInvite(), landingDismissed = !!v2Invite||!!initialPublicMode, forceDemo = initialPublicMode==='demo';
let initialDemoRequested=initialPublicMode==='demo';
import {inlineResultView,patchSlipResults} from './slip-results.mjs';
import {bindLineupPitch,setPitchFlip} from './lineup-pitch.mjs';
let studioModule;const loadStudio=()=>studioModule??=import('./quasi-studio.mjs');
window.addEventListener?.('quasi:idle',()=>{if(state.user&&!studioModule)loadStudio().catch(()=>{studioModule=null;});});

import {rosterView,bindRoster} from './quasi-roster.mjs';
import {rewardById,rewardMark,rarityLabel,REWARD_TYPES} from './reward-catalog.mjs';
import {fantaQuasiTeaser,fantaQuasiPage,bindFantaQuasi} from './fanta-quasi.mjs';
import {achievementBoard} from './achievement-board.mjs';

import {applyLeagueTheme,leagueIdentityKey,paintLeagueIdentity} from './league-theme.mjs';
import {leagueIdentityForm,bindLeagueIdentityForm} from './league-identity-form.mjs';
import {barLeagueFallback,bindLeagueWorkspace,leagueWorkspace} from './league-workspace.mjs';
import {whatsappInvite} from './league-invite.mjs';
import {createFantaApi} from './fanta/api.mjs';
import {renderFantaNotificationSettings} from './fanta/io.mjs';
import {bindAppInvites} from './app-invite.mjs';
import {rewardsView,bindRewards} from './progression-ui.mjs';
import {bindStyledSelects,syncStyledSelects,closeStyledSelect} from './styled-select.mjs';


import { leagueDashboard } from './league-dashboard.mjs';
import {tickHomeCountdowns} from './home-social.mjs';
import {openHomeStory} from './home-stories.mjs';
import {mergeChatSummary,paintChatBadges} from './chat-badges.mjs';
let requestedSlip=new URLSearchParams(location.search).get('slip'),requestedSlipRound=new URLSearchParams(location.search).get('round');
import {calendarMatchTab,serieACalendar} from './bar-calendar.mjs';
import {restoreRoundCalendarScroll} from './round-calendar.mjs';
import { playerRanking, fantasyTableView } from "./bar-fanta-rankings.mjs";
import {
  sourceOf,
  roundAvailability,currentSlipRound,defaultSlipRound,selectableSlipRounds,currentPublicSlipRound,selectablePublicSlipRounds,slipRomeDay,alignSerieASlipKickoffs,slipWaitingForPrevious,
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
function teamLabel(name,{vs,home,shirtAfter=false,fantasy=sourceScope==='fantacalcio'}={}) {
  if(!fantasy){
    const shirt=clubShirt(name,{vs,home}),text=`<span class="team-name">${esc(name)}</span>`;
    return `<span class="team-label">${shirtAfter?text+shirt:shirt+text}</span>`;
  }
  const team=Object.values(L()?.fantasyTeams?.[competitionScope]||{}).find(t=>t.name===name);
  const logo=team?.logo||team?.shirt;
  const icon=logo?`<img class="team-logo" data-deferred-src="${esc(logo)}" alt="" width="32" height="32" loading="lazy" onerror="this.hidden=true">`:`<span class="crest">${esc(name.slice(0,2))}</span>`;
  return `<span class="team-label" data-fantasy-team="${esc(name)}" data-fantasy-competition="${esc(competitionScope)}">${icon}<span>${esc(name)}</span></span>`;
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
function chatLeague(){return state.leagues.find(l=>l.id===chatLeagueId);}
function syncChatLauncher(league=L()){
 const next=league?.id||null;
 if(chatContext&&next!==chatLeagueId)closeLeagueChat();
 chatLeagueId=next;chatBadge();
}
function chatBadge(){paintChatBadges(document,state.leagues,chatLeague());}
function applyChatSummary(id,detail){
 const entry=state.leagues.find(l=>l.id===id);
 if(!entry)return false;
 const next=mergeChatSummary(entry.chat,detail);
 if(entry.chat===next)return false;
 entry.chat=next;chatBadge();return true;
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
      onUnread: detail=>applyChatSummary(league.id,detail),
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
async function openBarDemo(target={}){await prepareDemo();await loadAppStyles();if(target?.page==='logout'){await returnToLanding();return;}leaveFanta();leagueId=target?.league||leagueId;page=target?.page==='barleague'?'barleague':target?.page==='invita'?'impostazioni':barPageFor(target);sourceScope=target?.sourceScope||'seriea';selectedRoundId=target?.round||null;hydrateDraft();render();writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page,league:leagueId});}
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
 const now=Date.now();
 for(const round of all)round.waitingForOpen=slipWaitingForPrevious(round,state.calendar?.rounds,now);
 return selectableSlipRounds(all,now,state.calendar).sort((a,b)=>(Number(a.number)-Number(b.number))||Date.parse(a.kickoff)-Date.parse(b.kickoff));
}

function R() {
  const rounds = availableRounds();
  const round=rounds.find(r=>r.id===selectedRoundId)||defaultSlipRound(rounds,Date.now(),state.calendar);
  const league=L();
  if(round){
    alignSerieASlipKickoffs(round,state.calendar);
    round.stakeReserve=slipCreditReserve(round,league.rounds,league,state.user?.id);
  }
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
const barRoutePages={solleciti:'solleciti',seriea:'seriea',partecipanti:'partecipanti',oggi:'lega',schedina:'schedina',classifica:'classifiche',quasi:'quasi',profilo:'profilo',impostazioni:'impostazioni',regolamento:'regolamento',admin:'admin',lega:'barleague'};
const barPageFor=route=>route?.page==='calendario'||route?.page==='classifica'&&route.section==='calendario'?'calendario':
 route?.page==='join-code'?'join-league':isLeagueEntryPage(route?.page)?route.page:barRoutePages[route?.page]||'lega';
const barCalendar={openRound:null,calendarScroll:null};
const deletedLeagues=new Set();
let leagueRefreshQueued=false,leagueWorkspaceView=null,presidentOperation=null,presidentNative=null;
let finishSnapshotRefresh=null,activeSnapshotRefresh=null;
function loadLeagueWorkspace(id,mode){return requestJson('/api/league-participants?'+new URLSearchParams({league:id,mode}),{credentials:'same-origin'});}
function removeLeagueParticipant({bar,uid}){return api('member-remove',{league:bar.id,uid});}
function resetLeagueView(id=null){
  closeLeagueChat();leaveFanta();clearFantaSessions();
  if(state.user?.id)displayCache('fanta:'+state.user.id).clear();
  leagueId=id;selectedRoundId=null;presidentGroup=null;page='lega';
  writeAppRoute({mode:'bar',page:'oggi',league:id},{replace:true});
}
function reconcileLeagueSelection(){
  if(!state.user)return;
  const route=readAppRoute();
  if(!state.leagues.length){
    if(leagueId||preferredFanta()||route?.mode==='fanta'||route?.league)resetLeagueView();
    if(!isLeagueEntryPage(page)&&!['profilo','impostazioni'].includes(page))page='lega';
    try{localStorage.removeItem('quasi-active-league:'+state.user.id);localStorage.removeItem('qdq:fantaLeague');localStorage.setItem('qdq:mode','bar');}catch{}
  }else if(leagueId&&!state.leagues.some(l=>l.id===leagueId)){
    resetLeagueView(state.leagues[0].id);
  }
}
function removeDeletedLeague(id){
  deletedLeagues.add(id);
  const deleted=state.leagues.find(l=>l.id===id);
  if(!deleted)return;
  const active=L()?.id===id||deleted.nativeFantaLink?.leagueId&&deleted.nativeFantaLink.leagueId===readAppRoute()?.league;
  state.leagues=state.leagues.filter(l=>l.id!==id);
  if(active||!state.leagues.length)resetLeagueView(state.leagues[0]?.id);
  reconcileLeagueSelection();hydrateDraft();
  refreshFantaMembership(state.leagues,[]);
  render();
}
function refreshLeagueMembers(){
  if(refreshing){leagueRefreshQueued=true;return;}
  void refresh();
}
async function refreshMembershipAfterWrite({bar}={}){
  if(!bar)return;
  while(activeSnapshotRefresh)await activeSnapshotRefresh;
  const updated=await refresh(true);
  if(!updated||await leagueWorkspaceView?.ready===false)throw Error('Modifica salvata. Ricarica la lega per vedere i partecipanti aggiornati.');
}
async function refresh(reset = false) {
  if (refreshing) return false;
  refreshing = true;
  activeSnapshotRefresh=new Promise(resolve=>{finishSnapshotRefresh=resolve;});
  try {
    const next = await api("state?lite=1&ledger=0");
    if (!next || !Array.isArray(next.leagues))
      throw Error("Risposta del servizio non valida");
    const previousUser = state.user?.id,
      previousLeague = L()?.id,
      previousVerified = state.user?.emailVerified,
      previousRound = R(),
      previousLeagues=state.leagues;
    const wasDirty =
      previousRound &&
      slipSummary(previousRound, picks, stake, me()?.credits ?? Infinity).dirty;
    if (wasDirty && !reset) persistDraft();
    const previousChat=new Map(previousLeagues.map(l=>[l.id,l.chat]));
    if(previousUser===next.user?.id)for(const league of next.leagues)if(previousChat.has(league.id))league.chat=mergeChatSummary(previousChat.get(league.id),league.chat);
    state = next;for(const league of state.leagues)for(const round of league.rounds||[])round.publicChoicesAvailable=!!round.closed&&Array.isArray(round.publicSlips);sportsFeedBlockedUntil=0;
    if(state.user&&state.user.id!==previousUser){const route=readAppRoute();pendingAppRoute=null;try{sessionStorage.removeItem(submissionRouteKey);}catch{}page=route?.mode==='bar'?barPageFor(route):'lega';presidentOperation=page==='admin'?route?.section:null;if(state.leagues.some(l=>l.id===route?.league))leagueId=route.league;if(route?.mode==='bar'&&route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;}
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
    state.leagues=state.leagues.filter(l=>!deletedLeagues.has(l.id));
    const route=readAppRoute(),lostFanta=route?.mode==='fanta'&&previousLeagues.some(l=>l.nativeFantaLink?.leagueId===route.league&&!state.leagues.some(x=>x.id===l.id));
    if(lostFanta)resetLeagueView(state.leagues[0]?.id);
    reconcileLeagueSelection();
    const leagueKeys=new Map(previousLeagues.map(l=>[l.id,l.members.map(m=>m.uid).join()]));
    const changedMembers=state.leagues.filter(l=>l.members.map(m=>m.uid).join()!==leagueKeys.get(l.id));
    const leagueListChanged=state.leagues.length!==previousLeagues.length||state.leagues.some(l=>!leagueKeys.has(l.id));
    const identities=new Map(previousLeagues.map(l=>[l.id,leagueIdentityKey(l)]));
    const changedIdentity=state.leagues.filter(l=>identities.get(l.id)!==leagueIdentityKey(l));
    if(changedMembers.length||leagueListChanged||changedIdentity.length)refreshFantaMembership(state.leagues,changedMembers.map(l=>l.nativeFantaLink?.leagueId).filter(Boolean),leagueListChanged);
    if(!preferredFanta()&&changedIdentity.some(l=>l.id===L()?.id))paintLeagueIdentity(L(),'bar');
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
      lostFanta ||
      (leagueListChanged&&!preferredFanta()&&!editing&&!isLeagueEntryPage(page)) ||
      (changedMembers.some(l=>l.id===L()?.id)&&!preferredFanta()&&!editing&&['admin','barleague','lega','quasi','classifiche'].includes(page)) ||
      (!previousLeague && !!L()) ||
      (previousLeague && !state.leagues.some((l) => l.id === previousLeague))
    )
      render();
    else {
      updateConnection();
      syncTeamAssets();
      chatBadge();
      updateDashboard();
    }
    if(!document.querySelector('.membership-progress[open]'))checkLeagueAccess();
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
    finishSnapshotRefresh?.();activeSnapshotRefresh=null;finishSnapshotRefresh=null;
    if(leagueRefreshQueued){leagueRefreshQueued=false;refreshLeagueMembers();}
    if(state.user){await loadAppStyles();const header=document.getElementById('app-header');if(header)document.documentElement.style.setProperty('--ux-header-height',header.offsetHeight+'px');}
    await initialViewReady;
    window.finishEntrySplash?.();
    if(state.user)showLiveStatus({state:"ready",at:Date.now()});
  }
}
function hydrateDraft() {
  if (!fantasyAvailable()) {
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
  const l=L(), user=state.user;
  if (!user) return '<header><div class="brand"><img class="brand-logo" src="/league-logo.svg" alt="Logo Quelli del Quasi" width="38" height="44">QUELLI DEL <b>QUASI.</b></div></header>'+content;
  if (!l) {
    const settings=['impostazioni','profilo'].includes(page);
    const button=settings?'':presidentEntry('data-bar-page="impostazioni"');
    return `<header class="v2-top league-onboarding-top">${button}</header>${content}`;
  }
  if(!user.emailVerified&&!user.demo)return content;
  return renderLeagueChip(l,user.id,esc,fmt,barModeSwitch())+content+renderTabBar(tabForPage(page,sourceScope));
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
    slipScope === "community"
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
let leagueAccessModule,leaguePrompts,lastPresidentRequest=null;
const loadLeagueAccess=()=>leagueAccessModule??=import('./league-access-ui.mjs');
const leagueAccessUid=()=>state.user?.emailVerified&&!state.user.demo&&!state.user.adminOnly?state.user.id:null;
function openLeagueAccessSupport(){openBarTarget({page:'impostazioni',group:'assistenza'});}
async function enterAccessLeague(id){
 if(state.user?.id)displayCache('fanta:'+state.user.id).clear();
 leaveFanta();closeLeagueChat();page='lega';leagueId=id;selectedRoundId=null;
 try{localStorage.setItem('quasi-active-league:'+state.user.id,id);}catch{}
 writeAppRoute({mode:'bar',page:'oggi',league:id},{replace:true});await refresh(true);
}
function checkLeagueAccess(){
 if(!leagueAccessUid()){leaguePrompts?.close();return;}
 void loadLeagueAccess().then(({createLeagueAccessPrompts})=>{
  if(!leagueAccessUid())return;
  leaguePrompts??=createLeagueAccessPrompts({api,userId:leagueAccessUid,onJoined:enterAccessLeague,onRequests:request=>{
    if(request.id===lastPresidentRequest)return;lastPresidentRequest=request.id;
    if(page!=='admin'||presidentOperation!=='richieste')notify('Nuova richiesta di ingresso. Apri il pannello del presidente.');
  }});
  return leaguePrompts.check();
 }).catch(()=>{});
}
function render() {
  closeStyledSelect();
  trackAuctionBadges(accountAction?null:state.user,state.leagues);
  if(!state.user||accountAction)document.getElementById('app-header')?.remove();
  if(state.user&&!accountAction){markSession(true);hideLanding();publicUi?.destroy();publicUi=null;document.body.classList.remove('public-area');}
  if (state.user && !accountAction && state.leagues.length && (preferredFanta()||readAppRoute()?.mode==='fanta')) {
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
  if(!L())reconcileLeagueSelection();
  loadAppStyles();if(typeof startOneScreen==='function')startOneScreen();
  sourceScope='seriea';
  const l = L(),
    r = R(),
    m = me();
  if(page==='profilo'&&(state.user.emailVerified||state.user.demo)){page='impostazioni';presidentGroup='account';}
  const content =
    isLeagueEntryPage(page) ? renderLeagueEntry({page,verified:state.user.emailVerified||state.user.demo,league:l})
      : !l && page!=='profilo' && page!=='impostazioni' && (state.user.emailVerified||!pendingInvite())
      ? renderLeagueOnboarding({user:state.user})
      : (!state.user.emailVerified && !state.user.demo)
      ? profile()
      : page === "impostazioni"
        ? presidentPanel({mode:'bar',title:'Impostazioni',open:presidentGroup,back:l?'data-bar-page="barleague"':'data-page="lega"',footer:settingsFooter(),groups:accountGroups()})
        : page === "seriea"
        ? classificationTabs('seriea')+serieATable()
        : page === "altri"
          ? otherSlips(l, r)
          : page === "regolamento"
            ? backButton('data-bar-page="barleague"','Torna alla lega')+regulation(l, r)
            : page === "fantaquasi" ? fantaQuasiPage(l, state.user, esc)
              : page === "barleague" || page === "partecipanti" ? barLeagueInfo(l)
              : page === "quasi" ? quasiPage(l)
              : page === "schedina" ? slipsPage(l, r, m)
                : page === "classifiche"
                  ? classificationTabs('classifiche')+ranking(l)
                  : page === "admin"
                      ? leagueAdmin(l)
                    : page === "solleciti" && l.admin===state.user.id
                      ? barReminderPage(l)
                    : page === "lega"
                      ? settings(l, r)
                      : page === "calendario"
                        ? classificationTabs('calendario')+`<div class="fanta-calendar-scroll bar-seriea-calendar" data-os-content data-os-flow>${serieACalendar(state.calendar,barCalendar)}</div>`
                        : settings(l, r);
  document.body.dataset.gameMode='bar';
  applyLeagueTheme(l,'bar');
  $("#app").innerHTML = shell(
    '<main'+(!l||isLeagueEntryPage(page)||['admin','lega','impostazioni','seriea','classifiche','quasi','solleciti'].includes(page)?' data-os-flow':'')+'><div id="connection-status" class="notice connection-status" role="status" hidden></div>' +
      content +
      '<p id="live-channel-status" class="live-channel-status tiny muted" role="status" aria-live="polite"></p></main>',
  );

  displayedSlipRoundId=page==='schedina'?r?.id:null;
  displayedEventLocks=page==='schedina'?eventLockKey(r):'';
  retainAppHeader($('#app'));
  paintAuctionBadges();
  placeAppFooter($('#app'));
  syncChatLauncher(l);
  bind(l, r);
  const workspace=$('[data-league-workspace]');
  leagueWorkspaceView=workspace&&l?bindLeagueWorkspace(workspace,{load:state.user.demo?()=>Promise.resolve(barLeagueFallback(barDemo?.state.leagues.find(item=>item.id===l.id)||l,state.user.id)):loadLeagueWorkspace,remove:removeLeagueParticipant,initial:barLeagueFallback(l,state.user.id),onRemoved:refreshMembershipAfterWrite,onPaint:chatBadge}):null;
  const directory=$('[data-league-directory]');
  if(directory)void bindLeagueDirectory(directory,{api,onJoined:enterAccessLeague,onSupport:openLeagueAccessSupport})();
  bindPresidentPanel($('#app'));
  bindScreenBack($('#app > main'));
  const presidentWizard=$('.president-workspace');
  if(presidentWizard){
    bindPresidentOperations(presidentWizard,l);
  }
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
      removeDeletedLeague(l.id);notify('Lega eliminata.');
      refreshLeagueMembers();
    };
  }
  document.querySelectorAll('[data-president-group]').forEach(b=>b.addEventListener('click',()=>{presidentGroup=b.dataset.presidentGroup;}));
  document.querySelector('[data-president-copy-link]')?.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(location.origin+'/invito/'+encodeURIComponent(l.code));notify('Link copiato.');}catch{notify('Copia il codice della lega.');}});
  document.querySelectorAll('[data-president-section]').forEach(section=>section.addEventListener('toggle',()=>{if(!section.open&&presidentGroup===section.dataset.presidentSection)presidentGroup=null;}));
  bindNew(l, r);
  bindPresidentReminders($('.president-reminders'),data=>api('league-reminder',data));
  $("#edit-suggested-nickname")?.addEventListener("click",()=>{const section=$(".profile-account");if(section)section.open=true;const field=$("#profile-name input");field?.scrollIntoView({block:"center",behavior:"smooth"});field?.focus({preventScroll:true});});
  if(liveStatus)showLiveStatus(liveStatus);
  updateChatWidget();
  updateConnection();
  if(page!=='lega')maybeRevealRewards();
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
    leaguePrompts?.close();closeLeagueChat();leaveFanta();clearFantaSessions();if(barDemo){(await import('./demo-session.mjs')).resetDemoSession();barDemo=null;}publicUi?.destroy();publicUi=null;
    state={user:null,leagues:[],features:state.features};leagueId=null;selectedRoundId=null;competitionScope=null;
    picks={};market={};viewKey=null;draftConflict=null;editBaseSavedAt=null;activeMatchId=null;page='lega';
    accountAction=null;accountToken='';authMessage='';authMode='login';forceDemo=false;landingDismissed=false;
    markSession(false);if(push)publicHistory('landing');render();liveChannel.wake();window.scrollTo(0,0);return true;
  }catch(error){notify('Non siamo riusciti a uscire. Riprova tra poco.');return false;}
  finally{if(button?.isConnected)button.disabled=false;}
}
let publicUi=null;
function renderAuth(){
 delete document.body.dataset.gameMode;
 applyLeagueTheme(null);
 restoreAppFooter(document);
 syncChatLauncher(null);
 hideLanding();document.getElementById('landing')?.remove();document.body.classList.add('public-area');if(publicUi)return;
 publicUi=mountPublic($('#app'),{api:createPublicApi(),onDemo:async mode=>{
  if(mode==='fanta'){publicUi?.destroy();publicUi=null;document.body.classList.remove('public-area');await prepareDemo();await enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,onBar:openBarDemo});}
  else{publicUi?.destroy();publicUi=null;await openBarDemo();}
 },onLoggedIn:async result=>{
  if(result.requireAdminCode){sessionStorage.setItem('quasi-admin-challenge',JSON.stringify(result));location.assign('/admin.html');return;}
  if(entryIntent(localStorage)&&!result.invite&&!pendingInvite()&&!isSubmissionRoute(pendingAppRoute)){location.assign('/entra-fanta.html'+location.search);return;}
  leaveFanta();try{localStorage.setItem('qdq:mode','bar');}catch{}
  const code=result.invite||pendingInvite();if(code){try{const joined=await joinInvite(code,{join:code=>api('join',{code}),clear:()=>{clearPendingInvite();v2Invite=null;clearEntry(localStorage);}});leagueId=joined.league;selectedRoundId=null;pendingAppRoute={mode:'bar',page:'oggi',league:joined.league};}catch(error){notify(error.message);}}
  if(pendingAppRoute){writeAppRoute(pendingAppRoute,{replace:true});pendingAppRoute=null;try{sessionStorage.removeItem(submissionRouteKey);}catch{}}
  await loadAppStyles();
  accountAction=null;if(!await refresh(true)||!state.user)throw Error('L’accesso è riuscito, ma il bar non si è ancora caricato. Premi di nuovo Accedi tra pochi secondi.');if(!readAppRoute())writeAppRoute({mode:'bar',page:'oggi'},{replace:true});
 }});
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
    (sourceScope === "fantacalcio" ? "Punti Fantacalcio" : "Punti campionato") +
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
let quasiPane='mine';
function setQuasiPane(pane){if(pane===quasiPane)return;quasiPane=pane;render();}
function quasiPage(league){
 return `<div class="classification-tabs" data-os-header role="group" aria-label="Quasi">${[['mine','Obiettivi e premi'],['league','I Quasi della lega']].map(([id,name])=>`<button type="button" data-quasi-pane="${id}" aria-pressed="${id===quasiPane}">${name}</button>`).join('')}</div>
 <div class="bar-quasi-page" data-os-content data-os-flow>${quasiPane==='mine'?nicknameNotice(state.user)+'<div id="league-objectives">'+achievementBoard(league,esc,'seriea',null,{calendar:state.calendar})+'</div>'+rewardsView(state.user):rosterView(league,state.user.id)}</div>`;
}
function setBarRanking(metric){
 if(metric==='league'){if(page!=='seriea')void navigatePage('seriea');return;}
 if(metric==='calendar'){if(page!=='calendario')void navigatePage('calendario');return;}
 const changed=tab!==metric;tab=metric;
 if(page!=='classifiche')void navigatePage('classifiche');else if(changed)render();
}
function stepBarRanking(direction){
 const order=['points','credits','league','calendar'];
 const active=page==='calendario'?'calendar':page==='seriea'?'league':tab;
 const target=order[order.indexOf(active)+direction];
 if(target)setBarRanking(target);
}
function classificationTabs(active){return `<div class="classification-tabs" data-os-header role="group" aria-label="Classifica e calendario">${[['classifiche','Del Bar'],['seriea','Campionato'],['calendario','Calendario']].map(([target,title])=>`<button type="button" data-page="${target}" aria-pressed="${target===active}">${title}</button>`).join('')}</div>`;}
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
 const bar=`<section class="account-alerts"><h2>Il bar ti chiama</h2>${toggle('chat-notify-preference','Messaggi di Chiacchiere da bar',false,'data-chat-preference-row hidden')}${toggle('reminder-preference','Promemoria schedina · 24, 12, 6 e 3 ore prima',u.remindersEnabled!==false)}${toggle('email-reminder-preference','Promemoria mail schedina o formazione - due ore prima',u.emailRemindersEnabled)}<button type="button" class="secondary" id="enable-device-alerts">Attiva avvisi su questo dispositivo</button></section>`;
 return {account:{summary:'Soprannome e accesso',html:profile({embedded:true})},avvisi:{summary:'Bar e Fanta',html:bar+renderFantaNotificationSettings(settings,{disabled:!settings,compact:true})},...(u.emailVerified&&!u.demo?{assistenza:{summary:'Segnalazioni e suggerimenti',html:supportSection()}}:{})};
}
function updateDashboard() {
  if(!L())return;
  if(page==='solleciti'){patchRegion($('.president-reminders'),barReminderPage(L()));return;}
  const region = $('#league-dashboard');
  if(!region)return;
  patchRegion(region.firstElementChild,leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null));
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
function updateObjectives(){const target=$('#league-objectives');if(!target||!L())return;const html=achievementBoard(L(),esc,'seriea',null,{calendar:state.calendar});if(target.dataset.objectivesHtml===html)return;const open=target.dataset.openGoal===undefined?-1:Number(target.dataset.openGoal);const scroll=target.querySelector('.goal-rail')?.scrollLeft||0;target.innerHTML=html;target.dataset.objectivesHtml=html;const rail=target.querySelector('.goal-rail');if(rail)rail.scrollLeft=scroll;if(open>=0)showGoal(target,open);}
function bindObjectives(){
 const target=$('#league-objectives');if(!target)return;
 target.onclick=e=>{const token=e.target.closest('[data-goal]');if(!token)return;const i=Number(token.dataset.goal);showGoal(target,target.dataset.openGoal===String(i)?-1:i);};
}
function bindDashboard() {
  const dashboard=$('#league-dashboard');
  if(dashboard)dashboard.onclick=e=>{
    if(e.target.closest('[data-dashboard-calendar]')){void navigatePage('calendario');return;}
    const story=e.target.closest('[data-bar-story]');
    if(story){openHomeStory(story,{uid:state.user.id,mode:'bar',onAction:action=>openDashboardSlip(action.storySlip)});return;}
    const slip=e.target.closest('[data-dashboard-slip]');
    if(slip)openDashboardSlip(slip.dataset.dashboardSlip);
  };
  const changeSource=()=>{persistDraft();sourceScope='seriea';selectedRoundId=null;competitionScope=null;};
  function openDashboardSlip(id){
    const round=L()?.rounds.find(x=>x.id===id);if(round?.source==='fantacalcio'){openNativeSlips();return;}
    changeSource();
    if(round){sourceScope=sourceOf(round);selectedRoundId=round.id;competitionScope=round.competitionKey||null;}
    slipScope='mine';page='schedina';writeAppRoute({mode:'bar',page:'schedina',league:L()?.id,round:selectedRoundId});hydrateDraft();render();window.scrollTo(0,0);
  }
  const avatar=$('[data-open-quasi-studio]');
  if(avatar)avatar.onclick=()=>{void openStudio();};
  bindObjectives();
}
async function openStudio(initialReward){persistDraft();const {openQuasiStudio}=await loadStudio();openQuasiStudio({initialReward:typeof initialReward==='string'?initialReward:undefined,user:state.user,api,onSaved:(avatar,name)=>{state.user.avatar=avatar;state.user.name=name;for(const league of state.leagues){const member=league.members.find(m=>m.uid===state.user.id);if(member){member.avatar=avatar;member.name=name;}}render();notify('Il tuo Quasi è pronto.');}});}
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
  d.innerHTML='<div class="reward-reveal-card rarity-'+first.rarity+'"><span class="eyebrow">'+(ids.length>1?'NUOVI PREMI':'NUOVO PREMIO')+'</span><h2>'+(ids.length>1?'Il bottino è arrivato.':'Hai vinto qualcosa.')+'</h2><ul>'+shown.map(r=>'<li class="rarity-'+r.rarity+'">'+rewardMark(r)+'<div><strong>'+esc(r.type==='color'?r.shortName:r.name)+'</strong><small>'+esc(rarityLabel[r.rarity])+' · '+esc(REWARD_TYPES[r.type])+'</small></div></li>').join('')+'</ul>'+(ids.length>3?'<p class="tiny muted">…e altri '+(ids.length-3)+' nel guardaroba.</p>':'')+'<p class="tiny muted">'+esc(reason.title+' · '+reason.competitionName)+'</p><div class="reward-reveal-actions"><button type="button" class="primary" data-reveal-wear>Indossalo ora</button><button type="button" class="secondary" data-reveal-later>Più tardi</button></div></div>';
  document.body.append(d);rewardRevealOpen=true;
  const close=()=>{d.close();d.remove();rewardRevealOpen=false;};
  d.querySelector('[data-reveal-later]').onclick=close;d.addEventListener('cancel',close);
  d.querySelector('[data-reveal-wear]').onclick=()=>{close();void openStudio(first.id);};
  d.showModal();
 }catch{rewardRevealOpen=false;}
}
function settings(l,r){
 return '<div id="league-dashboard">'+leagueDashboard(l,state.user,'seriea',false,esc,fmt,null)+'</div>';
}
function barReminderPage(league){
 return renderPresidentReminders('bar',league.id,barReminder(league,state.user.id));
}
let presidentGroup=null;
function barRulesForm(l){
 return `<form id="rules"><p>Ogni esito corretto vale la sua quota. Un errore vale zero punti.</p>
 <label class="field">Crediti iniziali per i nuovi iscritti<input name="initial" type="number" step="0.25" value="${l.rules.initial}" required></label>
 <label class="field"><span><input type="checkbox" name="points" ${l.rules.winners.includes("points")?"checked":""}> Premia primo per punti</span></label>
 <label class="field"><span><input type="checkbox" name="credits" ${l.rules.winners.includes("credits")?"checked":""}> Premia primo per crediti</span></label>
 <button class="primary">Salva regole</button></form>`;
}
function barLeagueInfo(l){
 const participants=page==='partecipanti';
 return leagueWorkspace({id:l.id,mode:'bar',view:participants?'participants':'hub',back:'data-bar-page="barleague"',
   fallback:!participants||state.user.demo?barLeagueFallback(l,state.user.id):null})+(participants?'':randomLeagueControls(l,state.user));
}

function openPresidentOperation(operation){
 if(L()?.admin!==state.user?.id)return;
 const sheet=$('#v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}
 closeLeagueChat();if(page!=='admin')presidentNative=null;page='admin';presidentOperation=operation;
 writeAppRoute({mode:'bar',page:'admin',section:operation,league:L().id});
 render();window.scrollTo(0,0);
}
function leagueAdmin(l){
 if(l.admin!==state.user.id)return barLeagueInfo(l);
 const tool=presidentOperation;
 const fanta=presidentNative?.id===l.id?presidentNative.fanta:null;
 const bodies={
  identita:()=>brandingForm(l),
  regole:()=>barRulesForm(l),
  invita:()=>'<form class="card league-administration-form" data-president-invite><label class="field">Nickname o email<input name="identity" required maxlength="254" autocomplete="off" autocapitalize="none"></label><button class="primary">Invia invito</button><p role="status"></p></form>',
  whatsapp:()=>l.code?whatsappInvite(l,esc):'',
  richieste:()=>'<div data-president-requests><p role="status">Caricamento…</p></div>',
  rimuovi:()=>leagueWorkspace({id:l.id,mode:'bar',view:'manage',fallback:state.user.demo?barLeagueFallback(l,state.user.id):null}),
  riammetti:()=>l.removedMembers?.length?'<div class="president-operation-list">'+l.removedMembers.map(m=>'<button type="button" class="secondary president-operation" data-president-restore="'+esc(m.uid)+'">'+esc(m.name)+'<span>Riammetti</span></button>').join('')+'</div>':'<p>Nessun partecipante da riammettere.</p>',
  attiva:()=>l.nativeFantaLink?.leagueId?'<p>Il Fanta della lega è attivo.</p>':`<form id="create" class="card league-administration-form">${leagueCreationFields({name:l.name,size:Math.max(2,l.members.length),locked:true})}<button type="submit" class="primary">Attiva il Fanta</button></form>`,
  preparazione:()=>randomLeagueControls(l,state.user,{admin:true})||'<p>Il Fanta della lega è pronto.</p>',
  elimina:()=>'<form id="president-delete-league" class="card league-administration-form"><p>Eliminerai definitivamente <b>'+esc(l.name)+'</b>, il suo Bar, il Fanta collegato e lo storico di gioco.</p><label class="field">Scrivi <strong>ELIMINA LEGA E STORICO</strong><input name="phrase" autocomplete="off" autocapitalize="characters" spellcheck="false" required></label><button class="secondary league-delete-action" disabled>Elimina la lega</button><p role="alert"></p></form>',
 };
 const selected=Object.hasOwn(bodies,tool)&&(!state.user.demo||!['invita','richieste','elimina'].includes(tool))?tool:null;
 return presidentWorkspace({tool:selected,body:selected?bodies[selected]():'',buttons:presidentOperationButtons({bar:l,fanta,demo:state.user.demo,hasTrades:!state.user.demo}),back:selected?'data-president-operation=""':'data-bar-page="barleague"'});
}
function bindPresidentOperations(root,l){
 if(!presidentOperation&&l.nativeFantaLink?.leagueId&&!state.user.demo&&presidentNative?.id!==l.id){
  const target=presidentNative={id:l.id,fanta:null};
  void loadLeagueWorkspace(l.id,'bar').then(({fanta})=>{
   if(presidentNative!==target)return;
   target.fanta=fanta?.isAdmin&&fanta.isCoach?fanta:null;
   if(page==='admin'&&!presidentOperation&&L()?.id===l.id)render();
  }).catch(()=>{if(presidentNative===target)presidentNative=null;});
 }
 const invite=root.querySelector('[data-president-invite]');
 if(invite)invite.onsubmit=async e=>{
  e.preventDefault();const b=invite.querySelector('button'),status=invite.querySelector('[role=status]');
  if(b.disabled)return;b.disabled=true;status.textContent='';
  try{await api('league-access-invite',{league:l.id,identity:new FormData(invite).get('identity')});invite.reset();status.textContent='Invito inviato.';}
  catch(error){status.textContent=error.message;}finally{b.disabled=false;}
 };
 const requests=root.querySelector('[data-president-requests]');
 if(requests)void loadLeagueAccess().then(({bindPresidentRequests})=>{if(requests.isConnected)bindPresidentRequests(requests,{api,league:l.id,onChanged:refreshLeagueMembers});});
 for(const button of root.querySelectorAll('[data-president-restore]'))button.onclick=async()=>{
  const member=l.removedMembers.find(m=>m.uid===button.dataset.presidentRestore);
  if(!member||button.disabled)return;button.disabled=true;
  try{
   if(!await askConfirmation({title:'Riammetti partecipante',message:'Vuoi riammettere '+member.name+' nella lega?',confirmLabel:'Riammetti'})||!button.isConnected)return;
   const result=await withMembershipProgress(document,'Riammissione del partecipante…',async()=>{
    const saved=await api('member-restore',{league:l.id,uid:member.uid});
    await refreshMembershipAfterWrite({bar:l});
    return saved;
   });
   notify(result.teamUnavailable?'Partecipante riammesso nel Bar. Verifica la disponibilità della squadra precedente nel Fanta.':'Partecipante riammesso.');
  }catch(error){notify(error.message);}finally{button.disabled=false;}
 };
}
function openBarRules(){
  const view=openMatchPage({label:'Regolamento del Bar',swipeBack:'both'});
  view.classList.add('bar-rules-page');
  view.innerHTML=backButton('id="close-modal"','Torna alla lega')+regulation(L(),R());
  view.querySelector('#close-modal').onclick=()=>view.close();
}
function regulation(l){
 const initial=fmt(l?.rules?.initial??500);
 return `<section class="hero"><h1>IL REGOLAMENTO.</h1></section><div class="rule-grid">
  <article class="card"><h3>Come giocare</h3><p>Scegli le partite che vuoi, con un esito per partita. Ogni scelta si chiude al suo calcio d’inizio. La puntata si blocca quando inizia la prima partita che hai scelto.</p></article>
  <article class="card"><h3>Punti</h3><p>Ogni esito giusto vale la quota accettata. Quota 1,35 significa 1,35 punti. Esiti sbagliati o saltati valgono zero. Si parte dalla giornata 11 di Lega A 2026/27 e dalle giornate Fanta corrispondenti ancora da liquidare.</p></article>
  <article class="card"><h3>Puntata</h3><p>Hai ${initial} crediti virtuali iniziali. Puoi puntare da 1 credito al saldo disponibile, tenendo da parte 1 credito per ogni giornata successiva in cui devi ancora giocare.</p></article>
  <article class="card"><h3>Crediti</h3><p>Se indovini tutte le partite giocate, ricevi la puntata moltiplicata per il prodotto delle quote. Gli eventi annullati valgono quota 1. Se sono tutti annullati, ti viene restituita la puntata.</p></article>
  <article class="card"><h3>Risultati</h3><p>Live, punti e crediti diventano definitivi dopo la conferma dei risultati. Le quote mancanti sono indicate con ?. Le giornate già liquidate conservano il loro punteggio.</p></article>
 </div>`;
}
function paintBarCalendar() {
  const track=$('.bar-seriea-calendar');
  if(track)patchRegion(track.firstElementChild,serieACalendar(state.calendar,barCalendar));
}
function bindBarCalendar() {
  const track=$('.bar-seriea-calendar');
  if(!track)return;
  restoreRoundCalendarScroll(track,barCalendar);
  track.onclick=event=>{
    const match=event.target.closest('[data-bar-calendar-match]');
    if(match){void openMatch(match.dataset.barCalendarMatch,false,match,{fromCalendar:true});return;}
    const header=event.target.closest('[data-bar-calendar-round]');
    if(!header)return;
    const number=Number(header.dataset.barCalendarRound);
    barCalendar.openRound=header.getAttribute('aria-expanded')==='true'?-1:number;
    paintBarCalendar();
    const current=track.querySelector('[data-bar-calendar-round="'+number+'"]');
    current?.focus({preventScroll:true});
    current?.scrollIntoView({block:'nearest'});
  };
}
function navigatePage(next) {
  if(next==='solleciti'&&L()?.admin!==state.user?.id)return;
  if(next==='admin'){if(page!=='admin')presidentNative=null;openPresidentOperation(null);return;}
  if(next===page)return;
  if(next==='quasi')quasiPane='mine';
  if(next==='calendario'){barCalendar.openRound=null;barCalendar.calendarScroll=null;}
  presidentOperation=null;
  if(next!=='chat'&&chatOpen)closeLeagueChat();
  if(next==='schedina'){persistDraft();selectedRoundId=null;slipScope='mine';hydrateDraft();}
  sourceScope='seriea';
  writeAppRoute({mode:'bar',page:({lega:'oggi',schedina:'schedina',classifiche:'classifica',calendario:'classifica',quasi:'quasi',profilo:'profilo',impostazioni:'impostazioni',regolamento:'regolamento',admin:'admin',barleague:'lega'})[next]||next,section:next==='calendario'?'calendario':null,league:L()?.id});
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
 league:{load:loadLeagueWorkspace,remove:removeLeagueParticipant,onRemoved:refreshMembershipAfterWrite},
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
  if(target?.page==='admin'){if(target.league&&state.leagues.some(l=>l.id===target.league))leagueId=target.league;openPresidentOperation(target.group||null);return;}
  if(target?.group)presidentGroup=target.group;
  if (target?.league && state.leagues.some(l=>l.id===target.league)) {leagueId=target.league;try{localStorage.setItem('quasi-active-league:'+state.user.id,leagueId);}catch{}sourceScope='seriea';competitionScope=null;selectedRoundId=null;hydrateDraft();}
  const round=target?.round && L()?.rounds.find(r=>r.id===target.round);
  if (target?.sourceScope || round) {
    sourceScope=round?sourceOf(round):target.sourceScope;
    competitionScope=round?.competitionKey||null;selectedRoundId=round?.id||null;
    slipScope='mine';hydrateDraft();
  }
  if(isLeagueEntryPage(target?.page)){
    persistDraft();closeLeagueChat();
    const sheet=$('#v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}
  }
  if(target?.page){page=target.page==='invita'?'impostazioni':target.page;writeAppRoute({mode:'bar',page:page==='lega'?'oggi':page==='barleague'?'lega':page,league:L()?.id});}
  render();window.scrollTo(0,0);liveChannel.wake();
  if(isLeagueEntryPage(page))document.querySelector('.league-entry h1')?.focus({preventScroll:true});
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
  bindTabBar(t=>{if(t!==tabForPage(page,sourceScope))v2go(routeForTab(t,L(),state.leagues));});
  if (state.user) bindLeagueSwitcher({ leagues: state.leagues, activeId: L()?.id, uid: state.user.id, esc,
    onEntry:page=>openBarTarget({page}),
    readLeagues:state.user.demo?null:()=>createFantaApi({userId:state.user.id}).leagues(),
    readFanta:state.user.demo?null:async id=>fantaHomeStatus(await createFantaApi({userId:state.user.id}).home(id,{fresh:true})),
    onFanta:id=>{persistDraft();closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:id,onBar:openBarTarget});},
    onSelect: (id) => { try { persistDraft(); } catch {} leagueId = id; page='lega';writeAppRoute({mode:'bar',page:'oggi',league:id}); sourceScope = defaultSource(L()); selectedRoundId = null; competitionScope = null; hydrateDraft(); try { localStorage.setItem("quasi-active-league:" + state.user.id, id); } catch {} render(); window.scrollTo(0, 0); liveChannel.wake(); },
  });
  bindDashboard();
  if(!l)$('[data-open-quasi-studio]')?.addEventListener('click',()=>void openStudio());
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
  document.querySelectorAll('[data-ranking-metric]').forEach(b=>b.onclick=()=>setBarRanking(b.dataset.rankingMetric));
  if(['classifiche','seriea','calendario'].includes(page)){
   const main=$('#app main');
   if(main){bindSwipeBack(main,()=>stepBarRanking(1),'right');bindSwipeBack(main,()=>stepBarRanking(-1),'left');}
  }
  if(page==='calendario')bindBarCalendar();
  if(page==='quasi'){
   document.querySelectorAll('[data-quasi-pane]').forEach(button=>button.onclick=()=>setQuasiPane(button.dataset.quasiPane));
   const main=$('#app main');
   if(main){bindSwipeBack(main,()=>setQuasiPane(quasiPane==='mine'?'league':'mine'),'left');bindSwipeBack(main,()=>setQuasiPane(quasiPane==='mine'?'league':'mine'),'right');}
  }
  if($('#ranking-metric'))$('#ranking-metric').onchange=e=>{tab=e.target.value;render();};
  bindBarSlips();
  document
    .querySelectorAll("[data-detail]")
    .forEach((b) => (b.onclick = () => openMatch(b.dataset.detail,false,b)));
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
  bindLeagueCreation($('#create'),payload=>submitLeague('create',payload));
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
    $("#results").onsubmit = async (e) => {
      e.preventDefault();
      let d = Object.fromEntries(new FormData(e.target)),
        scores = Object.fromEntries(
          r.matches.map((x) => [x.id, [+d["h" + x.id], +d["a" + x.id]]]),
        );
      if (
        await askConfirmation({title:'Conferma risultati',message:'La giornata verrà liquidata una sola volta.',confirmLabel:'Liquida giornata'})
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
  return `<h1 class="sr-only">Classifica del campionato</h1><div data-os-content data-os-flow class="serie-standings"><div class="serie-table-card"><table class="serie-table"><thead><tr>${columns.map(x=>`<th scope="col">${x}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div></div>`;
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
const detailCache=new Map(),detailPending=new Map();
async function matchSnapshot(match,round=null){
 if(!state.compact)return match;
 const params=new URLSearchParams({id:match.id});if(round){params.set('league',L().id);params.set('round',round.id);}
 const key=state.user.id+':'+params,revision=String(match.lineupRevision||'')+':'+String(match.detailRevision||''),cached=detailCache.get(key)||displayCache('bar:'+state.user.id).get(key,match.status==='FT'?86400000:45000),ttl=match.status==='FT'?86400000:45000;
 if(cached&&cached.revision===revision&&Date.now()-cached.at<ttl)return {...match,...cached.data};
 if(!detailPending.has(key))detailPending.set(key,api('match?'+params).then(data=>{detailCache.set(key,{data,revision,at:Date.now()});if(state.user?.id===key.split(':')[0])displayCache('bar:'+state.user.id).set(key,{data,revision,at:Date.now()});if(detailCache.size>60)detailCache.delete(detailCache.keys().next().value);return data;}).finally(()=>detailPending.delete(key)));
 return {...match,...await detailPending.get(key)};
}
const pendingSerieALineups=new WeakMap();
function refreshSerieALineup(dialog,id,revision){
 if(!dialog.classList.contains('live-match-page')||!liveChannel.requestLineup)return;
 const shown=dialog.dataset.lineupRevision;
 if(revision&&(revision===shown||Date.parse(revision)<Date.parse(shown)))return;
 const previous=pendingSerieALineups.get(dialog);
 if(previous?.id===id&&previous.revision===revision)return;
 const request={id,revision};
 pendingSerieALineups.set(dialog,request);
 void liveChannel.requestLineup(id,revision).then(fresh=>{
  if(!fresh?.lineups||!dialog.open||dialog.dataset.match!==id||pendingSerieALineups.get(dialog)!==request)return;
  const updated=fresh.lineupRevision,shown=dialog.dataset.lineupRevision;
  if(!updated||updated===shown||Date.parse(updated)<Date.parse(shown)||Date.parse(updated)<Date.parse(revision))return;
  updateFootballMatch(dialog,fresh,{refreshLineup:true});
  dialog.dataset.lineupRevision=updated;
 }).catch(()=>{}).finally(()=>{if(pendingSerieALineups.get(dialog)===request)pendingSerieALineups.delete(dialog);});
}
function updateSerieAMatchPage(dialog,match){
 if(!dialog.classList.contains('live-match-page'))return;
 updateFootballMatch(dialog,match);
 if(match.lineupRevision)refreshSerieALineup(dialog,match.id,match.lineupRevision);
}
function applySavedSerieALineups(lineups){
 const rounds=[...(state.calendar?.rounds||[]),...(L()?.rounds||[])];
 const updates=new Map(lineups.map(({id,revision})=>[id,revision]));
 for(const round of rounds)for(const match of round.matches){
  const revision=updates.get(match.id);
  if(revision&&!(Date.parse(revision)<Date.parse(match.lineupRevision)))match.lineupRevision=revision;
 }
 const dialog=$('#match-page-root'),revision=updates.get(dialog?.dataset.match);
 if(dialog?.open&&revision)refreshSerieALineup(dialog,dialog.dataset.match,revision);
}
async function openMatch(id, quiet = false, trigger, {fromCalendar=false}={}) {
  const fantasyRound = L()?.rounds.find(
    (r) => r.source === "fantacalcio" && r.matches.some((m) => m.id === id),
  );
  let match = fantasyRound?.matches.find((m) => m.id === id);
  if (match) {
    if (quiet && !document.querySelector("#match-page-root")) {
      activeMatchId = null;
      return;
    }
    const d = quiet ? document.querySelector("#match-page-root") : openMatchPage({trigger,onClose:()=>{activeMatchId=null;}}),
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
    dialog = openMatchPage({trigger,onClose:()=>{activeMatchId=null;}});
    dialog.innerHTML='<button type="button" class="match-nav-button match-close" aria-label="Chiudi partita">×</button><p role="status">Caricamento…</p>';
    dialog.querySelector('button').onclick=()=>dialog.close();
    dialog.dataset.match = id;
    activeMatchId = id;
  }
  const content=dialog;
  try {
    const scroll=dialog.scrollTop;
    const matchRound=(state.calendar?.rounds||[]).find(round=>round.matches.some(m=>m.id===id))
      ||L()?.rounds.find(round=>round.matches.some(m=>m.id===id));
    const baseData=structuredClone(matchRound?.matches.find(m=>m.id===id));
    if (!baseData) throw Error("Partita non presente nel calendario salvato.");
    const data=await matchSnapshot(baseData).catch(error=>{
      if(error.status===404)return baseData;
      throw error;
    });
    if (!dialog.open || dialog.dataset.match !== id) return;

    const moveFocus=content.contains(document.activeElement);
    mountFootballMatch(dialog,data,{initialTab:fromCalendar?calendarMatchTab(data):undefined});
    dialog.dataset.lineupRevision=data.lineups?.updatedAt||'';
    const latest=matchRound.matches.find(m=>m.id===id);
    const newerScore=latest?.scoreUpdatedAt&&(!data.scoreUpdatedAt||Date.parse(latest.scoreUpdatedAt)>Date.parse(data.scoreUpdatedAt));
    const newerLineup=latest?.lineupRevision&&latest.lineupRevision!==dialog.dataset.lineupRevision;
    if(newerScore||newerLineup)updateSerieAMatchPage(dialog,latest);
    if(!newerLineup&&data.lineups?.kind!=='official'&&Date.parse(data.kickoff)<=Date.now()+3600000)refreshSerieALineup(dialog,id);
    if(moveFocus)dialog.querySelector('#close-modal').focus({preventScroll:true});
    if (quiet) dialog.scrollTop = scroll;
  } catch (e) {
    if (!quiet&&dialog.open) {
      content.innerHTML = `<button type="button" class="match-nav-button match-close" id="close-modal" aria-label="Chiudi partita">×</button><p class="muted">${esc(e.message || "Dettagli momentaneamente non disponibili.")}</p>`;
      const close=content.querySelector('#close-modal');
      close.onclick = () => {
        activeMatchId = null;
        dialog.dataset.match = "";
        dialog.close();
      };
      close.focus({preventScroll:true});
    }
  }
}

function supportSection() {
  return '<p class="muted">Scrivici un’idea o descrivi cosa non funziona. Risponderemo alla tua email verificata.</p><form id="support-form"><label class="field">Tipo<select name="kind"><option value="suggestion">Suggerimento</option><option value="bug">Bug</option></select></label><label class="field">Titolo<input name="subject" minlength="3" maxlength="100" required></label><label class="field support-message">Messaggio<textarea name="message" rows="5" minlength="10" maxlength="4000" required></textarea></label><button type="submit" class="primary">Invia messaggio</button><p id="support-status" role="status"></p></form>';
}
function bindSupportInline() {
  const form = $("#support-form");
  if (!form) return;
  form.dataset.request = crypto.randomUUID();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    if(b.disabled)return;
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
    if(leagueId)writeAppRoute({mode:'bar',page:'oggi',league:leagueId},{replace:true});
    await refresh(true);
    if(result.message)notify(result.message);else if(result.reused)notify('Questa lega esiste già. Ti abbiamo riportato al suo bancone.');
    return true;
  } catch (x) {
    notify(x.message);
    return false;
  }
}

function bindNew(l, r) {
  const theme=$('#branding-form');
  if(theme&&l)bindLeagueIdentityForm(theme,async branding=>{
    const saved=await api('league-profile',{league:l.id,branding});
    const current=state.leagues.find(league=>league.id===l.id);
    if(!current)return;
    Object.assign(current,{name:saved.name,branding:saved.branding});
    refreshFantaMembership(state.leagues,[]);
    if(!preferredFanta()&&L()?.id===l.id)paintLeagueIdentity(current,'bar');
  });
  const rulesForm = $("#rules");
  if (rulesForm?.elements?.mode)
    rulesForm.elements.mode.onchange = () => {
      rulesForm.querySelector("[data-classic-points]").hidden =
        rulesForm.elements.mode.value !== "classic";
      rulesForm.querySelector("[data-auto-points]").hidden =
        rulesForm.elements.mode.value === "classic";
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
      const d=openMatchPage({kind:'postcard',label:'Cartolina del Bar',swipeBack:'both'});
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
        d.innerHTML='<div class="verdict-page-toolbar">'+backButton('id="close-modal"','Torna al verdetto')+'</div>'+createVerdictCard(l,sourceScope,competitionScope,uid,r?.id);
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
function brandingForm(l) { return leagueIdentityForm(l); }
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
      const page=route?.mode==='fanta'&&['asta','squadra','giornata','scambi'].includes(route.page)?route.page:'oggi';
      const navigation={...route,mode:'fanta',page,league};
      try{localStorage.setItem('qdq:mode','fanta');localStorage.setItem('qdq:fantaLeague',league);}catch{}
      if(!state.user){pendingAppRoute=navigation;return;}
      if(!state.leagues.length)return;
      writeAppRoute(navigation);closeLeagueChat();
      void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:league,initialTab:page,onBar:openBarTarget,force:true});
      return;
    }
    if(e.data?.type==='open-slip'&&!state.user&&typeof e.data.league==='string'){
      requestedSlip=e.data.league;requestedSlipRound=e.data.round;return;
    }
    if(e.data?.type==='open-slip'&&state.leagues.some(l=>l.id===e.data.league)){
      persistDraft();closeLeagueChat();leaveFanta();leagueId=e.data.league;
      const round=L().rounds.find(r=>r.id===e.data.round);
      sourceScope=round?sourceOf(round):'seriea';competitionScope=round?.competitionKey||null;selectedRoundId=round?.id||null;
      page='schedina';slipScope='mine';writeAppRoute({mode:'bar',page,league:leagueId,round:selectedRoundId});
      hydrateDraft();render();window.scrollTo(0,0);return;
    }
    if(e.data?.type==='open-league-access'){if(state.user)void refresh(true);return;}
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
 const show=page==='schedina'&&value.state!=='ready'&&liveDisplayFailures>=3;el.hidden=!show;
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
  const dashboard=$('#league-dashboard');if(dashboard){patchRegion(dashboard.firstElementChild,leagueDashboard(L(),state.user,'seriea',false,esc,fmt,null));bindDashboard();}
  if(page==='solleciti')patchRegion($('.president-reminders'),barReminderPage(L()));
  if(page==='classifiche'){
    const template=document.createElement('template');template.innerHTML=ranking(L());
    const current=$('main .card'),fresh=template.content.querySelector('.card');if(current&&fresh)patchRegion(current,fresh.outerHTML);
  }
  if(page==='calendario')paintBarCalendar();
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
      updateSerieAMatchPage(dialog,m);
    }
  }
}
document.addEventListener('quasi:chat-context',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league||l.id===e.detail?.league);syncChatLauncher(linked||null);if(linked)updateChatWidget();});
document.addEventListener('quasi:chat-update',e=>{
 const detail=e.detail||{};
 const accepted=applyChatSummary(detail.league,detail);
 if(accepted&&detail.changed&&chatOpen&&chatLeagueId===detail.league)refreshChat();
});
document.addEventListener('quasi:chat-badges',chatBadge);
document.addEventListener('quasi:chat-reconnect',()=>{if(state.user&&!state.user.demo)void refresh();});
document.addEventListener('quasi:fanta-team-claimed',()=>{void refresh();});
document.addEventListener('visibilitychange',()=>{
 if(document.hidden)return;
 if(chatOpen)refreshChat();
 checkLeagueAccess();
 if(L()&&state.user?.emailVerified&&!state.user.demo&&Date.now()-Number(lastRefresh)>30000)refreshLeagueMembers();
});
window.addEventListener('focus',checkLeagueAccess);
document.addEventListener('quasi:chat-reconnect',refreshLeagueMembers);
document.addEventListener('quasi:league-update',e=>{
 const {change,league}=e.detail||{};
 if(typeof league!=='string'||!state.user)return;
 if(change==='deleted')removeDeletedLeague(league);
 if(change==='identity'&&state.leagues.some(l=>l.id===league))refreshLeagueMembers();
 if(change==='members'||change==='deleted'){
  if(L()?.id===league)void leagueWorkspaceView?.refresh();
  refreshLeagueMembers();
 }
 if(!document.hidden&&change==='trade-proposal')notify('Hai ricevuto una proposta di scambio.');
 if(!document.hidden&&change==='trade-counter')notify('Hai ricevuto una controproposta.');
});
setInterval(()=>{
 if(leagueAccessUid()&&!L()&&!document.hidden)void refresh();
 else checkLeagueAccess();
},30000);
document.addEventListener('quasi:open-chat',e=>{const linked=state.leagues.find(l=>l.nativeFantaLink?.leagueId===e.detail?.league);if(linked){syncChatLauncher(linked);openLeagueChat(e.detail.trigger);}});
document.addEventListener('click',e=>{const operation=e.target.closest('[data-president-operation]');if(operation){openPresidentOperation(operation.dataset.presidentOperation||null);return;}const jump=e.target.closest('[data-league-fanta]');if(jump&&L()){closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:jump.dataset.nativeLeague,initialTab:jump.dataset.leagueFanta,initialSection:jump.dataset.leagueSection,onBar:openBarTarget});return;}const chat=e.target.closest('[data-league-chat]');if(chat){openLeagueChat(chat);return;}const target=e.target.closest('[data-bar-page]');if(target&&!target.hasAttribute('data-mode')&&isLeagueEntryPage(target.dataset.barPage)){openBarTarget({page:target.dataset.barPage});return;}if(target&&!target.hasAttribute('data-mode')&&['profilo','impostazioni','regolamento','admin','barleague','partecipanti','lega','invita','solleciti'].includes(target.dataset.barPage)){const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}if(target.dataset.barPage==='regolamento'){openBarRules();return;}void navigatePage(target.dataset.barPage==='invita'?'impostazioni':target.dataset.barPage);if(target.dataset.barPage==='invita')document.querySelector('.settings-app-invite')?.scrollIntoView({block:'start'});return;}const mode=e.target.closest('[data-app-mode]')?.dataset.appMode;if(!mode)return;if(mode==='fanta'){if(!L())return;closeLeagueChat();void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),leagueId:L()?.nativeFantaLink?.leagueId,initialTab:'oggi',onBar:openBarTarget});}else if(preferredFanta()){leaveFanta();try{localStorage.setItem('qdq:mode','bar');}catch{}openBarTarget({page:'lega'});}});
let liveScoresRevision=null,sportsFeedBlockedUntil=0;
const liveChannel=createSportsPush({
  context:()=>!preferredFanta()&&state.user&&!state.user.demo&&state.user.emailVerified&&L()?{mode:'bar',league:L().id}:null,
  apply:applyLive,applyLineups:applySavedSerieALineups,status:showLiveStatus,
});
liveChannel.start();

bindSiteValidation(document);
refresh(true);
let lastSlipNavigationDay=slipRomeDay();
setInterval(() => {
  if(preferredFanta())return;
  const day=slipRomeDay();if(day!==lastSlipNavigationDay){lastSlipNavigationDay=day;if(page==='schedina'){if(R()?.id!==displayedSlipRoundId)hydrateDraft();render();}}
  if(page==='schedina'&&publicSlipView()&&R()?.id!==displayedSlipRoundId){hydrateDraft();render();}
  if(page==='lega'&&tickHomeCountdowns(document)&&!document.querySelector('.bar-story-dialog[open]'))updateDashboard();
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
window.addEventListener('popstate',()=>{const route=readAppRoute();if(!route||!state.user)return;if(route.mode==='fanta'){if(!state.leagues.length){reconcileLeagueSelection();render();return;}void enterFanta($('#app'),{user:state.user,barLeagues:state.leagues,slipServices:nativeSlipServices(),onBar:openBarTarget,initialTab:route.page,leagueId:route.league,force:route.section==='studio'});return;}leaveFanta();page=barPageFor(route);presidentOperation=page==='admin'?route.section:null;if(state.leagues.some(l=>l.id===route.league))leagueId=route.league;sourceScope='seriea';if(route.round&&L()?.rounds.some(r=>r.id===route.round))selectedRoundId=route.round;hydrateDraft();render();});
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



