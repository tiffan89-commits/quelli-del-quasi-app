import {hubHead,hubTile} from '../public/src/league-hub.mjs';
import {appWhatsappInvite,signupShareData} from '../public/src/app-invite.mjs';
import {renderFantaNotificationSettings} from '../public/src/fanta/io.mjs';
import {clubShirt} from '../public/src/club-crest.mjs';
import {barHomeInvite} from '../public/src/bar-home-invite.mjs';
import {leagueActions} from '../public/src/league-actions.mjs';
import {slipCreditReserve,slipStakeLimit} from '../public/slip-events.mjs';
import {placeAppFooter,restoreAppFooter} from '../public/src/app-footer.mjs';
import {settingsFooter,presidentEntry,presidentPanel,presidentTodos,barPresidentTasks,bindPresidentPanel} from '../public/src/president-panel.mjs';
import {nicknameNotice} from '../public/src/nickname-notice.mjs';
import {readAppRoute,writeAppRoute} from '../public/src/routes.mjs';
import {saveOnce} from '../public/src/save-guard.mjs';
import {applySlipReceipt} from '../public/src/slip-receipt.mjs';
import {displayCache,clearDisplayCaches} from '../public/src/display-cache.mjs';
import {randomLeagueControls,bindRandomLeagues} from '../public/src/random-leagues.mjs';
import {fantasyAccount,fantasyGroup,fantasyWalletKey} from '../public/src/fantasy-accounts.mjs';
import * as v2Tabs from '../public/src/v2/tabs.mjs';
import {renderLeagueChip,isLeagueAdmin} from '../public/src/v2/league-switcher.mjs';
import {renderSlipV2,patchSlipV2,patchSlipBar} from '../public/src/v2/slip-v2.mjs';
import {barModeSwitch} from '../public/src/fanta-mode.mjs';
import {inlineResultView,patchSlipResults} from '../public/src/slip-results.mjs';
import { LEAGUE_COLORS, LEAGUE_EMBLEMS } from "../public/src/league-theme.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import fs from "node:fs";
import { emptyState } from "../lib/db.mjs";
import {
  ensureCalendar,
  updateCalendarRounds,
  calendarView,
} from "../lib/calendar.mjs";
import { newLeague, stateFor } from "../lib/game.mjs";
import { groupMatches } from "../public/match-layout.mjs";
import { predictionStatus } from "../public/prediction.mjs";
import * as slipState from "../public/src/slip-state.mjs";
import { communityView, createVerdictCard } from "../public/src/community.mjs";
import {
  playerRanking,
  fantasyTableView,
} from "../public/src/bar-fanta-rankings.mjs";
import { calendarSections } from "../public/src/calendar-order.mjs";
import { leagueDashboard, countdownLabel } from '../public/src/league-dashboard.mjs';
import { avatarSvg, AVATAR_OPTIONS } from '../public/src/avatar.mjs';
import {quasiScene,bindQuasiZoom} from '../public/src/quasi-scene.mjs';
import {barSlipsView,barVerdictPatch,barProfileView,bindBarSlipPages} from '../public/src/bar-slips.mjs';
import {rosterView} from '../public/src/quasi-roster.mjs';
import {achievementBoard} from '../public/src/achievement-board.mjs';
import {renderLineup} from '../public/src/lineup-pitch.mjs';
import { whatsappInvite } from '../public/src/league-invite.mjs';
import {renderAppInvite,bindAppInvites} from '../public/src/app-invite.mjs';
import {rewardsView} from '../public/src/progression-ui.mjs';
import {roomSvg} from '../public/src/locker-rooms.mjs';
import {fantaQuasiTeaser,fantaQuasiPage} from '../public/src/fanta-quasi.mjs';
import {REWARD_SLOTS} from '../public/src/reward-catalog.mjs';
import {isLeagueEntryPage,renderLeagueEntry,renderLeagueOnboarding} from '../public/src/league-onboarding.mjs';
import {bindLeagueCreation} from '../public/src/league-create-form.mjs';
import {leagueWorkspace,barLeagueFallback,bindLeagueWorkspace} from '../public/src/league-workspace.mjs';
test("live results render inside the slip, calendar remains clickable, standings are nested and movements live in league settings", async () => {
  const s = emptyState(),
    u = {
      id: "u",
      username: "mister",
      name: "Mister",
      email: "mister@example.test",
      emailVerified: true,
    };
  s.users.push(u);
  ensureCalendar(s);
  const m = s.football.calendar.rounds[0].matches[0];
  m.status = "LIVE";
  m.clock = "43'";
  m.liveScore = [1, 0];
  m.details = {
    events: [
      {
        kind: "goal",
        minute: "25'",
        team: m.home,
        side: "home",
        players: ["Il Marcatore"],
        penalty: true,
      },
      {
        kind: "yellow",
        minute: "38'",
        team: m.away,
        side: "away",
        players: ["Il Difensore"],
      },
    ],
  };
  updateCalendarRounds(s);
  newLeague(s, u, "Test");
  updateCalendarRounds(s);
  const state = {
    ...stateFor(s, u),
    calendar: calendarView(s),
    standings: s.football.standings,
  };
  // This view tests an actual running slip, not an unopened future fixture.
  const activeRound=state.leagues[0].rounds[0];
  activeRound.kickoff=new Date(Date.now()-3600000).toISOString();
  for(const match of activeRound.matches){match.kickoff=activeRound.kickoff;match.odds={1:2,X:3,2:4};}
  let html = "",workerMessage,barTab;const publicEvents=new Map();let blockRequests=false,requestCount=0,fantaEntries=0;const pendingRequests=[];
  const app = {
      querySelector(){return null;},
      insertAdjacentHTML(position,value) { html=value+html; },
      set innerHTML(v) {
        html = v;
      },
    },
    nodes = new Map();
  const ctx = {
    mountPublic(root){root.innerHTML='<main>PUBLIC-AREA</main>';return {destroy(){},route(){}};},createPublicApi(){return {};},
    readAppRoute,writeAppRoute,saveOnce,applySlipReceipt,loadAppStyles(){},displayCache,clearDisplayCaches,retainAppHeader(){},barModeSwitch,preferredFanta:()=>false,leaveFanta(){},clearFantaSessions(){},enterFanta(){fantaEntries++;},
    createSportsPush(){return {start(){},wake(){},stop(){}};},trackAuctionBadges(){},paintAuctionBadges(){},
    createLiveChannel(){return {start(){},wake(){},stop(){}};},requestJson:async()=>{requestCount++;if(blockRequests)return new Promise(resolve=>pendingRequests.push(resolve));return state;},
    barSlipsView,barVerdictPatch,barProfileView,bindBarSlipPages,renderFantaNotificationSettings,
    randomLeagueControls,bindRandomLeagues,
    fantasyAccount,fantasyGroup,fantasyWalletKey,
    isLeagueEntryPage,renderLeagueEntry,renderLeagueOnboarding,bindLeagueCreation,leagueWorkspace,barLeagueFallback,bindLeagueWorkspace,refreshFantaMembership(){},
    ...v2Tabs, leagueActions,barHomeInvite,settingsFooter,presidentEntry,renderLeagueChip, isLeagueAdmin, renderSlipV2,patchSlipV2,placeAppFooter,restoreAppFooter,presidentPanel,presidentTodos,barPresidentTasks,bindPresidentPanel,
    pendingInvite(){return null;},markSession(){},hideLanding(){},showLanding(){},bindLanding(){},clearPendingInvite(){},
    bindTabBar(handler){barTab=handler;},bindLeagueSwitcher(){},bindSlipV2(){},
    crypto: { randomUUID: () => "test-request-id" },
    URLSearchParams,
    Intl,
    applyLeagueTheme(){},bindFootballStatistics(){},
    LEAGUE_COLORS,
    LEAGUE_EMBLEMS,
    clearAdminState() {},
    calendarSections,
    hubHead,hubTile,appWhatsappInvite,signupShareData,
    leagueDashboard, countdownLabel, quasiScene, rosterView, achievementBoard, avatarSvg, AVATAR_OPTIONS, whatsappInvite,renderAppInvite,bindAppInvites,
    fantaQuasiTeaser,fantaQuasiPage,bindFantaQuasi(){},bindQuasiZoom,barSlipsView,barVerdictPatch,barProfileView,bindBarSlipPages,
    bindRoster(){},openQuasiStudio(){},renderLineup,bindLineupPitch(){},
    rewardsView,roomSvg,REWARD_SLOTS,
    bindProgression(){},bindRewards(){},bindStyledSelects(){},syncStyledSelects(){},closeStyledSelect(){},pushSupported(){return false;},enableLeagueNotifications(){},
    ...slipState,
    communityView,slipCreditReserve,slipStakeLimit,
    createVerdictCard,
    integrationBindings() {},
    playerRanking,
    fantasyTableView,
    stopChat() {},
    chatView() {
      return "";
    },
    bindChat() {},
    requestChatConsent() {
      return null;
    },
    maybeInvitePwaNotifications() {},
    localStorage: {
      getItem() {
        return null;
      },
      setItem() {},
      removeItem() {},
    },
    groupMatches,
    predictionStatus,inlineResultView,patchSlipResults,nicknameNotice,
    clubShirt,
    location: { hash: "", pathname: "/", search: "" },
    history: { replaceState() {} },
    navigator: {serviceWorker:{register:()=>Promise.resolve(),addEventListener:(event,handler)=>{if(event==='message')workerMessage=handler;}}},
    setInterval() {},
    setTimeout() {},
    window: { scrollTo() {}, addEventListener(name,handler) {publicEvents.set(name,handler);},history:{replaceState(){}} },
    document: {
      getElementById(id){return this.querySelector("#"+id);},
      addEventListener(){},
      body:{dataset:{},classList:{add(){},remove(){}}},
      documentElement: { style: { setProperty() {},removeProperty() {} } },
      querySelector(q) {
        if(q==='.auth')return null; // This lightweight harness models IDs; the mobile browser verifies the real back button.
        if (q === "#app") return app;
        if (q === "#logout") return {};
        if (html.includes(`id="${q.slice(1)}"`)) {
          if (!nodes.has(q))
            nodes.set(q, {
              dataset: {},
              setAttribute() {},
              querySelector() {
                return null;
              },
              querySelectorAll(){return [];},
            });
          return nodes.get(q);
        }
        return null;
      },
      querySelectorAll() {
        return [];
      },
    },
    fetch: async () => ({ ok: true, json: async () => state }),
  };
  vm.createContext(ctx);
  const source = fs
    .readFileSync(new URL("../public/src/app.mjs", import.meta.url), "utf8")
    .replace(/^import[\s\S]*?from ["'][^"']+["'];/gm, "")
    .replace('  } catch (e) {\n    offline = true;', '  } catch (e) {\n    throw e;\n    offline = true;');
  vm.runInContext(source, ctx);
  await new Promise((r) => setImmediate(r));
  assert.match(html, /aria-label="La tua dashboard"/);
  assert.match(html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)[1], /data-v2-tab="oggi"/);
  const beforeNavigation=requestCount;blockRequests=true;
  try{
    for(const target of ['profilo','classifiche','calendario','quasi','regolamento','admin','lega','schedina']){
      vm.runInContext('navigatePage('+JSON.stringify(target)+')',ctx);
      assert.equal(vm.runInContext('page',ctx),target==='profilo'?'impostazioni':target);
      assert.match(html,/aria-current="page"/);
      if(target==='profilo')assert.match(html,/Impostazioni/);
      if(target==='lega')assert.match(html,/class="dash-hero"/);
    }
    assert.equal(requestCount,beforeNavigation,'menus must render synchronously without requesting state, even when the server cannot respond');
  }finally{blockRequests=false;pendingRequests.forEach(resolve=>resolve(state));}
  vm.runInContext("page='schedina';render()", ctx);
  vm.runInContext(`R().matches[0].status='LIVE';R().matches[0].clock="43'";R().matches[0].liveScore=[1,0];render()`,ctx);
  assert.doesNotMatch(html,/live-region|live-compact|aria-label="Partite in diretta"/);
  assert.match(html,/data-inline-result/);
  assert.match(html,/class="inline-live"/);
  assert.match(html,/1 – 0/);
  assert.match(html,/43&#39;/);
  assert.doesNotMatch(html,/Il Marcatore|Il Difensore/);
  assert.doesNotMatch(html, /id="open-chat"/);assert.match(html,/data-chat-badge/);
  const nav = html.match(/<nav[^>]*>([\s\S]*?)<\/nav>/)[1];
  assert.equal(nav.includes("Movimenti"), false);
  assert.doesNotMatch(nav, /data-v2-tab="io"/);assert.doesNotMatch(nav,/data-v2-tab="profilo"/);assert.match(html,/aria-label="Apri impostazioni"/);assert.doesNotMatch(html,/class="ux-profile"/);
  assert.equal(nav.includes("Regolamento"), false);
  assert.equal(nav.includes('data-page="altri"'), false);
  assert.match(html, /La mia schedina/);
  assert.match(html, /Le schedine del Bar/);
  vm.runInContext("slipScope='bar';render()", ctx);
  assert.match(html, /Le schedine del bar/i);
  vm.runInContext("slipScope='mine';render()", ctx);
  assert.match(nav, /data-v2-tab="schedina"/);
  vm.runInContext("page='calendario';render()", ctx);
  assert.match(html, /data-detail=/);
  assert.equal(html.includes("Il Marcatore"), false);
  vm.runInContext("page='profilo';render()", ctx);
  assert.doesNotMatch(html, /Movimenti e giornate archiviate/);
  assert.match(html, /data-president-section="assistenza"/);
  assert.doesNotMatch(
    html,
    /profile-regulation|id="switch"|id="support-modal"/,
  );
  vm.runInContext("page='lega';render()", ctx);
  // La Home non duplica ciò che sta già in Lega, Io o nel selettore.
  assert.doesNotMatch(html, /league-regulation|Regolamento della lega|Movimenti e giornate archiviate|Entra o crea una nuova lega|class="card my-league"/);
  assert.match(html, /class="dash-hero"/);
  assert.match(html, /id="day-objectives"/);
  assert.match(html, /class="dash-summary home-card"/);
  assert.doesNotMatch(html, /Il Fantacalcio del Quasi|Scegli la tua squadra/);
  assert.doesNotMatch(html,/Borsa del Quasi|portfolio-mini/);
  vm.runInContext("page='regolamento';render()", ctx);
  assert.match(html, /IL REGOLAMENTO/);
  vm.runInContext("page='quasi';render()", ctx);
  assert.match(html, /league-quasi-card/);
  assert.match(html, /data-v2-tab="quasi"/);
  vm.runInContext("page='fantaquasi';render()", ctx);
  assert.match(html, /Il fantacalcio che si gioca al bar/);
  assert.match(html, /Cosa ci troverai/);
  vm.runInContext("page='lega';render()", ctx);
  assert.match(html, /data-home-league-invite/);
  vm.runInContext("page='classifiche';render()",ctx);
  assert.doesNotMatch(html,/data-v2-lega=|Borsa del Quasi|Giornate archiviate/);
  vm.runInContext("page='lega';render()",ctx);
  assert.doesNotMatch(html,/id="league-switch"|brand-logo|reload-data/);
  assert.match(html,/id="v2-open-leagues"/);
  vm.runInContext("state.leagues.push({...state.leagues[0],id:'second'});render()",ctx);
  assert.doesNotMatch(html,/id="league-switch"|central-league-context|brand-logo|reload-data/);
  assert.match(html,/id="v2-open-leagues"/);
  assert.match(html,/class="v2-credits"/);
  vm.runInContext("state.leagues.pop();render()",ctx);
  assert.doesNotMatch(html, /id="results"|id="import"|Salva risultati/);
  assert.match(html, /<header class="v2-top">/);
  assert.doesNotMatch(html, /Entra o crea una nuova lega/);
  assert.doesNotMatch(html, /Le leghe di cui fai parte|Associa Chrome/);
  assert.doesNotMatch(html, /chat-context-button|id="switch"/);
  vm.runInContext("page='classifiche';rankingScope='seriea';render()", ctx);
  assert.match(html,/data-ranking-metric="points"/);assert.doesNotMatch(html,/Vittorie casa/);
  vm.runInContext("page='schedina';sourceScope='seriea';slipScope='standings';render()",ctx);
  assert.match(html,/Classifica Serie A/);assert.doesNotMatch(html,/Vittorie casa|Vittorie fuori|differenza reti|Ultimo aggiornamento/);assert.match(html,/serie-table-card/);
  vm.runInContext("slipScope='mine'",ctx);
  vm.runInContext("page='schedina';rankingScope='league';render()", ctx);
  assert.doesNotMatch(html, /data-source="fantacalcio"/);
  vm.runInContext(
    "state.leagues[0].fantasyConnections=[{status:'pairing'}];page='calendario';render()",
    ctx,
  );
  assert.doesNotMatch(html, /data-calendar-source="fantacalcio"/);
  vm.runInContext(
    "state.leagues[0].rounds.push({...state.leagues[0].rounds[0],id:'fantasy-imported',source:'fantacalcio',competitionKey:'fc:test',competitionName:'Fantalega',serieARound:state.leagues[0].rounds[0].number,number:1});render()",
    ctx,
  );
  assert.match(html, /Date, partite e risultati/);
  assert.doesNotMatch(html, /data-calendar-source="fantacalcio"/);
  barTab('schedina');
  assert.equal(fantaEntries,0,'Bar tabs stay inside the Bar; the header opens Fanta');
  assert.equal(vm.runInContext('sourceScope',ctx),'seriea','opening native Fanta must not change the Bar scope');
  vm.runInContext("page='schedina';sourceScope='seriea';render()", ctx);
  assert.doesNotMatch(html, /data-source=/);
  assert.ok(vm.runInContext("availableRounds().every(r=>sourceOf(r)==='seriea')",ctx));
  vm.runInContext("sourceScope='fantacalcio';render()", ctx);
  assert.doesNotMatch(html, /data-source=/);
  assert.ok(vm.runInContext("availableRounds().every(r=>sourceOf(r)==='seriea')",ctx));
  const pageBeforeChat=vm.runInContext('page',ctx);
  await vm.runInContext("navigatePage('chat')",ctx);
  assert.equal(vm.runInContext('page',ctx),pageBeforeChat);
  assert.equal(vm.runInContext('chatOpen',ctx),true);
  vm.runInContext('closeLeagueChat()',ctx);
  assert.equal(vm.runInContext('chatOpen',ctx),false);
  assert.doesNotMatch(
    html,
    /fantasy-settings|fantasy-import-tools|id="fantasy-connect"|id="fantasy-import"/,
  );
  vm.runInContext(
    "page='lega';state.features={fantacalcioDirect:true};render()",
    ctx,
  );
  assert.doesNotMatch(html, /id="fantasy-connect"/);
  vm.runInContext("page='admin';render()",ctx);
  assert.doesNotMatch(html, /id="fantasy-connect"/);
  assert.match(html,/aria-label="Invita con WhatsApp"/);
  vm.runInContext("page='barleague';render()",ctx);
  assert.match(html,/aria-label="Invita con WhatsApp"/);
  assert.doesNotMatch(html,/quasi-roster-grid/);
  assert.doesNotMatch(html, /Collega competizione/);
  vm.runInContext("page='classifiche';render()", ctx);
  assert.match(html, /data-ranking-metric="points"/);assert.doesNotMatch(html,/data-ranking=/);
  vm.runInContext("page='schedina';showLiveStatus({state:'ready',at:Date.now()});showLiveStatus({state:'error'})",ctx);
  assert.equal(nodes.get('#live-channel-status').hidden,true,'first channel failure must not alarm the user');
  vm.runInContext("showLiveStatus({state:'error'});showLiveStatus({state:'error'})",ctx);
  assert.equal(nodes.get('#live-channel-status').hidden,false);
  assert.match(nodes.get('#live-channel-status').textContent,/Aggiornamento in pausa/);
  vm.runInContext("page='lega';showLiveStatus(liveStatus)",ctx);
  assert.equal(nodes.get('#live-channel-status').hidden,true,'connection notice is only relevant to results');
  vm.runInContext("state.leagues[0].admin='another-president';page='lega';render()",ctx);
  assert.match(html,/data-home-league-invite/);assert.doesNotMatch(html,/id="copy"/);
  assert.doesNotMatch(html,/data-page="admin"/);
  vm.runInContext("page='admin';render()",ctx);
  assert.equal(vm.runInContext('page',ctx),'admin');assert.match(html,/Invita con WhatsApp/);assert.doesNotMatch(html,/Salva regole|id="prizes"|id="branding"/);
  vm.runInContext("page='profilo';render()",ctx);
  assert.ok(html.indexOf('id="support-form"')<html.indexOf('profile-logout'));
  assert.ok(html.indexOf('data-president-section="assistenza"')>html.indexOf('data-president-section="avvisi"'));
  vm.runInContext("state={user:null,leagues:[]};page='profilo'",ctx);
  workerMessage({data:{type:'open-slip',league:state.leagues[0].id,round:state.leagues[0].rounds[0].id}});
  await vm.runInContext('refresh(true)',ctx);
  assert.equal(vm.runInContext('page',ctx),'schedina');
  assert.equal(vm.runInContext('selectedRoundId',ctx),state.leagues[0].rounds[0].id);
  await vm.runInContext('returnToLanding()',ctx);
  assert.equal(vm.runInContext('state.user',ctx),null);assert.equal(vm.runInContext('landingDismissed',ctx),false);
  assert.match(html,/PUBLIC-AREA/);

});
