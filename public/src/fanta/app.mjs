import {applyLeagueTheme,linkedLeagueIdentity} from '../league-theme.mjs';
import {withHomeVotes} from './home-votes.mjs';
import {renderStudio,studioTap} from './formazione-studio.mjs';
import {bestLineup,nextEmptySlot} from './squadra.mjs';
import {readAppRoute,writeAppRoute} from '../routes.mjs';
import {createFantaSlips} from './schedine.mjs';
import {sportsWindowActive} from '../sports-window.mjs';
import {retainAppHeader} from '../mode-switch.mjs';
// Controllore del Fanta: tiene modalità, lega e tab correnti, chiede i dati all'api e disegna.
// mountFanta(root, {api}) è l'unica entrata: l'anteprima passa l'api finta, l'app vera quella su /fanta-api.
import { topBar, tabBar, leagueSheet, FANTA_TABS } from './shell.mjs';
import { renderHome,homeTeam,tickCountdowns } from './home.mjs';
import { renderGiornata, renderPlayerSheet, findPlayer } from './giornata.mjs';
import { renderSquadra, renderTeamRoster, renderPickSheet, renderBenchSheet, draftFrom, lineupOf, sameLineup, withFormation, assign, unassign, benchAdd, benchRemove, benchMove, missingOf, canDropOn, dropOn, quickAdd, benchAll } from './squadra.mjs';
import { enableDrag } from './trascina.mjs';
import { renderAsta, renderListoneSheet, renderListoneRows, renderAssignConfirm, tickAuction } from './asta.mjs';
import { renderLega } from './lega.mjs';
import { renderIo, renderDemoInfo } from './io.mjs';
import { renderPilotPicker,renderPilotConfirm,renderPilotInfo } from './pilota.mjs';
import {renderReleases,renderReleaseConfirm,renderRosterAdmin,renderMarketConfirm,refundFor} from './mercato.mjs';
import { esc } from './formato.mjs';
import {competitionSwitcher} from './competitions-ui.mjs';
import {bindAppInvites} from '../app-invite.mjs';
import {findBarSlip} from './bar-slip.mjs';
import {bindStyledSelects,closeStyledSelect} from '../styled-select.mjs';

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};

// demo: true = dati di prova (chi non ha accesso al Fanta vero, o chi prova dalla landing): banner fisso,
// spiegazione al primo ingresso e avvisi quando "salva" qualcosa, perché niente resta salvato davvero.
export function mountFanta(root, { api, bootstrap = null, demo = false, barLeagues = [], slipServices = null, initialTab = 'oggi', onModeChange = () => {} }) {
  const kind=demo===true?'public':demo||null;
  const lifecycle=new AbortController();let destroyed=false,suspended=false;
  const on=(target,type,fn,options={})=>target?.addEventListener(type,event=>{if(!suspended&&!destroyed)fn(event);},{...options,signal:lifecycle.signal});
  const ui = {
    me: null,
    pilot:null,
    io: { saved: false },
    mode: store.get('qdq:mode') === 'bar' ? 'bar' : 'fanta',
    tab: readAppRoute()?.mode==='fanta'?readAppRoute().page:initialTab,
    studio:null,
    leagueId:readAppRoute()?.league||store.get('qdq:fantaLeague'),
    leagues: [],
    home: null,
    error: null,
    sheet: null, // 'leagues' | { player: id } | { pick: slot } | { bench: true }
    // Squadra: dati dal server + bozza della formazione non ancora salvata
    squadra: { data: null, draft: null, sub: 'formazione', dirty: false, saving: false, error: null, moved: null },
    // Asta: stato letto ogni secondo, scarto d'orologio col server, cosa sta scrivendo/scegliendo l'utente
    asta: { data: null, players: null, offset: 0, amount: '', error: null, query: '', role: 'tutti', picking: null, callAmount: null },
    // Lega: sezione aperta, giornata aperta nel calendario, modulo "nuova asta" dell'admin
    lega: { data: null, sub: 'classifica', openRound: null, editAuction: false, auctionForm: null, auctionError: null, copied: false },
    // Giornata
    roundNumber: null,
    round: null,
    matchupId: null,
    matchup: null,
    side: 'home',
    view: store.get('qdq:fantaView') === 'campo' ? 'campo' : 'lista',
  };
  let timer=null,request=0,openingHomeLineup=false;

  const slips=createFantaSlips({services:slipServices,redraw:()=>render(),teamResolver:name=>ui.home?.standings?.find(s=>s.team.name===name)?.team,loadMatchup:(context,round,match)=>api.matchup(context.leagueId,round.number,match.nativeId||match.id)});
  const slipContext=()=>({leagueId:league()?.id,competitionId:ui.home?.competition?.id||ui.lega.data?.competition?.id,enabled:league()?.slipsEnabled});
  const league = () => ui.leagues.find(l => l.id === ui.leagueId) || ui.leagues[0];

  function page() {
    if (ui.error) return `<div class="fanta-empty"><h2>Qualcosa non va</h2><p>${esc(ui.error)}</p><button type="button" class="secondary" data-action="retry">Riprova</button></div>`;
    if (ui.mode === 'bar') return `<div class="fanta-empty"><span class="eyebrow">Modalità Bar</span><h2>Qui c'è il Bar che conosci</h2>
      <p>Schedine, Quasi e premi. Nell'app vera questo interruttore apre la parte Bar, con la stessa lega e gli stessi amici.</p>
      <button type="button" class="primary" data-mode="fanta">Torna al Fanta</button></div>`;
    if(ui.pilot)return renderPilotPicker(ui.pilot);
    if(ui.me?.access==='full'&&!ui.leagues.length)return '<div class="fanta-empty"><h2>La tua panchina ti aspetta</h2><p>Entra nel Bar della tua lega e controlla le squadre disponibili qui sopra. Il presidente può creare la lega Fanta con rose random.</p><button class="secondary" data-mode="bar">Torna al Bar</button></div>';
    if(ui.tab==='schedine')return ui.home?slips.render(slipContext()):'<div class="fanta-loading" role="status">Carichiamo la competizione…</div>';
    if (ui.tab === 'oggi') return ui.home ? renderHome({...ui.home,openingLineup:openingHomeLineup,bar:findBarSlip(ui.home,barLeagues) || ui.home.bar}) : '<div class="fanta-loading" role="status">Carichiamo la tua squadra…</div>';
    if (ui.tab === 'giornata') return renderGiornata({ round: ui.round, matchup: ui.matchup, side: ui.side, view: ui.view });
    if (ui.tab === 'squadra') return renderSquadra(ui.squadra);
    if(ui.tab==='asta'&&ui.asta.data?.status==='running'&&ui.asta.data?.phase==='releases')return renderReleases(ui.asta.data,ui.asta);
    if (ui.tab === 'asta') return renderAsta(ui.asta.data, ui.asta, ui.asta.players);
    if (ui.tab === 'lega'||ui.tab==='classifica') return renderLega(ui.lega.data,{...ui.lega,group:ui.tab,slipsHtml:slips.ranking(slipContext(),ui.lega.metric||'points')});
    if (ui.tab === 'io') return renderIo(ui.me, ui.leagues, league()?.id, {...ui.io,pilot:league()?.kind==='pilot'}, kind==='public');
    return '';
  }

  const demoBar = () => !(kind||league()?.kind==='pilot') || ui.mode !== 'fanta' ? ''
    : kind === 'pilot'||league()?.kind==='pilot'
      ? `<div class="fanta-demo-bar is-pilot" role="note"><b>PILOTA</b><span>Le squadre senza allenatore le guida il computer · le tue formazioni sono salvate davvero</span><button type="button" data-action="demo-info">Come funziona</button></div>`
      : `<div class="fanta-demo-bar" role="note"><b>DEMO</b><span>Dati di prova: niente viene salvato davvero</span><button type="button" data-action="demo-info">Come funziona</button></div>`;

  function toast(text) {
    if(destroyed||suspended)return;
    document.querySelector('.fanta-toast')?.remove();
    const el = document.createElement('div');
    el.className = 'fanta-toast'; el.setAttribute('role', 'status'); el.textContent = text;
    document.body.append(el);
    setTimeout(() => el.remove(), 4000);
  }
  // In demo, la prima volta che si "salva" qualcosa in ogni area, si ricorda che è solo una prova.
  const told = new Set();
  const demoNote = (area, text) => { if (kind==='public' && !told.has(area)) { told.add(area); toast(text); } };

  function sheet() {
    if (ui.sheet === 'leagues') return leagueSheet(ui.leagues.map(l=>linkedLeagueIdentity(l,barLeagues)), league()?.id);
    if (ui.sheet === 'demo') return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
      <div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title"><div class="v2-sheet-handle"></div>${kind==='pilot'||league()?.kind==='pilot'?renderPilotInfo():renderDemoInfo()}</div>`;
    if(ui.sheet?.rosterConfirm||ui.sheet?.startBidding){const r=ui.sheet.rosterConfirm;return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div><div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">${renderMarketConfirm(r?'Confermi la correzione?':'Iniziamo gli acquisti?',r?[(r.playerName||r.playerId),r.teamName,r.price!==undefined?r.price+' crediti':'',r.toName?'Verso '+r.toName:'','Le formazioni già giocate restano invariate.'].filter(Boolean).join(' · '):'La fase svincoli verrà chiusa. Dopo non sarà più possibile annullare uno svincolo.',r?'data-roster-confirm':'data-releases-confirm')}</div>`;}
    if(ui.sheet?.release)return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div><div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true">${renderReleaseConfirm(ui.asta.data)}</div>`;
    if(ui.sheet?.pilotConfirm)return renderPilotConfirm(ui.pilot,ui.sheet.pilotConfirm);
    if (ui.sheet?.mconfirm) return ui.asta.data ? renderAssignConfirm(ui.asta.data, ui.sheet.mconfirm, Number(ui.asta.mprice)) : '';
    let body = '';
    if (ui.sheet?.asta) body = ui.asta.players && ui.asta.data ? renderListoneSheet(ui.asta.players, ui.asta.data, ui.asta) : '<div class="fanta-loading">Carichiamo il listone…</div>';
    else if(ui.sheet?.roster)body=ui.sheet.data?renderTeamRoster(ui.sheet.data,ui.sheet.data.canManageRoster?renderRosterAdmin(ui.sheet.data,ui.lega.data,ui.lega):''):`<button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button><p role="status">${esc(ui.sheet.error||'Carichiamo la rosa…')}</p>`;
    else if (ui.sheet?.pick && ui.squadra.draft) body = renderPickSheet(ui.squadra, ui.sheet.pick,!!ui.sheet.guided);
    else if (ui.sheet?.bench && ui.squadra.draft) body = renderBenchSheet(ui.squadra);
    else {
      const p = ui.sheet?.player && findPlayer(ui.matchup, ui.sheet.player);
      if (p) body = renderPlayerSheet(p, { official: ui.matchup.official });
    }
    if (!body) return '';
    return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
      <div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">
        <div class="v2-sheet-handle"></div>${body}
      </div>`;
  }

  // ----- Squadra -----
  async function loadTeam({keepView=false}={}) {
    const sq = ui.squadra;
    const previous=sq.data;if(!keepView)sq.data = null; render();
    try {
      const data = await api.team(league()?.id);
      const keepDraft=keepView&&sq.dirty&&previous?.team.id===data.team.id&&previous?.round.number===data.round.number;
      sq.data = data;sq.loadedAt=Date.now();
      if(!keepDraft)setDraft(draftFrom(data.lineup || { formation: data.previous?.formation || '4-4-2' }, data.roster), { keepMoved: false });
    } catch {
      if(keepView&&sq.data)sq.error='Aggiornamento non disponibile. La tua bozza è conservata.';else ui.error = 'Non riusciamo a leggere la tua squadra.';
    }
    render();
  }

  function setDraft(draft, { keepMoved = false } = {}) {
    const sq = ui.squadra;
    sq.draft = draft;
    sq.dirty = sq.data.lineup ? !sameLineup(draft, sq.data.lineup) : lineupOf(draft).starters.length + draft.bench.length > 0;
    sq.error = null;
    if (!keepMoved) { sq.moved = null; sq.promoted = null; }
  }

  async function openHomeLineup(){
    if(openingHomeLineup||ui.squadra.saving)return;
    const id=league()?.id;openingHomeLineup=true;render();
    try{
      let data=await api.team(id);
      if((ui.home?.nextLineup&&data.round.number!==ui.home.nextLineup.round)||data.round.locked&&(ui.home?.nextLineup||['da-schierare','schierata'].includes(ui.home?.round?.state))){api.invalidateReads?.();data=await api.team(id);}
      if(destroyed||suspended||league()?.id!==id)return;
      if(data.round.locked)throw Error('La formazione non è ancora aperta per la prossima giornata.');
      const keepDraft=ui.squadra.dirty&&ui.squadra.data?.team.id===data.team.id&&ui.squadra.data?.round.number===data.round.number;
      ui.squadra.data=data;ui.squadra.loadedAt=Date.now();
      if(!keepDraft)setDraft(draftFrom(data.lineup||{formation:data.previous?.formation||'4-4-2'},data.roster),{keepMoved:false});
      ui.sheet=null;ui.studio={role:'tutti',slot:null};
    }catch(error){if(!destroyed&&!suspended)toast(error.message);}
    finally{openingHomeLineup=false;if(!destroyed&&!suspended)render();}
  }

  async function saveLineup() {
    const sq = ui.squadra;
    if (sq.data?.round.locked || sq.saving || missingOf(sq.draft) || !sq.dirty) return;
    const id=league()?.id,round=sq.data.round.number,submitted=lineupOf(sq.draft);sq.saving=true;render();
    try {
      const saved=await api.saveLineup(id,round,submitted);if(destroyed||league()?.id!==id||sq.data?.round.number!==round)return;sq.data.lineup=saved;toast('Formazione salvata ✓');
      sq.dirty = false; sq.moved = null; sq.promoted = null;
      demoNote('lineup', 'Formazione salvata per prova: in demo resta solo su questo schermo.');
      ui.home = null; ui.round = null; // la home e la giornata devono rileggere la formazione salvata
      api.home(id).then(h=>{if(!destroyed&&league()?.id===id){ui.home=h;if(!suspended&&ui.tab==='oggi')render();}}).catch(() => {});
    } catch (e) {
      sq.error = 'Formazione non salvata: ' + e.message;
    } finally{sq.saving=false;if(!destroyed&&!suspended)render();}
  }

  function handleSquadra(d) {
    const sq = ui.squadra, data = sq.data;
    if (!data) return false;
    if (d.sqSub) {writeAppRoute({mode:'fanta',page:'squadra',section:d.sqSub,league:league()?.id}); sq.sub = d.sqSub; render(); return true; }
    if (d.sqFilter) { sq.filter = d.sqFilter; render(); return true; }
    if(d.studio==='open'){if(!data.round.locked&&!sq.saving&&!sq.openingStudio){sq.openingStudio=true;void(async()=>{try{if(Date.now()-(sq.loadedAt||0)>60000)await loadTeam({keepView:true});if(!destroyed&&!suspended&&!sq.data?.round.locked)ui.studio={role:'tutti',slot:null};}finally{sq.openingStudio=false;if(!destroyed&&!suspended)render();}})();}return true;}
    if(d.studio==='close'){ui.studio=null;render();return true;}
    if(sq.saving)return !!(d.lineup||d.pick||d.benchPick||d.formation||d.stPlayer||d.stSlot||d.stRole||d.stClear||d.benchMove||d.benchRemove);
    if(data.round.locked)return false;
    if(d.stRole){ui.studio={...ui.studio,role:d.stRole,slot:null};render();return true;}
    if(d.stSlot){ui.studio={...ui.studio,slot:ui.studio?.slot===d.stSlot?null:d.stSlot};render();return true;}
    if(d.stPlayer){setDraft(studioTap(sq.draft,data.roster,d.stPlayer,ui.studio?.slot,data.rules.benchMax));ui.studio.slot=null;render();return true;}
    if(d.stClear){setDraft(unassign(sq.draft,d.stClear));ui.studio.slot=null;render();return true;}
    if(d.lineup==='restore'){if(data.lineup){setDraft(draftFrom(data.lineup,data.roster));ui.sheet=null;if(ui.studio){ui.studio.slot=null;ui.studio.role='tutti';}render();}return true;}
    if(d.lineup==='best'){setDraft(bestLineup(sq.draft,data.roster,data.rules.benchMax));render();return true;}
    if(d.lineup==='guided'){const next=nextEmptySlot(sq.draft);ui.sheet=next?{pick:next,guided:true}:{bench:true};renderSheet();return true;}
    if (d.formation) {
      const { draft, moved, promoted } = withFormation(sq.draft, d.formation, data.roster, data.rules.benchMax);
      setDraft(draft); sq.moved = moved.length ? moved : null; sq.promoted = promoted.length ? promoted : null; render(); return true;
    }
    if (d.slot) { if (!data.round.locked) { ui.sheet = { pick: d.slot }; renderSheet(); } return true; }
    if (d.pick) {const guided=ui.sheet?.guided;setDraft(assign(sq.draft,ui.sheet.pick,d.pick));const next=nextEmptySlot(sq.draft);ui.sheet=guided?(next?{pick:next,guided:true}:{bench:true}):null;render();return true;}
    if (d.unpick) { setDraft(unassign(sq.draft, ui.sheet.pick)); ui.sheet = null; render(); return true; }
    if (d.listAdd) {
      const next = quickAdd(sq.draft, data.roster, d.listAdd, data.rules.benchMax);
      if (next) { setDraft(next); render(); }
      return true;
    }
    if (d.benchAdd) { ui.sheet = { bench: true }; renderSheet(); return true; }
    if (d.benchPick) {if((data.rules.benchMax==null||sq.draft.bench.length<data.rules.benchMax)&&!sq.draft.bench.includes(d.benchPick)&&!Object.values(sq.draft.slots).includes(d.benchPick)){setDraft(benchAdd(sq.draft,d.benchPick));}ui.sheet={bench:true};render();return true;}
    if (d.benchRemove) { setDraft(benchRemove(sq.draft, d.benchRemove)); render(); return true; }
    if (d.benchMove) { setDraft(benchMove(sq.draft, d.benchMove, Number(d.step))); render(); return true; }
    if (d.lineup === 'save') { saveLineup(); return true; }
    if (d.lineup === 'repeat' && data.previous) { setDraft(draftFrom(data.previous, data.roster)); render(); return true; }
    if (d.lineup === 'bench-all') { setDraft(benchAll(sq.draft, data.roster,data.rules.benchMax)); render(); return true; }
    if(d.lineup==='clear-bench'){setDraft({...sq.draft,bench:[]});if(ui.studio)ui.studio.slot=null;render();return true;}
    if (d.lineup === 'clear') { setDraft(draftFrom({ formation: sq.draft.formation }, data.roster)); if(ui.studio){ui.studio.slot=null;ui.studio.role='tutti';}render(); return true; }
    return false;
  }

  const TAB_OF = { formazione: 'squadra', asta: 'lega',giornata:'oggi' };

  function render() {
    if(destroyed)return;
    document.body.dataset.gameMode='fanta';
    applyLeagueTheme(linkedLeagueIdentity(league(),barLeagues));
    closeStyledSelect();
    // Chi sta scrivendo (offerta libera) non deve perdere il campo a ogni aggiornamento live.
    const active = document.activeElement, focusId = root.contains(active) && active.id, sel = focusId && active.selectionStart;
    root.innerHTML = `${topBar({user:ui.me,slipCredits:(()=>{const d=slips.context(slipContext());return d.league?.members?.find(m=>m.uid===d.uid)?.fantasyWallets?.[d.league.fantasyWalletScopes?.[d.round?.competitionKey]]?.credits??d.league?.members?.find(m=>m.uid===d.uid)?.fantasyWallet?.credits;})(),hideCredits:false,mode:ui.mode, league: ui.mode === 'fanta' ? linkedLeagueIdentity(league(),barLeagues) : null, credits:ui.asta.data?.teams?.find(t=>t.team.id===ui.home?.me.teamId)?.credits??ui.home?.auction?.credits })}${demoBar()}
      <main class="fanta-main">${competitionSwitcher(ui.home?.competitions||ui.lega.data?.competitions,ui.home?.competition?.id||ui.lega.data?.competition?.id)}${page()}</main>
      ${ui.mode === 'fanta' ? tabBar(FANTA_TABS.some(([id]) => id === ui.tab) ? ui.tab : TAB_OF[ui.tab] || 'oggi') : ''}`;
    retainAppHeader(root);
    document.dispatchEvent(new window.CustomEvent('quasi:chat-context',{detail:{league:league()?.id}}));
    if(ui.tab==='schedine')slips.bind(root,slipContext());
    if (focusId) {
      const el = document.getElementById(focusId);
      // Cursore dove l'utente stava scrivendo (in fondo se il campo non lo dice), così si scrive da sinistra a destra.
      if (el && !el.disabled) { el.focus(); try { const at = sel ?? el.value.length; el.setSelectionRange(at, at); } catch {} }
    }
    // Asta dal vivo: il cursore va da solo dove serve (prezzo dopo aver messo il giocatore sul tavolo, ricerca dopo l'assegnazione).
    if (ui.asta.focus) { document.getElementById(ui.asta.focus)?.focus(); ui.asta.focus = null; }
    bindAppInvites(root);
    renderSheet();
    bindStyledSelects(root);
    if (ui.tab === 'asta') tickAuction(root, ui.asta.offset);
  }

  // ----- Asta: lettura ogni secondo mentre la sala è aperta -----
  let astaTimer = null, astaTicker = null, auctionPolling=false;
  function startAuction() {
    stopAuction();
    pollAuction();
    astaTimer = setInterval(pollAuction, 1000);
    astaTicker = setInterval(() => tickAuction(document, ui.asta.offset), 200); // pagina e listone
  }
  function stopAuction() { clearInterval(astaTimer); clearInterval(astaTicker); astaTimer = astaTicker = null; }

  function applyAuction(a) {
    const s = ui.asta;
    if(s.data&&a.version<s.data.version)return; // An older poll must not undo a completed command.
    const changedVersion = !s.data || s.data.version !== a.version;
    s.offset = Date.parse(a.serverTime) - Date.now();
    if (!changedVersion) return;
    if (s.data?.lot?.id !== a.lot?.id) { s.amount = ''; s.error = null; } // nuovo giocatore in tavola
    if (s.data?.table?.id !== a.table?.id) { s.mprice = ''; s.error = null; } // dal vivo: nuovo giocatore sul tavolo
    const reloadListone = a.status==='running'&&a.phase!=='releases' && a.mode === 'manual' && a.isAdmin && (!s.players || s.data?.phase!==a.phase || s.data?.log?.[0]?.id !== a.log[0]?.id || s.data?.log?.length !== a.log.length);
    if(a.status==='running'&&a.phase==='releases'&&a.isAdmin&&(!s.releasePlayers||JSON.stringify(a.releases||[])!==JSON.stringify(s.data?.releases||[]))){const id=league()?.id,batch=a.releaseBatchId,releases=JSON.stringify(a.releases||[]);api.auctionAssigned(id).then(players=>{if(destroyed||league()?.id!==id||s.data?.status!=='running'||s.data?.phase!=='releases'||s.data?.releaseBatchId!==batch||JSON.stringify(s.data?.releases||[])!==releases)return;s.releasePlayers=players;if(ui.tab==='asta')render();}).catch(()=>{});}
    if(ui.sheet?.release&&(a.status!=='running'||a.phase!=='releases'||ui.sheet.release!==a.table?.id)){ui.sheet=null;toast('Il giocatore sul tavolo è cambiato.');}
    if(ui.sheet?.startBidding&&(a.status!=='running'||a.phase!=='releases'))ui.sheet=null;
    s.data = a;ui.lega.data=null;api.invalidateReads?.();
    if(ui.home?.auction){Object.assign(ui.home.auction,{status:a.status,mode:a.mode});const budget=a.teams.find(t=>t.team.id===a.me);if(budget)ui.home.auction.credits=budget.credits;}
    if(reloadListone){const id=league()?.id;api.auctionPlayers(id).then(list=>{if(destroyed||league()?.id!==id||s.data?.status!=='running'||s.data?.phase==='releases')return;s.players=list;if(ui.tab==='asta')render();}).catch(()=>{});}
    // Se non tocca più a me chiamare, il listone si chiude da solo.
    if (ui.sheet?.asta && (a.caller !== a.me || a.lot)) { ui.sheet = null; s.picking = null; s.callAmount = null; }
    if (ui.tab === 'asta') render();
  }

  async function pollAuction() {
    if (auctionPolling || ui.tab !== 'asta' || ui.mode !== 'fanta' || (document.hidden||navigator.onLine===false)) return;
    auctionPolling=true;const id=league()?.id;
    try { const data=await api.auction(id);if(!destroyed&&ui.tab==='asta'&&league()?.id===id)applyAuction(data); } catch {} finally{auctionPolling=false;}
  }

  async function placeBid(amount) {
    const s = ui.asta, lot = s.data?.lot,id=league()?.id;
    if (!lot || !(amount > 0)) return;
    try { const a=await api.bid(id,lot.id,amount);if(destroyed||league()?.id!==id)return;applyAuction(a); s.amount = ''; s.error = null; render(); demoNote('auction', 'In demo giochi contro squadre finte: niente resta salvato.'); }
    catch (e) { if(destroyed||league()?.id!==id)return;s.error = e.message; render(); }
  }

  async function openListone() {
    ui.sheet = { asta: true }; ui.asta.picking = null; ui.asta.callAmount = null; ui.asta.error = null;
    renderSheet();
    const id=league()?.id;try{const players=await api.auctionPlayers(id);if(destroyed||league()?.id!==id)return;ui.asta.players=players;if(ui.sheet?.asta)renderSheet();}catch(err){if(!destroyed&&league()?.id===id){ui.asta.error=err.message;toast(err.message);}}
  }

  // Azioni del banditore: stessa gestione di errori e aggiornamento.
  function admin(call, focus) {
    const s = ui.asta,id=league()?.id;
    call.then(a => { if(destroyed||league()?.id!==id)return; s.error = null; applyAuction(a); if (focus) s.focus = focus; render(); demoNote('admin', 'In demo sei tu l\'admin: prova pure, niente resta salvato.'); }).catch(e => { if(destroyed||league()?.id!==id)return;s.error = e.message; render(); });
  }

  function handleAsta(d) {
    const s = ui.asta, id = league()?.id;
    if(d.release){ui.sheet={release:d.release};renderSheet();return true;}
    if(d.releaseUndo){admin(api.auctionReleaseUndo(id,d.releaseUndo));return true;}
    if(d.releasesDone){ui.sheet={startBidding:true};renderSheet();return true;}
    if(d.releasesConfirm){ui.sheet=null;renderSheet();admin(api.auctionReleasesDone(id));return true;}
    if(d.astaCancel){const p=s.data?.lot?.player||s.data?.table;if(p){s.mprice='';admin(api.auctionCancelLot(id,s.data?.lot?.id,p.id),'fanta-m-q');}return true;}
    if(d.astaClose){ui.sheet=null;renderSheet();admin(api.auctionClose(id));ui.lega.data=null;return true;}
    if (d.astaMode) { admin(api.auctionMode(id, d.astaMode)); return true; }
    if (d.mRole) { s.mrole = d.mRole; render(); return true; }
    if (d.mTable) { admin(api.auctionTable(id, d.mTable), 'fanta-m-price'); return true; }
    if (d.mClear) { admin(api.auctionTable(id, null), 'fanta-m-q'); return true; }
    // Tap sulla squadra: piccolo pop-up di conferma, poi assegnazione.
    if (d.mTeam) { s.error = null; ui.sheet = { mconfirm: d.mTeam }; renderSheet(); return true; }
    if (d.mConfirm) {
      const p = s.data?.table;
      ui.sheet = null; renderSheet();
      if (p) admin(api.assign(id, p.id, d.mConfirm, Number(s.mprice)), 'fanta-m-q');
      return true;
    }
    if (d.mUndo) { admin(api.undoSale(id, d.mUndo)); return true; }
    if (d.bid) { placeBid(Number(d.bid)); return true; }
    if (d.astaPass) {
      const lot = s.data?.lot;
      if (lot) api.pass(id, lot.id).then(a => { if(destroyed||league()?.id!==id)return;s.error = null; applyAuction(a); render(); }).catch(e => { if(destroyed||league()?.id!==id)return;s.error = e.message; render(); });
      return true;
    }
    if (d.astaListone) { openListone(); return true; }
    if (d.astaRole) { s.role = d.astaRole; renderSheet(); return true; }
    if (d.astaPick) { s.picking = d.astaPick; s.callAmount = null; s.error = null; renderSheet(); document.querySelector('.fanta-sheet')?.scrollTo(0, 0); return true; }
    if (d.astaAmount) { s.callAmount = Number(d.astaAmount); renderSheet(); return true; }
    if (d.astaCall) {
      api.nominate(id, d.astaCall, Number(d.amount))
        .then(a => { if(destroyed||league()?.id!==id)return;ui.sheet = null; s.picking = null; s.callAmount = null; applyAuction(a); render(); })
        .catch(e => { if(destroyed||league()?.id!==id)return;s.error = e.message; renderSheet(); });
      return true;
    }
    return false;
  }

  on(document.getElementById('v2-sheet-root'),'submit',async e=>{
    const form=e.target;if(!form.matches('[data-release-form],[data-roster-form]'))return;e.preventDefault();if(form.dataset.busy==='1')return;const b=form.querySelector('button[type=submit]'),error=form.querySelector('[data-form-error]');
    if(form.matches('[data-roster-form]')){const p=Object.fromEntries(new FormData(form));if(p.price!==undefined)p.price=Number(p.price);const data=ui.sheet.data;ui.sheet={rosterConfirm:{...p,teamId:form.dataset.team,teamName:data.team.name,playerName:(p.kind==='add'?ui.lega.freePlayers:data.roster)?.find(x=>x.id===p.playerId)?.name,toName:ui.lega.data?.members.find(m=>m.team.id===p.toTeamId)?.team.name}};renderSheet();return;}
    form.dataset.busy='1';b.disabled=true;b.setAttribute('aria-busy','true');
    try{if(form.matches('[data-release-form]')){const refund=refundFor(form),id=league()?.id,a=await api.auctionRelease(id,form.dataset.releasePlayer,refund);if(destroyed||league()?.id!==id)return;applyAuction(a);ui.sheet=null;render();}else{const input=Object.fromEntries(new FormData(form)),kind=input.kind;delete input.kind;input.teamId=form.dataset.team;if(input.price!==undefined)input.price=Number(input.price);await api.rosterChange(league()?.id,kind,input);ui.home=null;await loadLega();await openRoster(form.dataset.team);toast('Rosa corretta.');}}
    catch(err){error.textContent=err.message;}finally{form.dataset.busy='0';b.disabled=false;b.removeAttribute('aria-busy');}
  });
  on(document.getElementById('v2-sheet-root'),'change',async e=>{if(e.target.matches('[data-roster-kind]')){ui.lega.rosterKind=e.target.value;if(e.target.value==='add'&&!ui.lega.freePlayers)try{ui.lega.freePlayers=await api.rosterPlayers(league()?.id);}catch(err){toast(err.message);}renderSheet();}if(e.target.closest('[data-release-form]')){const form=e.target.closest('form');form.querySelector('[data-refund-preview]').textContent=ui.asta.data.table.ownerTeam.name+' riavrà '+refundFor(form)+' crediti.';}});
  on(root,'submit', e => {
    if(e.target.matches('[data-fanta-slips-form]')){e.preventDefault();const f=e.target,b=f.querySelector('button');if(f.dataset.busy==='true')return;f.dataset.busy='true';const enabled=f.elements.enabled.checked;b.disabled=true;b.setAttribute('aria-busy','true');api.setSlips(league()?.id,enabled).then(()=>{league().slipsEnabled=enabled;const bar=slips.context(slipContext()).league;if(bar)bar.fantaSlipsEnabled=enabled;return loadLega();}).catch(err=>toast(err.message)).finally(()=>{f.dataset.busy='false';b.disabled=false;b.removeAttribute('aria-busy');});return;}
    if(e.target.matches('[data-league-size-form],[data-competition-create-form],[data-competition-start-form]')){
      e.preventDefault();const form=e.target;if(form.dataset.submitting==='true')return;form.dataset.submitting='true';const p=Object.fromEntries(new FormData(form)),b=form.querySelector('button[type="submit"]');b.disabled=true;
      const action=form.matches('[data-league-size-form]')?api.configureLeague(league()?.id,Number(p.size)):form.matches('[data-competition-create-form]')?api.createCompetition(league()?.id,p):api.startCompetition(league()?.id,{...p,startRound:Number(p.startRound),twice:!!p.twice});
      action.then(async result=>{if(result.status==='draft'){await switchCompetition(result.id);ui.tab='lega';ui.lega.sub='competizioni';render();}else{ui.home=null;await load();await loadLega();}toast('Impostazioni salvate.');}).catch(err=>toast(err.message)).finally(()=>{form.dataset.submitting='false';b.disabled=false;});return;
    }
    if(e.target.matches('[data-team-link-form]')){e.preventDefault();const form=e.target,data=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;
      api.linkTeam(league()?.id,data.get('team'),data.get('username')).then(result=>{ui.lega.linkError=null;toast(result.demo?'Associazione simulata: in demo niente viene salvato.':'Account associato alla squadra.');return loadLega();}).catch(error=>{ui.lega.linkError=error.message;render();});return;
    }
    if (e.target.matches('[data-lega-auction-form]')) {
      e.preventDefault();
      const f = new FormData(e.target), data = { type: f.get('type'), mode: f.get('mode'), startsAt: new Date(f.get('startsAt')).toISOString() };
      ui.lega.auctionForm = { type: data.type, mode: data.mode, startsAt: f.get('startsAt') };
      legaAuction(api.auctionSchedule(league()?.id, data));
      return;
    }
    if (!e.target.matches('[data-bid-form]')) return;
    e.preventDefault();
    placeBid(Number(new FormData(e.target).get('amount') ?? e.target.querySelector('input').value));
  });
  on(root,'input', e => {
    const id = e.target.id;
    // Campi numerici: solo cifre (sono di tipo testo perché il cursore resti dove si scrive).
    if (id === 'fanta-a-amount' || id === 'fanta-m-price') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (id === 'fanta-a-amount') ui.asta.amount = e.target.value;
    if(id==='fanta-release-query'){ui.asta.releaseQuery=e.target.value;render();return;}
    if (id === 'fanta-m-q') { ui.asta.mq = e.target.value; render(); }
    if (id === 'fanta-m-price') { ui.asta.mprice = e.target.value; render(); }
  });
  on(document.getElementById('v2-sheet-root'),'input', e => {
    if (!e.target.matches('[data-asta-q]')) return;
    ui.asta.query = e.target.value;
    const rows = document.getElementById('fanta-listone-rows');
    if (rows) rows.innerHTML = renderListoneRows(ui.asta.players || [], ui.asta.data, ui.asta);
  });

  let lastSheetHtml=null;
  function renderSheet() {
    if(destroyed)return;
    const sheetRoot = document.getElementById('v2-sheet-root');
    if (!sheetRoot) return;
    const html=ui.studio&&ui.squadra.data?renderStudio(ui.squadra,ui.studio):ui.sheet?sheet():'';
    document.body.classList.toggle('fs-open',!!ui.studio);
    if(html&&html===lastSheetHtml&&!sheetRoot.hidden)return; // Preserve typed amounts and selected refunds during polling.
    lastSheetHtml=html;
    const wasOpen = !sheetRoot.hidden, scroll = sheetRoot.querySelector('.fanta-sheet')?.scrollTop;
    const horizontal=['.fs-grid','.fs-blist','.fs-tabs','.fs-bench-row','.fs-formations'].map(selector=>{const el=sheetRoot.querySelector(selector);return {selector,left:el?.scrollLeft||0,list:el?.dataset.stList};});
    sheetRoot.hidden = !html;
    sheetRoot.innerHTML = html;
    for(const {selector,left,list} of horizontal){const el=sheetRoot.querySelector(selector);if(el&&el.dataset.stList===list)el.scrollLeft=left;}
    bindStyledSelects(sheetRoot);
    document.body.classList.toggle('fanta-sheet-open', !!html);
    if (!html) return;
    // Aggiornamento live con la scheda già aperta: niente salto in cima, niente cambio di focus.
    if (wasOpen && scroll != null) { const s = sheetRoot.querySelector('.fanta-sheet'); if (s) s.scrollTop = scroll; return; }
    sheetRoot.querySelector('[data-m-confirm], .v2-league-row.is-active, .fanta-close, .v2-league-row')?.focus();
  }
  async function switchCompetition(id){
    if(!id)return;api.setCompetition?.(id);request++;ui.sheet=null;ui.round=null;ui.matchup=null;ui.matchupId=null;ui.roundNumber=null;ui.squadra.data=null;ui.lega.data=null;ui.home=null;render();
    try{if(api.bootstrap){bootstrap=await api.bootstrap(league()?.id);await load();}else await load();}catch(err){ui.error=err.message;render();}
  }
  async function openRoster(id){ui.sheet={roster:id};renderSheet();try{const data=await api.team(league()?.id,id);if(ui.sheet?.roster===id){ui.sheet.data=data;if(data.canManageRoster){if(!ui.lega.data)ui.lega.data=await api.league(league()?.id);ui.lega.rosterAudit=await api.rosterAudit(league()?.id);}renderSheet();}}catch(err){if(ui.sheet?.roster===id){ui.sheet.error=err.message;renderSheet();}}}
  async function editLogo(){
    const team=ui.home?homeTeam(ui.home):ui.squadra.data?.team;if(!team?.id)return;const id=league()?.id,{openLogoEditor}=await import('./logo-editor.mjs');if(destroyed||league()?.id!==id)return;
    openLogoEditor({team,onSave:async logo=>{const result=await api.saveLogo(id,logo);if(destroyed||league()?.id!==id)return;const patch=obj=>{if(!obj||typeof obj!=='object')return;if(obj.id===team.id&&obj.name)obj.branding=result.branding;for(const value of Object.values(obj))if(value&&typeof value==='object')patch(value);};[ui.home,ui.lega.data,ui.squadra.data,ui.round,ui.matchup].forEach(patch);if(ui.home?.me)ui.home.me.branding=result.branding;render();toast('Il tuo stemma è pronto.');}});
  }
  on(root,'change',e=>{if(e.target.id==='ranking-metric'){ui.lega.metric=e.target.value;render();}if(e.target.matches('[data-competition-switch]'))void switchCompetition(e.target.value);});

  // Durante la giornata in corso rilegge sfida e risultati ogni minuto (stesso ritmo del canale live del Bar).
  let liveRefreshing=false;
  async function refreshLive() {
    if(suspended)return;
    if(ui.tab==='schedine'){
      if(liveRefreshing||document.hidden||navigator.onLine===false||!slipServices?.refresh)return;
      const data=slips.context(slipContext());if(!data.league)return;
      liveRefreshing=true;const currentLeague=ui.leagueId;
      try{const changed=await slipServices.refresh(data.league.id);if(changed&&ui.tab==='schedine'&&currentLeague===ui.leagueId)render();}catch{}finally{liveRefreshing=false;}return;
    }
    if (liveRefreshing || ui.mode !== 'fanta' || ui.tab !== 'giornata' || ui.round?.round.state !== 'in-corso' || !ui.matchupId || document.hidden || navigator.onLine===false) return;
    if(!demo&&!sportsWindowActive([{matches:ui.round?.round.fixtures||[]}]))return;
    if(!demo){try{const feed=await fetch('/.netlify/functions/public-football',{credentials:'omit'});if(!feed.ok||!(await feed.json()).window?.liveIds?.length)return;}catch{return;}}
    liveRefreshing=true;const mine = request, id = league()?.id;
    api.invalidateReads?.();
    try {
      const [round, matchup] = await Promise.all([api.round(id, ui.roundNumber), api.matchup(id, ui.roundNumber, ui.matchupId)]);
      if (mine !== request) return;
      const unchanged=JSON.stringify([ui.round?.round.state,ui.round?.round.matchesDone,ui.round?.matchups,ui.matchup])===JSON.stringify([round.round.state,round.round.matchesDone,round.matchups,matchup]);
      if(unchanged){ui.round=round;ui.matchup=matchup;return;}
      const benchOpen = root.querySelector('.fanta-bench')?.open;
      ui.round = round; ui.matchup = matchup;
      render();
      const bench = root.querySelector('.fanta-bench');
      if (bench && benchOpen != null) bench.open = benchOpen;
    } catch {} finally{liveRefreshing=false;}
  }

  let homeVoteJob=null;
  function hydrateHomeVotes(){
    const home=ui.home,id=league()?.id;if(!home?.match?.live||homeVoteJob||['home','away'].every(k=>Number.isInteger(home.match.live[k]?.withVote)))return;
    homeVoteJob=(async()=>{let matchup=ui.matchup;
      if(!matchup||ui.roundNumber!==home.round.number){const round=await api.round(id,home.round.number);const pick=round.matchups.find(m=>m.isMine)||round.matchups.find(m=>[m.home?.team?.id,m.away?.team?.id].includes(home.me.teamId));if(!pick)return;matchup=await api.matchup(id,home.round.number,pick.id);}
      if(!destroyed&&ui.home===home&&league()?.id===id){ui.home=withHomeVotes(home,matchup);if(!suspended&&ui.tab==='oggi')render();}
    })().catch(()=>{}).finally(()=>{homeVoteJob=null;});
  }
  async function load() {
    ui.error = null;
    if(bootstrap?.me.access==='pilot'&&!bootstrap.me.pilotTeam){ui.me=bootstrap.me;bootstrap=null;}
    if(bootstrap){const b=bootstrap;bootstrap=null;ui.me=b.me;ui.leagues=b.leagues;ui.leagueId=b.home?.league.id||ui.leagueId;ui.home=b.home;hydrateHomeVotes();ui.round=b.round;ui.roundNumber=b.round?.round.number;ui.matchup=b.matchup;ui.matchupId=b.matchup?.id;ui.side=b.matchup?.away?.team.id===b.home?.me.teamId?'away':'home';ui.lega.data=b.league;ui.squadra.data=b.team;if(b.team)ui.squadra.loadedAt=Date.now();if(b.team)setDraft(draftFrom(b.team.lineup||{formation:b.team.previous?.formation||'4-4-2'},b.team.roster));render();if(ui.tab==='squadra'&&!ui.squadra.data)await loadTeam();if(['lega','classifica'].includes(ui.tab)&&!ui.lega.data)await loadLega();if(ui.tab==='giornata'&&!ui.round)await loadRound(Number(readAppRoute()?.round)||ui.home?.round.number);return;}
    try {
      if (!ui.me) ui.me = await api.me();
      if(ui.me.access==='pilot'&&!ui.me.pilotTeam){ui.pilot=await api.pilotTeams();render();return;}
      if (!ui.leagues.length) ui.leagues = await api.leagues();
      if(!ui.leagues.length){ui.error='La tua lega Fanta si sta preparando. Riprova tra poco.';render();return;}
      const id = league()?.id;
      ui.home = id ? await api.home(id) : null;hydrateHomeVotes();
      if (ui.tab === 'giornata') await loadRound(ui.roundNumber, { keepMatchup: true });
      if (ui.tab === 'squadra') await loadTeam();
      if (['lega','classifica'].includes(ui.tab)) await loadLega();
    } catch (e) {
      ui.error = 'Non riusciamo a leggere i dati del Fanta. Controlla la connessione.';
    }
    render();
  }

  // ----- Lega -----
  async function loadLega() {
    ui.lega.data = null; render();
    try { ui.lega.data = await api.league(league()?.id); }
    catch { ui.error = 'Non riusciamo a leggere la lega.'; }
    render();
  }

  // Comandi dell'asta dalla pagina Lega (solo admin): poi si rileggono lega, home e sala.
  function legaAuction(call) {
    const l = ui.lega;
    call.then(async() => { l.auctionError = null; l.editAuction = false; ui.asta.data = null; api.home(league()?.id).then(h => { ui.home = h; });if(ui.tab==='asta')applyAuction(await api.auction(league()?.id));return loadLega(); })
      .catch(e => { l.auctionError = e.message; render(); });
  }

  function handleLega(d) {
    const l = ui.lega, id = league()?.id;
    if (d.legaSub) {writeAppRoute({mode:'fanta',page:ui.tab,section:d.legaSub,league:league()?.id});l.sub=d.legaSub; l.auctionError = null; render(); return true; }
    if (d.legaRound) { const n = Number(d.legaRound); l.openRound = (l.openRound ?? l.data?.calendar.current) === n ? -1 : n; render(); return true; }
    if (d.legaAuction === 'start') { legaAuction(api.auctionStart(id)); return true; }
    if(d.legaAuction==='now-manual'||d.legaAuction==='now-live'){legaAuction(api.auctionStartNow(id,d.legaAuction==='now-manual'?'manual':'live'));return true;}
    if (d.legaAuction === 'close') { legaAuction(api.auctionClose(id)); return true; }
    if (d.legaAuction === 'edit') { l.editAuction = !l.editAuction; render(); return true; }
    if (d.legaInvite) {
      const url = l.data?.league.inviteUrl;
      if (d.legaInvite === 'share' && navigator.share) navigator.share({ title: l.data.league.name, text: `Entra nella lega ${l.data.league.name} su Quelli del Quasi`, url }).catch(() => {});
      else navigator.clipboard?.writeText(url).then(() => { l.copied = true; render(); setTimeout(() => { l.copied = false; if (ui.tab === 'lega') render(); }, 2000); }).catch(() => {});
      return true;
    }
    return false;
  }

  // Carica una giornata e la sfida scelta (di default quella dell'utente).
  async function loadRound(number, { keepMatchup = false, matchup = null } = {}) {
    const mine = ++request, id = league()?.id;
    const wantedMatchup = matchup || (keepMatchup ? ui.matchupId : null);
    ui.round = null; ui.matchup = null; render();
    try {
      const round = await api.round(id, number ?? ui.home?.round.number);
      if (mine !== request) return;
      ui.round = round; ui.roundNumber = round.round.number;
      const pick = round.matchups.find(m => m.id === wantedMatchup) || round.matchups.find(m => m.isMine) || round.matchups[0];
      await loadMatchup(pick?.id, mine, keepMatchup && !matchup);
    } catch {
      if (mine === request) { ui.error = 'Non riusciamo a leggere la giornata.'; render(); }
    }
  }

  async function loadMatchup(matchupId, mine = ++request, keepSide = false) {
    ui.matchupId = matchupId; ui.matchup = null; render();
    if (!matchupId) return;
    const matchup = await api.matchup(league()?.id, ui.roundNumber, matchupId);
    if (mine !== request) return;
    ui.matchup = matchup;ui.home=withHomeVotes(ui.home,matchup);
    const myTeam = ui.home?.me.teamId;
    if (!keepSide) ui.side = matchup.away.team.id === myTeam ? 'away' : 'home';
    render();
  }

  function setMode(mode,barPage) {
    if (mode === ui.mode) return;
    ui.mode = mode;
    store.set('qdq:mode', mode);
    onModeChange(mode,{...(typeof barPage==='object'?barPage:{page:barPage}),fantaLeague:league()?.id});
    if (mode === 'bar') return;
    render();
    scrollTo(0, 0);
  }

  function openTab(tab, round, matchup,record=true) {
    if(tab==='schedine')slips.enter();
    if (tab === 'formazione') { tab = 'squadra'; ui.squadra.sub = 'formazione'; }
    if(tab==='giornata'&&round==null&&ui.tab!=='giornata')round=ui.home?.round.number;
    if(tab==='classifica'&&!['classifica','calendario','schedine'].includes(ui.lega.sub))ui.lega.sub='classifica';
    if(tab==='lega'&&['classifica','calendario','schedine'].includes(ui.lega.sub))ui.lega.sub='asta';
    if(record)writeAppRoute({mode:'fanta',page:tab,section:['lega','classifica'].includes(tab)?ui.lega.sub:null,league:league()?.id,round:tab==='schedine'?(round||null):tab==='giornata'?(round||ui.roundNumber||ui.home?.round.number):null});
    ui.tab=tab;ui.sheet=null;ui.studio=null;
    if (tab === 'asta') startAuction(); else stopAuction();
    if (tab === 'giornata' && (round != null || !ui.round || !ui.matchup)) { loadRound(round != null ? Number(round) : null, { matchup }); }
    else if (tab === 'squadra' && (!ui.squadra.data||Date.now()-(ui.squadra.loadedAt||0)>60000)) loadTeam({keepView:!!ui.squadra.data});
    else if (['lega','classifica'].includes(tab) && !ui.lega.data) loadLega();
    else render();
    scrollTo(0, 0);
  }

  // Trascinamento nella formazione: stesse regole del tocco, controllate sulla bozza.
  const dragOptions = {
    signal:lifecycle.signal,
    canDrop: (drag, target) => {
      const sq = ui.squadra;
      return !sq.saving && !suspended && !!sq.draft && !sq.data?.round.locked && canDropOn(sq.draft, sq.data.roster, drag, target, sq.data.rules.benchMax);
    },
    onDrop: (drag, target) => {
      const sq = ui.squadra;
      setDraft(dropOn(sq.draft, drag, target, sq.data.rules.benchMax, sq.data.roster));
      if(ui.studio)ui.studio.slot=null;
      render();
    },
  };
  enableDrag(root,dragOptions);
  const studioRoot=document.getElementById('v2-sheet-root');if(studioRoot)enableDrag(studioRoot,dragOptions);

  on(document,'click',e=>{if(e.target.closest('[data-fanta-chat]'))document.dispatchEvent(new CustomEvent('quasi:open-chat',{detail:{league:league()?.id}}));});
  on(window,'offline',()=>{if(ui.tab==='schedine')render();});
  on(window,'online',()=>{if(ui.tab==='schedine')render();});
  on(root,'error',e=>{if(e.target.matches?.('img[data-fanta-photo]'))e.target.hidden=true;},{capture:true});
  on(root,'click', handle);
  on(document,'click',e=>{if(e.target.closest('#app-header'))handle(e);});
  on(document.getElementById('v2-sheet-root'),'click', handle);
  on(window,'keydown',e=>{if(e.key==='Escape'&&ui.studio){ui.studio=null;renderSheet();}});
  on(window,'keydown', e => { if (e.key === 'Escape' && ui.sheet) { ui.sheet = null; renderSheet(); } });

  function handle(e) {
    if(e.target.closest('.fanta-native-slips'))return;
    const el = e.target.closest('[data-demo-scenario],[data-roster-confirm],[data-releases-confirm],[data-release],[data-release-undo],[data-releases-done],[data-pilot-pick],[data-pilot-claim],[data-competition-open],[data-team-roster],[data-mode],[data-tab],[data-go],[data-action],[data-league],[data-round],[data-matchup],[data-side],[data-player],[data-view],'
      + '[data-studio],[data-st-role],[data-st-slot],[data-st-player],[data-st-clear],[data-sq-sub],[data-sq-filter],[data-formation],[data-slot],[data-pick],[data-unpick],[data-bench-add],[data-bench-pick],[data-bench-remove],[data-bench-move],[data-lineup],[data-list-add],'
      + '[data-lega-sub],[data-lega-round],[data-lega-auction],[data-lega-invite],'
      + '[data-asta-mode],[data-asta-cancel],[data-asta-close],[data-m-role],[data-m-table],[data-m-clear],[data-m-team],[data-m-confirm],[data-m-undo],'
      + '[data-bid],[data-asta-pass],[data-asta-listone],[data-asta-role],[data-asta-pick],[data-asta-amount],[data-asta-call]');
    if (!el || el.disabled||el.getAttribute('aria-busy')==='true') return;
    const d = el.dataset;
    if(kind==='public'&&d.demoScenario&&api.setScenario){el.disabled=true;void api.setScenario(d.demoScenario).then(async()=>{ui.sheet=null;ui.home=null;ui.round=null;ui.matchup=null;ui.squadra.data=null;ui.lega.data=null;ui.roundNumber=null;ui.matchupId=null;ui.home=await api.home(league()?.id);await openTab('oggi');}).catch(e=>toast(e.message));return;}
    if(d.pilotPick){ui.sheet={pilotConfirm:d.pilotPick};renderSheet();return;}
    if(d.pilotClaim){el.disabled=true;el.setAttribute('aria-busy','true');const choice=d.pilotClaim==='random'?{random:true}:{teamId:d.pilotClaim};api.pilotClaim(choice).then(async r=>{ui.sheet=null;ui.pilot=null;ui.me={...ui.me,pilotTeam:r.team.id};ui.leagueId=r.league.id;store.set('qdq:fantaLeague',r.league.id);ui.leagues=[];toast('Benvenuto! La tua panchina ti aspetta.');await load();}).catch(async err=>{ui.sheet=null;toast(err.message);try{ui.pilot=await api.pilotTeams();}catch(e){ui.error=e.message;}render();});return;}
    if(d.rosterConfirm&&ui.sheet?.rosterConfirm){const p=ui.sheet.rosterConfirm;el.disabled=true;api.rosterChange(league()?.id,p.kind,{teamId:p.teamId,playerId:p.playerId,...(p.price!==undefined?{price:p.price}:{}),...(p.toTeamId?{toTeamId:p.toTeamId}:{})}).then(async()=>{ui.sheet=null;ui.home=null;ui.lega.freePlayers=null;await loadLega();ui.home=await api.home(league()?.id);await openRoster(p.teamId);render();toast('Rosa corretta.');}).catch(err=>{ui.sheet=null;renderSheet();toast(err.message);});return;}
    if(d.teamRoster){void openRoster(d.teamRoster);return;}
    if(d.competitionOpen){void switchCompetition(d.competitionOpen);return;}
    if(d.action==='edit-logo'){void editLogo();return;}
    if(d.inviteLeague){if(!demo&&league()?.role==='admin'){ui.tab='lega';ui.lega.sub='partecipanti';ui.sheet=null;render();void loadLega();}return;}
    if (handleLega(d)) return;
    if (handleAsta(d)) return;
    if (handleSquadra(d)) return;
    if(d.mode==='bar'&&d.barPage==='schedina')return openTab('schedine',d.barRound);
    if (d.mode) return setMode(d.mode,d.barRound?{page:'schedina',sourceScope:'fantacalcio',league:d.barLeague,round:d.barRound,match:d.barMatch}:d.barPage);
    if (d.tab) {if(d.tab==='schedine'&&ui.tab==='schedine')return;if(d.legaOpen)ui.lega.sub=d.legaOpen;return openTab(d.legaOpen==='classifica'?'classifica':d.tab);}
    if(d.go==='formazione'&&ui.tab==='oggi'){void openHomeLineup();return;}
    if (d.go) return openTab(d.go, d.round, d.mu);
    if (d.round) {writeAppRoute({mode:'fanta',page:'giornata',league:league()?.id,round:d.round}); loadRound(Number(d.round)); return; }
    if (d.matchup) { if (d.matchup !== ui.matchupId) loadMatchup(d.matchup); return; }
    if (d.side) { ui.side = d.side; render(); return; }
    if (d.view) { ui.view = d.view; store.set('qdq:fantaView', d.view); render(); return; }
    if (d.player) { ui.sheet = { player: d.player }; renderSheet(); return; }
    if (d.league) {
      api.setCompetition?.(null);
      writeAppRoute({mode:'fanta',page:'oggi',league:d.league});ui.leagueId = d.league; store.set('qdq:fantaLeague', ui.leagueId);
      ui.sheet = null; ui.home = null; ui.round = null; ui.roundNumber = null; ui.squadra.data = null; ui.asta.data = null; ui.asta.players = null; ui.asta.releasePlayers = null; ui.lega.data = null; ui.tab = ui.tab==='schedine'?'schedine':'oggi'; stopAuction(); render(); load(); return;
    }
    const action = d.action;
    if (action === 'demo-info') { ui.sheet = 'demo'; renderSheet(); return; }
    if (action === 'demo-ok') { store.set('qdq:fantaDemoSeen', '1'); ui.sheet = null; renderSheet(); return; }
    if (action === 'leagues') { ui.sheet = 'leagues'; renderSheet(); }
    else if (action === 'close-sheet') { ui.sheet = null; renderSheet(); }
    else if (action === 'retry') load();
  }

  // Interruttori delle notifiche (pagina Io): si salvano subito.
  on(root,'change', e => {
    const key = e.target.dataset?.notify;
    if (!key || !ui.me) return;
    const previous=ui.me.settings;
    ui.me.settings = { ...previous, notify: { ...previous?.notify, [key]: e.target.checked } };
    api.saveSettings(ui.me.settings).then(() => { ui.io.saved = true; render(); setTimeout(() => { ui.io.saved = false; if (ui.tab === 'io') render(); }, 2000); }).catch(() => {ui.me.settings=previous;render();toast('Preferenza non salvata. Riprova tra poco.');});
  });

  on(window,'popstate',()=>{const r=readAppRoute();if(r?.mode!=='fanta')return;const changedLeague=r.league&&r.league!==league()?.id&&ui.leagues.some(l=>l.id===r.league);if(changedLeague){ui.leagueId=r.league;ui.home=null;ui.squadra.data=null;ui.round=null;ui.lega.data=null;api.setCompetition?.(null);}ui.tab=r.page;if(r.section){if(r.page==='squadra')ui.squadra.sub=r.section;else ui.lega.sub=r.section;}ui.sheet=null;ui.studio=null;if(changedLeague){void load();return;}if(r.page==='giornata')void loadRound(r.round?Number(r.round):ui.home?.round.number);else if(r.page==='squadra'&&!ui.squadra.data)void loadTeam();else if(['lega','classifica'].includes(r.page)&&!ui.lega.data)void loadLega();else render();});
  if(readAppRoute()?.section){if(readAppRoute().page==='squadra')ui.squadra.sub=readAppRoute().section;else ui.lega.sub=readAppRoute().section;}
  render();
  const ready=load();
  // In demo la spiegazione si apre da sola la prima volta.
  if (kind==='public' && store.get('qdq:fantaDemoSeen') !== '1' && ui.mode === 'fanta') { ui.sheet = 'demo'; renderSheet(); }
  timer = setInterval(() => {if(suspended)return;tickCountdowns(root);if(ui.tab==='schedine')slips.tick(slipContext());}, 1000);
  const liveTimer = setInterval(refreshLive, 60000);

  return {
    ready,
    get leagueId(){return league()?.id;},
    setBarLeagues:(next)=>{barLeagues=next;},
    suspend:()=>{suspended=true;stopAuction();ui.sheet=null;ui.studio=null;renderSheet();document.body.classList.remove('fanta-sheet-open','fs-open');const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}},
    resume:(tab,{route}={})=>{suspended=false;ui.mode='fanta';if(route?.section){if(route.page==='squadra')ui.squadra.sub=route.section;else ui.lega.sub=route.section;}openTab(tab||ui.tab,route?.round?Number(route.round):undefined,undefined,!route);},
    reload: () => { api.invalidateReads?.();ui.home = null; ui.sheet = null; ui.squadra.data = null; render(); return load(); },
    refreshLive,
    destroy: () => { destroyed=true;request++;lifecycle.abort();clearInterval(timer);clearInterval(liveTimer);stopAuction();root.innerHTML='';const sheet=document.getElementById('v2-sheet-root');if(sheet)sheet.innerHTML=''; },
  };
}
