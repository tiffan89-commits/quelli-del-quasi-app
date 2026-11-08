import {presidentPanel,settingsFooter} from '../president-panel.mjs';
import {bindSwipeBack} from '../match-page.mjs';
import {patchRegion} from '../live-channel.mjs';
import {placeAppFooter} from '../app-footer.mjs';
import {createSportsPush} from '../sports-push.mjs';
import {paintAuctionBadges} from '../auction-index.mjs';
import {applyLeagueTheme,linkedLeagueIdentity} from '../league-theme.mjs';
import {linkedInvite} from './league-invite.mjs';
import {shareLeagueInvite} from '../league-invite.mjs';
import {watchAuction,auctionClockOffset} from './auction-watch.mjs';
import {createAuctionSocket} from './auction-socket.mjs';
import {withHomeVotes} from './home-votes.mjs';
import {renderStudio,studioTap,studioDraft} from './formazione-studio.mjs';
import {bestLineup,nextEmptySlot} from './squadra.mjs';
import {readAppRoute,writeAppRoute} from '../routes.mjs';
import {createFantaSlips} from './schedine.mjs';
import {sportsWindowActive} from '../sports-window.mjs';
import {retainAppHeader} from '../mode-switch.mjs';
// Controllore del Fanta: tiene modalità, lega e tab correnti, chiede i dati all'api e disegna.
// mountFanta(root, {api}) è l'unica entrata: l'anteprima passa l'api finta, l'app vera quella su /fanta-api.
import { topBar, tabBar, leagueSheet, FANTA_TABS } from './shell.mjs';
import { renderHome,auctionCard,homeTeam,tickCountdowns } from './home.mjs';
import { renderGiornata, renderPlayerSheet, findPlayer } from './giornata.mjs';
import { renderSquadra, renderTeamRoster, renderPickSheet, renderBenchSheet, draftFrom, lineupOf, sameLineup, withFormation, assign, unassign, benchAdd, benchRemove, benchMove, missingOf, canDropOn, dropOn, quickAdd, benchAll, TEAM_CALENDAR_PAGE } from './squadra.mjs';
import {bindLineupPitch,setPitchFlip} from '../lineup-pitch.mjs';
import { enableDrag } from './trascina.mjs';
import { renderAsta, renderListoneSheet, renderListoneRows, renderAssignConfirm, tickAuction, auctionAudio, bidState, bidAmount } from './asta.mjs';
import { auctionWizard, renderAuctionWizard } from './auction-wizard.mjs';
import { renderLega,renderFantaPresident } from './lega.mjs';
import { renderIo, renderDemoInfo } from './io.mjs';
import { renderPilotPicker,renderPilotConfirm,renderPilotInfo } from './pilota.mjs';
import {bindRosterPlayerSearch,renderReleaseConfirm,renderRosterAdmin,renderMarketConfirm,refundFor} from './mercato.mjs';
import { esc } from './formato.mjs';
import {competitionSwitcher} from './competitions-ui.mjs';
import {renderTeamChoices} from './team-choices.mjs';
import {bindAppInvites} from '../app-invite.mjs';
import {findBarSlip} from './bar-slip.mjs';
import {bindStyledSelects,closeStyledSelect} from '../styled-select.mjs';

const store = {
  get(key) { try { return localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { localStorage.setItem(key, value); } catch {} },
};
const auctionTitles={iniziale:'Asta iniziale',riparazione:'Asta di riparazione',lampo:'Asta lampo'};

// demo: true = dati di prova (chi non ha accesso al Fanta vero, o chi prova dalla landing): banner fisso,
// spiegazione al primo ingresso e avvisi quando "salva" qualcosa, perché niente resta salvato davvero.
export function mountFanta(root, { api, bootstrap = null, demo = false, barLeagues = [], slipServices = null, initialTab = 'oggi', onModeChange = () => {} }) {
  const kind=demo===true?'public':demo||null;
  const entryRoute=readAppRoute();
  const lifecycle=new AbortController();let destroyed=false,suspended=false;
  const on=(target,type,fn,options={})=>target?.addEventListener(type,event=>{if(!suspended&&!destroyed)fn(event);},{...options,signal:lifecycle.signal});
  const ui = {
    me: null,
    pilot:null,
    teamChoices:[],choiceLeagueId:null,claimingTeam:null,choiceError:null,
    io: { saved: false },
    mode: store.get('qdq:mode') === 'bar' ? 'bar' : 'fanta',
    tab: readAppRoute()?.mode==='fanta'?readAppRoute().page:initialTab,
    studio:null,
    competitionId:entryRoute?.competition||null,
    leagueId:readAppRoute()?.league||store.get('qdq:fantaLeague'),
    leagues: [],
    home: null,
    error: null,
    sheet: null, // 'leagues' | { player: id } | { pick: slot } | { bench: true }
    // Squadra: dati dal server + bozza della formazione non ancora salvata
    squadra: { data: null, draft: null, sub: 'formazione', dirty: false, saving: false, error: null, moved: null },
    // Asta: stato letto ogni secondo, scarto d'orologio col server, cosa sta scrivendo/scegliendo l'utente
    asta: { data: null, players: null, offset: 0, amount: null, error: null, query: '', role: 'tutti', picking: null, callAmount: null },
    // Lega: sezione aperta, giornata aperta nel calendario, modulo "nuova asta" dell'admin
    lega: { data: null, sub: 'classifica', openRound: null, copied: false },
    // Giornata
    roundNumber: null,
    round: null,
    matchupId: null,
    matchup: null,
    side: 'home',
    liveFlips:new Set(),liveFrom:null,liveError:null,
  };
  let timer=null,request=0,openingHomeLineup=false,lastStudioTap=null,studioDrag;
  const sideBench=window.matchMedia?.('(width < 620px)');

  const slips=createFantaSlips({services:slipServices,redraw:()=>render(),teamResolver:name=>ui.home?.standings?.find(s=>s.team.name===name)?.team,loadMatchup:(context,round,match)=>api.matchup(context.leagueId,round.number,match.nativeId||match.id)});
  const slipContext=()=>({leagueId:league()?.id,competitionId:ui.home?.competition?.id||ui.lega.data?.competition?.id,enabled:league()?.slipsEnabled});
  const league = () => ui.teamChoices.find(l=>l.id===ui.choiceLeagueId)||ui.leagues.find(l => l.id === ui.leagueId) || ui.leagues[0];
  const auctionSound=auctionAudio(window);
  let configuringAuction=false,auctionAudioChosen=false;
  let pendingAuctionNavigation=null,replayingAuctionNavigation=false;

  function page() {
    if (ui.error) return `<div class="fanta-empty"><h2>Qualcosa non va</h2><p>${esc(ui.error)}</p><button type="button" class="secondary" data-action="retry">Riprova</button></div>`;
    if (ui.mode === 'bar') return `<div class="fanta-empty"><span class="eyebrow">Modalità Bar</span><h2>Qui c'è il Bar che conosci</h2>
      <p>Schedine, Quasi e premi. Nell'app vera questo interruttore apre la parte Bar, con la stessa lega e gli stessi amici.</p>
      <button type="button" class="primary" data-mode="fanta">Torna al Fanta</button></div>`;
    if(ui.tab==='impostazioni')return presidentPanel({mode:'fanta',open:ui.presidentGroup,footer:settingsFooter({bridge:true}),groups:slipServices?.account?.groups?.(ui.me?.settings)});
    if(ui.pilot)return renderPilotPicker(ui.pilot);
    if(ui.choiceLeagueId||!ui.leagues.length&&ui.teamChoices.length)return renderTeamChoices(ui.choiceLeagueId?ui.teamChoices.filter(l=>l.id===ui.choiceLeagueId):ui.teamChoices,{busy:ui.claimingTeam,error:ui.choiceError});
    if(ui.me?.access==='full'&&!ui.leagues.length)return '<div class="fanta-empty"><h2>Il Fanta non è ancora attivo</h2>'+ (barLeagues.some(b=>b.admin===ui.me?.id)?'<p>Prepara le squadre dal pannello del presidente.</p><button class="primary" data-mode="bar" data-bar-page="admin">Attiva il Fanta di questa lega</button>':'<p>Il presidente non ha ancora attivato il Fanta.</p>')+'<button class="secondary" data-mode="bar">Torna al Bar</button></div>';
    if(ui.tab==='schedine')return ui.home?slips.render(slipContext()):'<div class="fanta-loading" role="status">Carichiamo la competizione…</div>';
    if(ui.tab==='presidente')return renderFantaPresident(ui.lega.data,{...ui.lega,presidentGroup:ui.presidentGroup,me:ui.me,io:ui.io,demo,bar:barLeagues.find(b=>b.nativeFantaLink?.leagueId===league()?.id),invite:linkedInvite(ui.lega.data?.league,barLeagues)});
    if (ui.tab === 'oggi') return ui.home ? renderHome({...ui.home,invite:linkedInvite(ui.home.league,barLeagues),inviteCopied:ui.lega.copied,openingLineup:openingHomeLineup,bar:findBarSlip(ui.home,barLeagues)}) : '<div class="fanta-loading" role="status">Carichiamo la tua squadra…</div>';
    if (ui.tab === 'giornata') return renderGiornata({round:ui.round,matchup:ui.matchup,matchupId:ui.matchupId,side:ui.side,flips:ui.liveFlips,error:ui.liveError});
    if (ui.tab === 'squadra') return renderSquadra(ui.squadra);
    if (ui.tab === 'asta') return ui.asta.wizard?renderAuctionWizard(ui.asta.wizard):renderAsta(ui.asta.data,{...ui.asta,members:barLeagues.find(b=>b.nativeFantaLink?.leagueId===league()?.id)?.members},ui.asta.players);
    if (ui.tab === 'lega'||ui.tab==='classifica') return renderLega(ui.lega.data,{...ui.lega,invite:linkedInvite(ui.lega.data?.league,barLeagues),group:ui.tab,hasChat:barLeagues.some(b=>b.nativeFantaLink?.leagueId===league()?.id),slipsHtml:slips.ranking(slipContext(),ui.lega.metric||'points')});
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
    if(ui.sheet?.player){
      const player=findPlayer(ui.matchup,ui.sheet.player,ui.sheet.side);
      return player?`<dialog class="v2-sheet fanta-sheet live-player-sheet" aria-labelledby="fanta-sheet-title"><div class="v2-sheet-handle" aria-hidden="true"></div>${renderPlayerSheet(player,{official:ui.matchup.official})}</dialog>`:'';
    }
    if (ui.sheet === 'leagues') return leagueSheet(ui.leagues.map(l=>linkedLeagueIdentity(l,barLeagues)), league()?.id);
    if (ui.sheet === 'demo') return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div>
      <div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title"><div class="v2-sheet-handle"></div>${kind==='pilot'||league()?.kind==='pilot'?renderPilotInfo():renderDemoInfo()}</div>`;
    if(ui.sheet?.rosterConfirm||ui.sheet?.startBidding){const r=ui.sheet.rosterConfirm;return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div><div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">${renderMarketConfirm(r?'Confermi la correzione?':'Iniziamo gli acquisti?',r?[(r.playerName||r.playerId),r.teamName,r.price!==undefined?r.price+' crediti':'',r.toName?'Verso '+r.toName:'','Le formazioni già giocate restano invariate.'].filter(Boolean).join(' · '):'La fase svincoli verrà chiusa. Dopo non sarà più possibile annullare uno svincolo.',r?'data-roster-confirm':'data-releases-confirm')}</div>`;}
    if(ui.sheet?.auctionExit||ui.sheet?.auctionClose){
      const exit=ui.sheet.auctionExit;
      return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div><div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">${renderMarketConfirm(exit?'Vuoi uscire dalla sala?':'Chiudi l’asta per tutti?',exit?'L’asta continua. Puoi rientrare da Oggi.':'La sala verrà chiusa per tutti i partecipanti.',exit?'data-auction-exit-confirm':'data-auction-close-confirm')}</div>`;
    }
    if(ui.sheet?.release)return `<div class="v2-sheet-backdrop" data-action="close-sheet"></div><div class="v2-sheet fanta-sheet" role="dialog" aria-modal="true" aria-labelledby="fanta-sheet-title">${renderReleaseConfirm(ui.asta.data)}</div>`;
    if(ui.sheet?.pilotConfirm)return renderPilotConfirm(ui.pilot,ui.sheet.pilotConfirm);
    if (ui.sheet?.mconfirm) return ui.asta.data ? renderAssignConfirm(ui.asta.data, ui.sheet.mconfirm, Number(ui.asta.mprice)) : '';
    let body = '';
    if (ui.sheet?.asta) body = ui.asta.players && ui.asta.data ? renderListoneSheet(ui.asta.players, ui.asta.data, ui.asta) : `<div class="fanta-ps-head"><h2 id="fanta-sheet-title">Listone</h2><button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button></div>${ui.sheet.error?`<p role="alert">${esc(ui.sheet.error)}</p><button type="button" class="secondary" data-asta-listone="1">Riprova</button>`:'<div class="fanta-loading" role="status">Carichiamo il listone…</div>'}`;
    else if(ui.sheet?.roster)body=ui.sheet.data?renderTeamRoster(ui.sheet.data,ui.sheet.data.canManageRoster?renderRosterAdmin(ui.sheet.data,ui.lega.data,ui.lega):''):`<button type="button" class="fanta-close" data-action="close-sheet" aria-label="Chiudi">×</button><p role="status">${esc(ui.sheet.error||'Carichiamo la rosa…')}</p>`;
    else if (ui.sheet?.pick && ui.squadra.draft) body = renderPickSheet(ui.squadra, ui.sheet.pick,!!ui.sheet.guided);
    else if (ui.sheet?.bench && ui.squadra.draft) body = renderBenchSheet(ui.squadra);
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
      if(previous?.team.id!==data.team.id||previous?.round.number!==data.round.number)sq.benchFlipped=false;
      sq.data = data;sq.loadedAt=Date.now();
      if(!keepDraft)setDraft(draftFrom(data.lineup || { formation: data.previous?.formation || '4-4-2' }, data.roster), { keepMoved: false });
    } catch {
      if(keepView&&sq.data)sq.error='Aggiornamento non disponibile. La tua bozza è conservata.';else ui.error = 'Non riusciamo a leggere la tua squadra.';
    }
    render();
  }

  function setDraft(draft, { keepMoved = false } = {}) {
    const sq = ui.squadra;
    if(ui.studio)draft=studioDraft(draft,sq.data.roster);
    const addedBench=ui.studio&&sq.draft?draft.bench.filter(id=>!sq.draft.bench.includes(id)):[];
    sq.benchReveal=addedBench.length===1?addedBench[0]:null;
    sq.draft = draft;
    sq.dirty = sq.data.lineup ? !sameLineup(draft, sq.data.lineup) : lineupOf(draft).starters.length + draft.bench.length > 0;
    sq.error = null;
    if (!keepMoved) { sq.moved = null; sq.promoted = null; }
  }

  async function openHomeLineup(expectedRound){
    if(openingHomeLineup||ui.squadra.saving)return;
    const id=league()?.id;openingHomeLineup=true;render();
    try{
      let data=await api.team(id);
      if((expectedRound&&data.round.number!==expectedRound)||(ui.home?.nextLineup&&data.round.number!==ui.home.nextLineup.round)||data.round.locked&&(ui.home?.nextLineup||['da-schierare','schierata'].includes(ui.home?.round?.state))){api.invalidateReads?.();data=await api.team(id);}
      if(destroyed||suspended||league()?.id!==id)return;
      if(expectedRound&&data.round.number!==expectedRound)throw Error('La formazione di questa giornata non è più modificabile.');
      if(data.round.locked)throw Error('La formazione non è ancora aperta per la prossima giornata.');
      const keepDraft=ui.squadra.dirty&&ui.squadra.data?.team.id===data.team.id&&ui.squadra.data?.round.number===data.round.number;
      ui.squadra.data=data;ui.squadra.loadedAt=Date.now();
      if(!keepDraft)setDraft(draftFrom(data.lineup||{formation:data.previous?.formation||'4-4-2'},data.roster),{keepMoved:false});
      ui.sheet=null;ui.studio={role:'tutti',slot:null};setDraft(ui.squadra.draft);
    }catch(error){if(!destroyed&&!suspended)toast(error.message);}
    finally{openingHomeLineup=false;if(!destroyed&&!suspended)render();}
  }

  function closeLineupStudio(){
    ui.studio=null;
    if(readAppRoute()?.section==='studio')writeAppRoute({mode:'fanta',page:'squadra',section:'formazione',league:league()?.id,competition:ui.competitionId},{replace:true});
  }
  async function saveLineup() {
    const sq = ui.squadra;
    if (sq.data?.round.locked || sq.saving || missingOf(sq.draft) || !sq.dirty) return;
    const id=league()?.id,round=sq.data.round.number,submitted=lineupOf(sq.draft);sq.saving=true;
    for(const button of new Set([...root.querySelectorAll('[data-lineup="save"]'),...document.querySelectorAll('.fs [data-lineup="save"]')])){button.disabled=true;button.setAttribute('aria-busy','true');button.classList.add('is-busy');button.textContent='Salvataggio…';}
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

  const teamSections=['formazione','rosa','calendario'];
  function switchTeamSection(section){
    const sq=ui.squadra,step=teamSections.indexOf(section)-teamSections.indexOf(sq.sub);
    if(!step||!teamSections.includes(section))return;
    sq.sub=section;
    sq.calendarRange=undefined;
    writeAppRoute({mode:'fanta',page:'squadra',section,league:league()?.id});
    const squadra=root.querySelector('.fanta-squadra'),track=squadra?.querySelector('[data-os-content]');
    if(!track){render();return;}
    const template=document.createElement('template');
    template.innerHTML=renderSquadra(sq);
    const next=template.content.querySelector('[data-os-content]');
    track.replaceWith(next);
    squadra.querySelectorAll('[data-sq-sub]').forEach(button=>{
      const active=button.dataset.sqSub===section;
      button.classList.toggle('is-active',active);
      button.setAttribute('aria-selected',String(active));
    });
    bindStyledSelects(next);
    if(!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
      next.animate?.([{transform:`translateX(${Math.sign(step)*24}px)`,opacity:.7},{transform:'none',opacity:1}],{duration:170,easing:'ease-out'});
    }
  }
  function handleSquadra(d, event) {
    const sq = ui.squadra, data = sq.data;
    if (!data) return false;
    if (d.pitchFlip) {sq.benchFlipped=!sq.benchFlipped;setPitchFlip(event.target.closest('[data-pitch-flip]'),sq.benchFlipped);return true;}
    if(d.sqSub){switchTeamSection(d.sqSub);return true;}
    if ('sqCalendarMore' in d || 'sqCalendarPrevious' in d) {
      const visible=new Set([...root.querySelectorAll('.fanta-team-calendar [data-go="giornata"]')].map(row=>row.dataset.mu));
      const direction='sqCalendarPrevious' in d?'earlier':'later';
      const range=sq.calendarRange??{};
      sq.calendarRange={...range,[direction]:(range[direction]||0)+TEAM_CALENDAR_PAGE};
      render();
      requestAnimationFrame(()=>{
        const first=[...root.querySelectorAll('.fanta-team-calendar [data-go="giornata"]')].find(row=>!visible.has(row.dataset.mu));
        first?.focus({preventScroll:true});first?.scrollIntoView?.({block:'nearest',inline:'nearest'});
      });
      return true;
    }
    if (d.sqFilter) { sq.filter = d.sqFilter; render(); return true; }
    if(d.studio==='open'){if(!data.round.locked&&!sq.saving&&!sq.openingStudio){sq.openingStudio=true;void(async()=>{try{if(Date.now()-(sq.loadedAt||0)>60000)await loadTeam({keepView:true});if(!destroyed&&!suspended&&!sq.data?.round.locked){ui.studio={role:'tutti',slot:null};setDraft(sq.draft);}}finally{sq.openingStudio=false;if(!destroyed&&!suspended)render();}})();}return true;}
    if(d.studio==='close'){closeLineupStudio();render();return true;}
    if(!ui.studio)return false;
    if(d.stBenchPanel){
      ui.studio.benchOpen=d.stBenchPanel==='open';
      if(!ui.studio.benchOpen)ui.studio.slot=null;
      renderSheet();
      document.querySelector('.fs [data-st-bench-panel="'+(ui.studio.benchOpen?'close':'open')+'"]')?.focus({preventScroll:true});
      return true;
    }
    if(sq.saving)return !!(d.lineup||d.pick||d.pickRole||d.benchPick||d.formation||d.stPlayer||d.stSlot||d.stRole||d.stClear||d.benchMove||d.benchRemove);
    if(data.round.locked)return false;
    if(d.stBench){
      const player=data.roster.find(p=>p.id===d.stBench),slot=ui.studio?.slot;
      if(player&&slot&&slot[0]===player.role){setDraft(assign(sq.draft,slot,player.id));ui.studio.slot=null;}
      else ui.studio={...ui.studio,role:'panchina',slot:null,benchFocus:d.stBench};
      render();return true;
    }
    if(d.stRole){ui.studio={...ui.studio,role:d.stRole,slot:null};render();return true;}
    if(d.stSlot){
      const player=sq.draft.slots[d.stSlot];
      const tap=player&&d.dragId===player&&(event.detail>0||event.pointerType==='touch');
      const previous=lastStudioTap;
      lastStudioTap=tap?{slot:d.stSlot,player,time:event.timeStamp}:null;
      // The first tap redraws the button, so a native dblclick may never fire.
      if(tap&&previous?.slot===d.stSlot&&previous.player===player&&event.timeStamp-previous.time<=350){
        lastStudioTap=null;
        if(sideBench?.matches)ui.studio.benchOpen=false;
        return handleSquadra({stClear:d.stSlot},event);
      }
      const slot=ui.studio.slot===d.stSlot?null:d.stSlot;
      ui.studio={...ui.studio,slot,role:slot?slot[0]:ui.studio.role||'tutti'};
      if(sideBench?.matches)ui.studio.benchOpen=!!slot;
      render();return true;
    }
    if(d.stPlayer){const wasIncomplete=missingOf(sq.draft)>0;setDraft(studioTap(sq.draft,data.roster,d.stPlayer,ui.studio?.slot,data.rules.benchMax));ui.studio.slot=null;if(sideBench?.matches&&Object.values(sq.draft.slots).includes(d.stPlayer))ui.studio.benchOpen=false;if(wasIncomplete&&!missingOf(sq.draft))ui.studio.role='tutti';render();return true;}
    if(d.stClear){setDraft(unassign(sq.draft,d.stClear));ui.studio.slot=null;render();return true;}
    if(d.lineup==='restore'){if(data.lineup){setDraft(draftFrom(data.lineup,data.roster));ui.sheet=null;if(ui.studio){ui.studio.slot=null;ui.studio.role='tutti';}render();}return true;}
    if(d.lineup==='best'){setDraft(bestLineup(sq.draft,data.roster,data.rules.benchMax));ui.studio={...ui.studio,role:'tutti',slot:null};render();return true;}
    if(d.lineup==='guided'){const next=nextEmptySlot(sq.draft);ui.sheet=next?{pick:next,guided:true}:{bench:true};renderSheet();return true;}
    if (d.formation) {
      const { draft, moved, promoted } = withFormation(sq.draft, d.formation, data.roster, data.rules.benchMax);
      setDraft(draft); sq.moved = moved.length ? moved : null; sq.promoted = promoted.length ? promoted : null; render(); return true;
    }
    if (d.slot) { if (!data.round.locked) { ui.sheet = { pick: d.slot }; renderSheet(); } return true; }
    if(d.pickRole){const slots=Object.keys(sq.draft.slots).filter(s=>s[0]===d.pickRole),slot=slots.find(s=>!sq.draft.slots[s])||slots[0];if(slot)ui.sheet={pick:slot,guided:true};renderSheet();return true;}
    if (d.pick) {const guided=ui.sheet?.guided,slot=ui.sheet.pick;setDraft(assign(sq.draft,slot,d.pick));const next=Object.keys(sq.draft.slots).find(s=>s[0]===slot[0]&&!sq.draft.slots[s]);ui.sheet=guided?{pick:next||slot,guided:true}:null;render();return true;}
    if (d.unpick) { setDraft(unassign(sq.draft, ui.sheet.pick)); ui.sheet = null; render(); return true; }
    if (d.listAdd) {
      const next = quickAdd(sq.draft, data.roster, d.listAdd, data.rules.benchMax);
      if (next) { setDraft(next); render(); }
      return true;
    }
    if (d.benchAdd) { ui.sheet = { bench: true }; renderSheet(); return true; }
    if (d.benchPick) {if(!sq.draft.bench.includes(d.benchPick)&&!Object.values(sq.draft.slots).includes(d.benchPick)){setDraft(benchAdd(sq.draft,d.benchPick));}ui.sheet={bench:true};render();return true;}
    if (d.benchRemove) { setDraft(benchRemove(sq.draft, d.benchRemove)); render(); return true; }
    if (d.benchMove) {
      if(!sideBench?.matches&&missingOf(sq.draft))return true;
      const next=benchMove(sq.draft,d.benchMove,Number(d.step));
      if(next===sq.draft)return true;
      setDraft(next);ui.studio.benchFocus=d.benchMove;ui.studio.benchStep=d.step;ui.studio.benchGrip=!!d.benchGrip;
      render();return true;
    }
    if (d.lineup === 'save') { saveLineup(); return true; }
    if (d.lineup === 'repeat' && data.previous) { setDraft(draftFrom(data.previous, data.roster)); render(); return true; }
    if (d.lineup === 'bench-all') { setDraft(benchAll(sq.draft, data.roster,data.rules.benchMax)); render(); return true; }
    if(d.lineup==='clear-bench'){setDraft({...sq.draft,bench:[]});if(ui.studio)ui.studio.slot=null;render();return true;}
    if (d.lineup === 'clear') { setDraft(draftFrom({ formation: sq.draft.formation }, data.roster)); if(ui.studio){ui.studio.slot=null;ui.studio.role='tutti';}render(); return true; }
    return false;
  }

  const TAB_OF = { formazione: 'squadra', asta: 'lega',giornata:'oggi' };

  function bindLiveStudio(railLeft=null) {
    const studio=root.querySelector('.fanta-live-studio'),slides=studio?.querySelector('.pitch-slides');
    if(!studio||slides&&studio._liveSlides===slides)return;
    const rail=studio.querySelector('.fanta-mu-rail'),active=rail?.querySelector('.fanta-mu.is-active');
    if(railLeft!==null&&rail)rail.scrollLeft=railLeft;
    if(active&&rail.getBoundingClientRect){
      const visible=rail.getBoundingClientRect(),tile=active.getBoundingClientRect();
      if(tile.left<visible.left)rail.scrollLeft+=tile.left-visible.left;
      else if(tile.right>visible.right)rail.scrollLeft+=tile.right-visible.right;
    }
    if(!slides)return;
    studio._liveSlides=slides;
    studio._pitchPage=ui.side==='away'?1:0;
    studio._pitchFlips=ui.liveFlips;
    bindLineupPitch(studio,{autoHeight:false,onPage:(_,index)=>{ui.side=index===1?'away':'home';}});
  }

  function render() {
    if(destroyed)return;
    if(ui.tab==='io'){ui.tab='impostazioni';ui.presidentGroup='account';}
    const settingsOpen=['presidente','impostazioni'].includes(ui.tab)?[...root.querySelectorAll('.president-panel details')].map(d=>[d.dataset.presidentSection||d.querySelector('summary')?.textContent,d.open]):[];
    document.body.dataset.gameMode='fanta';
    document.body.classList.toggle('fanta-auction-page',ui.tab==='asta');
    applyLeagueTheme(linkedLeagueIdentity(league(),barLeagues));
    closeStyledSelect();
    const active = document.activeElement, focusId = root.contains(active) && active.id, sel = focusId && active.selectionStart;
    const paneScroll=[...root.querySelectorAll('.auction-pane')].map(el=>el.scrollTop);
    const wizardScroll=root.querySelector('.auction-wizard-fields')?.scrollTop;
    const oldStudio=root.querySelector('.fanta-live-studio'),railLeft=oldStudio?.querySelector('.fanta-mu-rail')?.scrollLeft??null;
    oldStudio?._pitchCleanup?.();
    const mainHtml=`<main class="fanta-main">${['asta','giornata','impostazioni','presidente'].includes(ui.tab)?'':competitionSwitcher(ui.home?.competitions||ui.lega.data?.competitions,ui.home?.competition?.id||ui.lega.data?.competition?.id)}${page()}</main>`;
    const offer=ui.tab==='asta'&&!ui.asta.wizard&&root.querySelector('[data-bid-form]');
    const lot=ui.asta.data?.lot;
    if(offer&&lot?.id===offer.dataset.lot&&bidState(ui.asta.data).can){
      // Keep the native slider alive while a pass or a counteroffer arrives.
      patchRegion(root.querySelector('main.fanta-main'),mainHtml);
      const input=root.querySelector('[data-auction-bid-range]'),st=bidState(ui.asta.data);
      input.setAttribute('min',String(st.min));input.setAttribute('max',String(st.max));input.disabled=!!ui.asta.bidPending||st.min===st.max;
      syncOffer(input,ui.asta.amount);
    }else root.innerHTML = `${topBar({user:ui.me,slipCredits:(()=>{const d=slips.context(slipContext());return d.league?.members?.find(m=>m.uid===d.uid)?.fantasyWallets?.[d.league.fantasyWalletScopes?.[d.round?.competitionKey]]?.credits??d.league?.members?.find(m=>m.uid===d.uid)?.fantasyWallet?.credits;})(),hideCredits:false,mode:ui.mode, league: ui.mode === 'fanta' ? linkedLeagueIdentity(league(),barLeagues) : null, credits:ui.asta.data?.teams?.find(t=>t.team.id===ui.home?.me.teamId)?.credits??ui.home?.auction?.credits })}${demoBar()}
      ${mainHtml}
      ${ui.mode === 'fanta'&&!ui.choiceLeagueId&&ui.leagues.length ? tabBar(FANTA_TABS.some(([id]) => id === ui.tab) ? ui.tab : (ui.tab==='impostazioni'?null:ui.tab==='presidente'?'lega':TAB_OF[ui.tab] || 'oggi')) : ''}`;
    if(['presidente','impostazioni'].includes(ui.tab)){
      for(const d of root.querySelectorAll('.president-panel details')){
        if(ui.presidentGroup&&d.dataset.presidentSection===ui.presidentGroup)continue;
        const saved=settingsOpen.find(([key])=>key===(d.dataset.presidentSection||d.querySelector('summary')?.textContent));
        if(saved)d.open=saved[1];
      }
      if(root.querySelector('.president-panel'))ui.presidentGroup=null;
    }
    retainAppHeader(root);
    paintAuctionBadges();
    placeAppFooter(root);
    const squadra=root.querySelector('.fanta-squadra');
    if(squadra){
      const move=step=>{const next=teamSections[teamSections.indexOf(ui.squadra.sub)+step];if(next)switchTeamSection(next);};
      bindSwipeBack(squadra,()=>move(1),'left');
      bindSwipeBack(squadra,()=>move(-1));
    }
    const leaguePanel=root.querySelector('.president-panel:has(.league-settings-back)');
    if(leaguePanel)bindSwipeBack(leaguePanel,()=>openTab('lega'),'right',()=>!leaguePanel.querySelector('.os-drill'));
    const wizard=root.querySelector('.auction-wizard');
    if(wizard)bindSwipeBack(wizard,()=>openTab(ui.asta.from||'lega'),'right',event=>!ui.asta.wizard?.busy&&!event.target.closest('input,select,textarea,button'));
    if(ui.tab==='asta'){
      showAuctionPanel(ui.asta.panel||0);
      root.querySelectorAll('.auction-pane').forEach((el,i)=>{el.scrollTop=paneScroll[i]||0;});
      const fields=root.querySelector('.auction-wizard-fields');if(fields&&wizardScroll&&ui.asta.keepWizardScroll)fields.scrollTop=wizardScroll;
      ui.asta.keepWizardScroll=true;
    }
    document.dispatchEvent(new window.CustomEvent('quasi:chat-context',{detail:{league:league()?.id}}));
    if(ui.tab==='schedine')slips.bind(root,slipContext());
    if(ui.tab==='giornata')bindLiveStudio(railLeft);
    if (focusId) {
      const el = document.getElementById(focusId);
      // Cursore dove l'utente stava scrivendo (in fondo se il campo non lo dice), così si scrive da sinistra a destra.
      if (el && !el.disabled) { el.focus(); try { const at = sel ?? el.value.length; el.setSelectionRange(at, at); } catch {} }
    }
    // Asta dal vivo: il cursore va da solo dove serve (prezzo dopo aver messo il giocatore sul tavolo, ricerca dopo l'assegnazione).
    if (ui.asta.focus) { document.getElementById(ui.asta.focus)?.focus(); ui.asta.focus = null; }
    bindAppInvites(root);
    if(ui.tab==='impostazioni')slipServices?.account?.bind?.(()=>render(),barLeagues.find(b=>b.nativeFantaLink?.leagueId===league()?.id));
    renderSheet();
    bindStyledSelects(root);
    if (ui.tab === 'asta') {tickAuction(root, ui.asta.offset,auctionSound.alert);showAuctionConnection();}
  }

  function showAuctionPanel(index,{scroll=true}={}){
    const panels=root.querySelector('[data-auction-panels]');if(!panels||!Number.isInteger(index)||index<0||index>2)return;
    ui.asta.panel=index;
    if(scroll)panels.scrollLeft=panels.clientWidth*index;
    root.querySelectorAll('[data-auction-panel]').forEach(button=>{const active=Number(button.dataset.auctionPanel)===index;button.classList.toggle('is-active',active);button.setAttribute('aria-pressed',String(active));});
    panels.querySelectorAll('.auction-pane').forEach((pane,i)=>{pane.inert=i!==index;});
  }
  on(root,'scroll',e=>{const el=e.target;if(el.matches?.('[data-auction-panels]')&&el.clientWidth)showAuctionPanel(Math.round(el.scrollLeft/el.clientWidth),{scroll:false});},{capture:true});

  // In sala Socket.IO consegna gli aggiornamenti. La lettura HTTP recupera una connessione interrotta.
  let astaTimer = null, astaTicker = null, auctionPolling=false,auctionStream=null;
  function startAuction() {
    stopAuction();
    void auctionStream?.check();
    if(auctionStream?.ready(league()?.id)){const latest=auctionStream.last();ui.asta.data=null;applyAuction(latest,{clockOffset:auctionStream.offset()});}else pollAuction();
    astaTimer = setInterval(pollAuction, 1000);
    astaTicker = setInterval(() => tickAuction(document, ui.asta.offset,auctionSound.alert), 200);
  }
  function stopAuction() { clearInterval(astaTimer); clearInterval(astaTicker); astaTimer = astaTicker = null; }

  function showAuctionConnection(){
    const note=root.querySelector('[data-auction-connection]');if(!note)return;
    note.textContent=ui.asta.syncError?'Connessione in ritardo…':auctionStream?.ready(league()?.id)?'● Sincronizzata':ui.asta.lastSync?'● Collegata':'Collegamento…';note.classList.toggle('is-alert',!!ui.asta.syncError);
    if(note.classList.contains('auction-compact-connection'))note.hidden=!ui.asta.syncError;
  }
  function applyAuction(a,{requestStartedAt,clockOffset}={}) {
    const s = ui.asta;
    observeCompetitionActivation(a);
    if(s.data&&a.version<s.data.version)return; // An older poll must not undo a completed command.
    const changedVersion = !s.data || s.data.version !== a.version;
    s.offset = Number.isFinite(clockOffset)?clockOffset:auctionClockOffset(a.serverTime,requestStartedAt);
    if (!changedVersion) return;
    if(s.data&&a.lot?.leader&&(a.lot.id!==s.data.lot?.id||a.lot.bid!==s.data.lot?.bid||a.lot.leader!==s.data.lot?.leader)){
      const sameLot=s.data.lot?.id===a.lot.id,now=Date.now();
      s.outbid=sameLot&&a.lot.leader!==a.me&&(s.data.lot.leader===a.me||s.outbid&&s.offerUntil>now);
      s.offerUntil=now+(s.outbid?1900:900);
      if(ui.tab==='asta')auctionSound.offer();
    }
    if (s.data?.lot?.id !== a.lot?.id) { s.amount = null; s.error = null; } // nuovo giocatore in tavola
    if (s.data?.table?.id !== a.table?.id) { s.mprice = ''; s.error = null; } // dal vivo: nuovo giocatore sul tavolo
    const reloadListone = a.status==='running'&&a.phase!=='releases' && a.mode === 'manual' && a.isAdmin && (!s.players || s.data?.phase!==a.phase || s.data?.log?.[0]?.id !== a.log[0]?.id || s.data?.log?.length !== a.log.length);
    if(a.status==='running'&&a.phase==='releases'&&a.isAdmin&&(!s.releasePlayers||JSON.stringify(a.releases||[])!==JSON.stringify(s.data?.releases||[]))){const id=league()?.id,batch=a.releaseBatchId,releases=JSON.stringify(a.releases||[]);api.auctionAssigned(id).then(players=>{if(destroyed||league()?.id!==id||s.data?.status!=='running'||s.data?.phase!=='releases'||s.data?.releaseBatchId!==batch||JSON.stringify(s.data?.releases||[])!==releases)return;s.releasePlayers=players;if(ui.tab==='asta')render();}).catch(()=>{});}
    if(ui.sheet?.release&&(a.status!=='running'||a.phase!=='releases'||ui.sheet.release!==a.table?.id)){ui.sheet=null;toast('Il giocatore sul tavolo è cambiato.');}
    if(ui.sheet?.startBidding&&(a.status!=='running'||a.phase!=='releases'))ui.sheet=null;
    s.data = a;ui.lega.data=null;api.invalidateReads?.();
    if(ui.home?.auction){Object.assign(ui.home.auction,{status:a.status,mode:a.mode,startsAt:a.startsAt,title:auctionTitles[a.type]});const budget=a.teams.find(t=>t.team.id===a.me);if(budget)Object.assign(ui.home.auction,{credits:budget.credits,slotsLeft:budget.slotsLeft});}
    if(reloadListone){const id=league()?.id;api.auctionPlayers(id).then(list=>{if(destroyed||league()?.id!==id||s.data?.status!=='running'||s.data?.phase==='releases')return;s.players=list;if(ui.tab==='asta')render();}).catch(()=>{});}
    // Se non tocca più a me chiamare, il listone si chiude da solo.
    if (ui.sheet?.asta && (a.caller !== a.me || a.lot)) { ui.sheet = null; s.picking = null; s.callAmount = null; }
    if (ui.tab === 'asta'&&!s.wizard) render();
  }

  function observeCompetitionActivation(a){
    const comp=a.competition?.status==='active'?a.competition:a.competitionActivation?.status==='active'?a.competitionActivation:null;
    if(!comp||ui.home?.competition?.id!==comp.id||ui.home.competition.status==='active'||ui.activationRefresh===comp.id)return;
    const id=league()?.id;ui.activationRefresh=comp.id;api.invalidateReads?.();
    void api.home(id).then(h=>{if(destroyed||suspended||league()?.id!==id)return;ui.home=h;ui.lega.data=null;if(!ui.squadra.dirty)ui.squadra.data=null;hydrateHomeVotes();if(['oggi','asta'].includes(ui.tab))render();}).catch(()=>{}).finally(()=>{ui.activationRefresh=null;});
  }
  async function pollAuction() {
    if (destroyed||suspended||auctionStream?.ready(league()?.id)||auctionPolling || ui.tab !== 'asta' || ui.mode !== 'fanta' || (document.hidden||navigator.onLine===false)) return;
    auctionPolling=true;const id=league()?.id,startedAt=Date.now();
    try { const data=await api.auction(id);if(!destroyed&&!suspended&&ui.tab==='asta'&&league()?.id===id){ui.asta.lastSync=Date.now();ui.asta.syncError=false;applyAuction(data,{requestStartedAt:startedAt});showAuctionConnection();} } catch {if(!destroyed&&!suspended&&ui.tab==='asta'&&league()?.id===id){ui.asta.syncError=true;showAuctionConnection();}} finally{auctionPolling=false;}
  }

  function syncOffer(input,value){
    const min=Number(input.getAttribute('min')),max=Number(input.getAttribute('max')),amount=bidAmount(value,min,max),form=input.closest('form');
    ui.asta.amount=amount;
    input.value=String(amount);input.style.setProperty('--offer-fill',100*(amount-min)/Math.max(1,max-min)+'%');
    input.setAttribute('aria-valuetext',amount+' crediti');
    form.querySelector('output').textContent=amount+' cr';
    form.querySelector('[data-auction-bid-delta]').textContent='(+'+(amount-Number(form.dataset.best))+')';
    form.querySelector('[data-bid-step="-1"]').disabled=!!ui.asta.bidPending||amount<=min;
    form.querySelector('[data-bid-step="1"]').disabled=!!ui.asta.bidPending||amount>=max;
  }

  async function submitOffer(kind,form){
    const s=ui.asta,lot=s.data?.lot,id=league()?.id;
    if(!lot||s.bidPending||form?.dataset.lot!==lot.id||Number(form.dataset.best)!==lot.bid)return;
    const st=bidState(s.data),amount=Number(form.querySelector('[data-auction-bid-range]').value);
    if(!st.can||kind==='bid'&&(!Number.isInteger(amount)||amount<st.min||amount>st.max))return;
    s.bidPending=kind;s.error=null;render();
    try{
      const next=await (kind==='bid'?api.bid(id,lot.id,amount):api.pass(id,lot.id));
      if(destroyed||league()?.id!==id)return;
      s.amount=null;applyAuction(next);
      if(kind==='bid')demoNote('auction','In demo giochi contro squadre finte: niente resta salvato.');
    }catch(error){
      if(!destroyed&&league()?.id===id&&s.data?.lot?.id===lot.id)s.error=error.message;
    }finally{
      s.bidPending=null;if(!destroyed&&!suspended&&ui.tab==='asta')render();
    }
  }

  async function openListone() {
    ui.sheet = { asta: true }; ui.asta.picking = null; ui.asta.callAmount = null; ui.asta.error = null;
    renderSheet();
    const id=league()?.id;try{const players=await api.auctionPlayers(id);if(destroyed||league()?.id!==id)return;ui.asta.players=players;if(ui.sheet?.asta)renderSheet();}catch(err){if(!destroyed&&league()?.id===id&&ui.sheet?.asta){ui.sheet={asta:true,error:err.message};renderSheet();}}
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
    if(d.astaDraw){if(!s.drawing){s.drawing=true;void api.auctionDraw(id).then(a=>{if(!destroyed&&league()?.id===id)applyAuction(a);}).catch(err=>toast(err.message)).finally(()=>{s.drawing=false;});}return true;}
    if(d.astaCancel){const p=s.data?.lot?.player||s.data?.table;if(p){s.mprice='';admin(api.auctionCancelLot(id,s.data?.lot?.id,p.id),'fanta-m-q');}return true;}
    if(d.astaClose){ui.sheet={auctionClose:true};renderSheet();return true;}
    if(d.auctionCloseConfirm&&ui.sheet?.auctionClose){ui.sheet=null;renderSheet();admin(api.auctionClose(id));ui.lega.data=null;return true;}
    if(d.auctionLobbyStart&&!s.startingLobby){
      s.startingLobby=true;render();
      void api.auctionLobbyStart(id).then(a=>{if(!destroyed&&league()?.id===id)applyAuction(a);}).catch(err=>{s.error=err.message;}).finally(()=>{s.startingLobby=false;if(!destroyed&&league()?.id===id)render();});
      return true;
    }
    if (d.astaMode) { admin(api.auctionMode(id, d.astaMode)); return true; }
    if (d.mRole) { s.mrole = d.mRole; render(); return true; }
    if (d.mTable) { admin(api.auctionTable(id, d.mTable), 'fanta-m-price'); return true; }
    if (d.mClear) { admin(s.data?.phase!=='releases'&&s.data?.config?.nomination==='random'?api.auctionCancelLot(id,null,s.data.table?.id):api.auctionTable(id,null), 'fanta-m-q'); return true; }
    // Tap sulla squadra: piccolo pop-up di conferma, poi assegnazione.
    if (d.mTeam) { s.error = null; ui.sheet = { mconfirm: d.mTeam }; renderSheet(); return true; }
    if (d.mConfirm) {
      const p = s.data?.table;
      ui.sheet = null; renderSheet();
      if (p) admin(api.assign(id, p.id, d.mConfirm, Number(s.mprice)), 'fanta-m-q');
      return true;
    }
    if (d.mUndo) { admin(api.undoSale(id, d.mUndo)); return true; }
    if (d.bidStep!==undefined) {const input=root.querySelector('[data-auction-bid-range]');if(input)syncOffer(input,Number(input.value)+Number(d.bidStep));return true;}
    if (d.astaPass) {void submitOffer('pass',root.querySelector('[data-bid-form]'));return true;}
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
    if(form.matches('[data-roster-form]')){
      const p=Object.fromEntries(new FormData(form)),{data,freePlayers}=ui.sheet;
      const player=(p.kind==='add'?freePlayers:data.roster)?.find(x=>x.id===p.playerId);
      if(!player){error.textContent='Seleziona un calciatore.';return;}
      if(p.price!==undefined)p.price=Number(p.price);
      ui.sheet={rosterConfirm:{...p,teamId:form.dataset.team,teamName:data.team.name,playerName:player.name,toName:ui.lega.data?.members.find(m=>m.team.id===p.toTeamId)?.team.name}};
      renderSheet();return;
    }
    form.dataset.busy='1';b.disabled=true;b.setAttribute('aria-busy','true');
    try{if(form.matches('[data-release-form]')){const refund=refundFor(form),id=league()?.id,a=await api.auctionRelease(id,form.dataset.releasePlayer,refund);if(destroyed||league()?.id!==id)return;applyAuction(a);ui.sheet=null;render();}else{const input=Object.fromEntries(new FormData(form)),kind=input.kind;delete input.kind;input.teamId=form.dataset.team;if(input.price!==undefined)input.price=Number(input.price);await api.rosterChange(league()?.id,kind,input);ui.home=null;await loadLega();await openRoster(form.dataset.team);toast('Rosa corretta.');}}
    catch(err){error.textContent=err.message;}finally{form.dataset.busy='0';b.disabled=false;b.removeAttribute('aria-busy');}
  });
  on(document.getElementById('v2-sheet-root'),'change',e=>{if(e.target.matches('[data-roster-kind]')){ui.lega.rosterKind=e.target.value;renderSheet();}if(e.target.closest('[data-release-form]')){const form=e.target.closest('form');form.querySelector('[data-refund-preview]').textContent=ui.asta.data.table.ownerTeam.name+' riavrà '+refundFor(form)+' crediti.';}});
  on(root,'submit', e => {
    if(e.target.matches('[data-fanta-slips-form]')){e.preventDefault();const f=e.target,b=f.querySelector('button');if(f.dataset.busy==='true')return;f.dataset.busy='true';const enabled=f.elements.enabled.checked;b.disabled=true;b.setAttribute('aria-busy','true');api.setSlips(league()?.id,enabled).then(()=>{league().slipsEnabled=enabled;const bar=slips.context(slipContext()).league;if(bar)bar.fantaSlipsEnabled=enabled;return loadLega();}).catch(err=>toast(err.message)).finally(()=>{f.dataset.busy='false';b.disabled=false;b.removeAttribute('aria-busy');});return;}
    if(e.target.matches('[data-league-size-form],[data-competition-create-form],[data-competition-start-form]')){
      e.preventDefault();const form=e.target;if(form.dataset.submitting==='true')return;form.dataset.submitting='true';const p=Object.fromEntries(new FormData(form)),b=form.querySelector('button[type="submit"]');b.disabled=true;
      const action=form.matches('[data-league-size-form]')?api.configureLeague(league()?.id,Number(p.size)):form.matches('[data-competition-create-form]')?api.createCompetition(league()?.id,p):api.startCompetition(league()?.id,{...p,startRound:Number(p.startRound),twice:!!p.twice});
      action.then(async result=>{if(result.status==='draft'){await switchCompetition(result.id);openTab('lega');}else{ui.home=null;await load();await loadLega();}toast('Impostazioni salvate.');}).catch(err=>toast(err.message)).finally(()=>{form.dataset.submitting='false';b.disabled=false;});return;
    }
    if(e.target.matches('[data-team-link-form]')){e.preventDefault();const form=e.target,data=new FormData(form),button=form.querySelector('button[type="submit"]');button.disabled=true;
      api.linkTeam(league()?.id,data.get('team'),data.get('username')).then(result=>{ui.lega.linkError=null;toast(result.demo?'Associazione simulata: in demo niente viene salvato.':'Account associato alla squadra.');return loadLega();}).catch(error=>{ui.lega.linkError=error.message;render();});return;
    }
    if(e.target.matches('[data-auction-wizard]')){e.preventDefault();void submitAuctionWizard();return;}
    if (!e.target.matches('[data-bid-form]')) return;
    e.preventDefault();
    void submitOffer('bid',e.target);
  });
  on(root,'input', e => {
    if(ui.asta.wizard&&e.target.closest('[data-auction-wizard]')&&['budget','startsAt'].includes(e.target.name))ui.asta.wizard[e.target.name]=e.target.value;
    const id = e.target.id;
    // Campi numerici: solo cifre (sono di tipo testo perché il cursore resti dove si scrive).
    if (id === 'fanta-m-price') e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (id === 'fanta-a-amount') syncOffer(e.target,Number(e.target.value));
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
    if(!ui.studio)lastStudioTap=null;
    const sheetRoot = document.getElementById('v2-sheet-root');
    if (!sheetRoot) return;
    const html=ui.studio&&ui.squadra.data?renderStudio(ui.squadra,{...ui.studio,sideBench:sideBench?.matches}):ui.sheet?sheet():'';
    document.body.classList.toggle('fs-open',!!ui.studio||ui.tab==='giornata'&&!suspended);
    sheetRoot.classList.toggle('auction-overlay',!!html&&ui.tab==='asta');
    if(html&&html===lastSheetHtml&&!sheetRoot.hidden)return; // Preserve typed amounts and selected refunds during polling.
    lastSheetHtml=html;
    const wasOpen = !sheetRoot.hidden, scroll = sheetRoot.querySelector('.fanta-sheet')?.scrollTop;
    studioDrag?.cancel();
    const studioScroll=['.fs-grid','.fs-blist','.fs-tabs','.fs-bench-row','.fs-formations'].map(selector=>{const el=sheetRoot.querySelector(selector);return {selector,left:el?.scrollLeft||0,top:el?.scrollTop||0,list:el?.dataset.stList};});
    sheetRoot.hidden = !html;
    sheetRoot.innerHTML = html;
    const playerDialog=sheetRoot.querySelector('.live-player-sheet');
    if(playerDialog){
      if(typeof playerDialog.showModal==='function')playerDialog.showModal();
      else playerDialog.setAttribute('open','');
      playerDialog.addEventListener('cancel',event=>{event.preventDefault();closePlayerSheet();});
      playerDialog.addEventListener('click',event=>{
        if(event.target!==playerDialog)return;
        const rect=playerDialog.getBoundingClientRect();
        if(event.clientY<rect.top||event.clientX<rect.left||event.clientX>rect.right)closePlayerSheet();
      });
    }
    paintAuctionBadges(sheetRoot);
    for(const {selector,left,top,list} of studioScroll){const el=sheetRoot.querySelector(selector);if(el&&el.dataset.stList===list){el.scrollLeft=left;el.scrollTop=top;}}
    if(ui.studio){
      const id=ui.squadra.benchReveal||ui.studio.benchFocus;
      if(id){
        for(const row of sheetRoot.querySelectorAll('.fs-grid')){
          const cell=[...row.querySelectorAll('[data-drag-id]')].find(el=>el.dataset.dragId===id);
          if(!cell)continue;const box=cell.getBoundingClientRect(),bounds=row.getBoundingClientRect();
          if(sideBench?.matches){
            if(!ui.studio.benchOpen)continue;
            const card=cell.closest('.fs-reserve').getBoundingClientRect();
            if(card.top<bounds.top)row.scrollTop+=card.top-bounds.top;else if(card.bottom>bounds.bottom)row.scrollTop+=card.bottom-bounds.bottom;
          }else if(box.left<bounds.left)row.scrollLeft+=box.left-bounds.left;else if(box.right>bounds.right)row.scrollLeft+=box.right-bounds.right;
        }
        if(ui.studio.benchGrip)[...sheetRoot.querySelectorAll('[data-bench-grip]')].find(el=>el.dataset.benchGrip===id)?.focus({preventScroll:true});
        else if(ui.studio.benchStep)[...sheetRoot.querySelectorAll('[data-bench-move]:not(:disabled)')].find(el=>el.dataset.benchMove===id&&el.dataset.step===ui.studio.benchStep)?.focus({preventScroll:true});
        ui.studio.benchStep=null;ui.studio.benchGrip=false;
        ui.squadra.benchReveal=null;ui.studio.benchFocus=null;
      }
    }
    bindStyledSelects(sheetRoot);
    const rosterForm=sheetRoot.querySelector('[data-roster-form]');
    if(rosterForm){
      const opened=ui.sheet,id=league()?.id;
      bindRosterPlayerSearch(rosterForm,async()=>opened.freePlayers??=await api.rosterPlayers(id));
    }
    document.body.classList.toggle('fanta-sheet-open', !!html);
    if (!html) return;
    // Aggiornamento live con la scheda già aperta: niente salto in cima, niente cambio di focus.
    if (wasOpen && scroll != null) { const s = sheetRoot.querySelector('.fanta-sheet'); if (s) s.scrollTop = scroll; return; }
    sheetRoot.querySelector('[data-m-confirm], .v2-league-row.is-active, .fanta-close, .v2-league-row')?.focus({preventScroll:true});
  }
  function closePlayerSheet(){
    const origin=ui.sheet?.origin;
    ui.sheet=null;renderSheet();
    origin?.focus({preventScroll:true});
  }
  async function switchCompetition(id){
    if(!id)return;api.setCompetition?.(id);request++;ui.sheet=null;ui.round=null;ui.matchup=null;ui.matchupId=null;ui.roundNumber=null;ui.squadra.data=null;ui.lega.data=null;ui.home=null;render();
    try{if(api.bootstrap){bootstrap=await api.bootstrap(league()?.id);await load();}else await load();}catch(err){ui.error=err.message;render();}
  }
  async function openRoster(id,{readOnly=false}={}){
    const opened=ui.sheet={roster:id};renderSheet();
    try{
      const data=await api.team(league()?.id,id);
      if(ui.sheet!==opened)return;
      opened.data=readOnly?{...data,canManageRoster:false}:data;
      if(opened.data.canManageRoster){if(!ui.lega.data)ui.lega.data=await api.league(league()?.id);ui.lega.rosterAudit=await api.rosterAudit(league()?.id);}
      if(ui.sheet===opened)renderSheet();
    }catch(err){if(ui.sheet===opened){opened.error=err.message;renderSheet();}}
  }
  async function editLogo(){
    const team=ui.home?homeTeam(ui.home):ui.squadra.data?.team;if(!team?.id)return;const id=league()?.id,{openLogoEditor}=await import('./logo-editor.mjs');if(destroyed||league()?.id!==id)return;
    const known=[ui.home,ui.squadra.data].find(data=>data&&Object.hasOwn(data,'teamNameDeadline'));
    let teamNameDeadline=known?.teamNameDeadline;
    if(!known){try{teamNameDeadline=(await api.home(id)).teamNameDeadline;}catch{}}
    if(destroyed||league()?.id!==id)return;
    openLogoEditor({team,teamNameDeadline,onSave:async input=>{
      const result=await api.saveLogo(id,{team:team.id,...input});if(destroyed||league()?.id!==id)return;
      const identity={name:result.name??team.name,branding:result.branding};
      const patch=obj=>{if(!obj||typeof obj!=='object')return;if(obj.id===team.id&&obj.name)Object.assign(obj,identity);for(const value of Object.values(obj))if(value&&typeof value==='object')patch(value);};
      [ui.home,ui.lega.data,ui.squadra.data,ui.round,ui.matchup,ui.asta.data].forEach(patch);
      if(ui.home?.me)Object.assign(ui.home.me,{teamName:identity.name,branding:identity.branding});
      if(league()?.teamId===team.id)league().teamName=identity.name;
      render();toast(input.name?'Identità della squadra salvata.':'Il tuo stemma è pronto.');
    }});
  }
  on(root,'change',e=>{if(e.target.id==='ranking-metric'){ui.lega.metric=e.target.value;render();}if(e.target.matches('[data-competition-switch]'))void switchCompetition(e.target.value);});

  // Durante la giornata in corso rilegge sfida e risultati ogni minuto (stesso ritmo del canale live del Bar).
  const sportsStream=createSportsPush({
    context:()=>{if(demo||destroyed||suspended||ui.mode!=='fanta')return null;if(ui.tab==='schedine'){const d=slips.context(slipContext());return d.league?{mode:'bar',league:d.league.id}:null;}return ui.tab==='giornata'&&ui.roundNumber&&ui.matchupId&&league()?{mode:'fanta',league:league().id,competition:ui.competitionId||ui.home?.competition?.id||ui.lega.data?.competition?.id,round:Number(ui.roundNumber),matchup:ui.matchupId}:null;},
    apply:data=>{
      if(destroyed||suspended)return;
      if(data.round){
        if(ui.tab!=='giornata'||data.round.round.number!==ui.roundNumber||data.matchup?.id&&data.matchup.id!==ui.matchupId)return;
        ui.round=data.round;
        if(data.matchup){ui.matchup=data.matchup;ui.liveError=null;}
        patchRegion(root.querySelector('.fanta-main'),'<main class="fanta-main">'+page()+'</main>');
        bindLiveStudio();
        if(ui.sheet?.player){
          const sheetRoot=document.getElementById('v2-sheet-root');
          lastSheetHtml=sheet();
          if(sheetRoot&&!sheetRoot.hidden&&lastSheetHtml)patchRegion(sheetRoot,'<div id="v2-sheet-root">'+lastSheetHtml+'</div>');
          else if(!lastSheetHtml)closePlayerSheet();
        }
      }else if(ui.tab==='schedine'&&slipServices?.applyLive){
        slipServices.applyLive(data);
        const context=slipContext();
        slips.tick(context);
        const track=root.querySelector('.fanta-native-slips [data-os-content]');
        if(!track)return;
        const template=document.createElement('template');template.innerHTML=page();
        const fresh=template.content.querySelector('[data-os-content]');
        if(!fresh)return;
        fresh.className=track.className;
        patchRegion(track,fresh.outerHTML);
        slips.bind(root,context,{keepDetail:true});
        bindStyledSelects(root);
      }
    }
  });sportsStream.start();
  function refreshLive(){return sportsStream.wake();}

  let homeVoteJob=null;
  function hydrateHomeVotes(){
    const home=ui.home,id=league()?.id;if(!home?.match?.live||homeVoteJob||['home','away'].every(k=>Number.isInteger(home.match.live[k]?.withVote)))return;
    homeVoteJob=(async()=>{let matchup=ui.matchup;
      if(!matchup||ui.roundNumber!==home.round.number||![matchup.home?.team?.id,matchup.away?.team?.id].includes(home.me.teamId)){const round=await api.round(id,home.round.number);const pick=round.matchups.find(m=>m.isMine)||round.matchups.find(m=>[m.home?.team?.id,m.away?.team?.id].includes(home.me.teamId));if(!pick)return;matchup=await api.matchup(id,home.round.number,pick.id);}
      if(!destroyed&&ui.home===home&&league()?.id===id){ui.home=withHomeVotes(home,matchup);if(!suspended&&ui.tab==='oggi')render();}
    })().catch(()=>{}).finally(()=>{homeVoteJob=null;});
  }
  async function load() {
    ui.error = null;
    if(bootstrap?.me.access==='pilot'&&!bootstrap.me.pilotTeam){ui.me=bootstrap.me;bootstrap=null;}
    if(bootstrap){const b=bootstrap;bootstrap=null;ui.me=b.me;ui.leagues=b.leagues;ui.teamChoices=b.teamChoices||[];ui.choiceError=b.autoClaimError||null;ui.choiceLeagueId=b.choiceLeagueId||null;ui.leagueId=ui.choiceLeagueId||b.home?.league.id||ui.leagueId;ui.home=b.home;hydrateHomeVotes();ui.round=b.round;ui.roundNumber=b.round?.round.number;ui.matchup=b.matchup;ui.matchupId=b.matchup?.id;ui.side=b.matchup?.away?.team.id===b.home?.me.teamId?'away':'home';ui.lega.data=b.league;ui.squadra.data=b.team;if(b.team)ui.squadra.loadedAt=Date.now();if(b.team)setDraft(draftFrom(b.team.lineup||{formation:b.team.previous?.formation||'4-4-2'},b.team.roster));render();if(ui.choiceLeagueId||!ui.leagues.length)return;if(ui.tab==='squadra'&&!ui.squadra.data)await loadTeam();if(['lega','classifica','presidente'].includes(ui.tab)&&!ui.lega.data)await loadLega();if(ui.tab==='giornata'&&!ui.round)await loadRound(Number(readAppRoute()?.round)||ui.home?.round.number);return;}
    try {
      if (!ui.me) ui.me = await api.me();
      if(ui.me.access==='pilot'&&!ui.me.pilotTeam){ui.pilot=await api.pilotTeams();render();return;}
      if (!ui.leagues.length) ui.leagues = await api.leagues();
      if(!ui.leagues.length){ui.teamChoices=await api.teamChoices?.()||[];ui.choiceLeagueId=ui.teamChoices[0]?.id||null;render();return;}
      const id = league()?.id;
      ui.home = id ? await api.home(id) : null;hydrateHomeVotes();
      if (ui.tab === 'giornata') await loadRound(ui.roundNumber, { keepMatchup: true });
      if (ui.tab === 'squadra') await loadTeam();
      if (['lega','classifica','presidente'].includes(ui.tab)) await loadLega();
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

  async function manageAuction(button){
    if(configuringAuction||league()?.role!=='admin')return;
    configuringAuction=true;button.disabled=true;button.setAttribute('aria-busy','true');const id=league()?.id;
    try{
      const details=await api.league(id);
      if(destroyed||suspended||league()?.id!==id||!details.isAdmin||details.league.kind==='pilot')return;
      ui.asta.wizard=details.auction.status==='running'?null:auctionWizard(details);
      ui.asta.panel=0;
      openTab('asta');
    }catch(error){toast(error.message);}finally{configuringAuction=false;button.disabled=false;button.removeAttribute('aria-busy');}
  }
  async function submitAuctionWizard(){
    const w=ui.asta.wizard;if(!w||w.busy)return;
    w.error=null;
    if(w.step<3){
      if(w.step===1&&w.timing==='scheduled'&&!(Date.parse(w.startsAt)>Date.now()))w.error='Scegli una data e un orario futuri.';
      else{w.step++;ui.asta.keepWizardScroll=false;}
      render();return;
    }
    const id=league()?.id,config={budget:Number(w.budget),nomination:w.nomination,playerOrder:w.playerOrder,teamOrder:w.nomination==='personal'&&w.turns==='custom'?w.teamOrder:null};
    const settings={type:w.type,config},computerTeams=w.mode==='live'?!!w.computerTeams:undefined;
    w.busy=true;render();
    try{
      const a=await (w.timing==='now'?api.auctionStartNow(id,w.mode,computerTeams,settings):api.auctionSchedule(id,{...settings,mode:w.mode,computerTeams,startsAt:new Date(w.startsAt).toISOString()}));
      if(destroyed||suspended||league()?.id!==id||ui.asta.wizard!==w)return;
      ui.asta.wizard=null;applyAuction(a);render();
      if(a.status==='scheduled')toast('Asta programmata.');
    }catch(error){if(ui.asta.wizard===w){w.error=error.message;w.busy=false;render();}}
  }

  function handleLega(d) {
    const l = ui.lega, id = league()?.id;
    if (d.legaSub) {writeAppRoute({mode:'fanta',page:ui.tab,section:d.legaSub,league:league()?.id});l.sub=d.legaSub; l.auctionError = null; render(); return true; }
    if (d.legaRound) { const n = Number(d.legaRound); l.openRound = (l.openRound ?? l.data?.calendar.current) === n ? -1 : n; render(); return true; }
    if (d.legaInvite) {
      const invite=linkedInvite(ui.home?.league,barLeagues)||linkedInvite(l.data?.league,barLeagues);
      if(!invite)return true;
      if (d.legaInvite === 'share') void shareLeagueInvite(invite,{notify:toast});
      else navigator.clipboard?.writeText(invite.url).then(() => { l.copied = true; render(); setTimeout(() => { l.copied = false; if (['lega','oggi'].includes(ui.tab)) render(); }, 2000); }).catch(() => {});
      return true;
    }
    return false;
  }

  // Carica una giornata e la sfida scelta (di default quella dell'utente).
  async function loadRound(number, { keepMatchup = false, matchup = null } = {}) {
    const mine = ++request, id = league()?.id;
    const wantedMatchup = matchup || (keepMatchup ? ui.matchupId : null);
    ui.round = null;ui.matchup=null;ui.matchupId=null;ui.liveError=null;ui.liveFlips.clear();render();
    try {
      const round = await api.round(id, number ?? ui.home?.round.number);
      if (mine !== request) return;
      ui.round = round; ui.roundNumber = round.round.number;
      const selected=round.matchups.find(m=>m.id===wantedMatchup);
      if(matchup&&!selected){ui.liveError='Questa sfida non è disponibile nella giornata.';render();return;}
      const pick=selected||round.matchups.find(m=>m.isMine)||round.matchups[0];
      await loadMatchup(pick?.id, mine, keepMatchup && !matchup);
    } catch {
      if (mine === request) { ui.liveError = 'Non riusciamo a leggere la giornata.'; render(); }
    }
  }

  async function loadMatchup(matchupId,mine=++request,keepSide=false,side) {
    ui.matchupId=matchupId;ui.matchup=null;ui.liveError=null;ui.liveFlips.clear();
    if(side)ui.side=side;
    render();
    if (!matchupId) return;
    let matchup;
    try{matchup=await api.matchup(league()?.id,ui.roundNumber,matchupId);}
    catch{if(mine===request){ui.liveError='Non riusciamo a leggere la sfida.';render();}return;}
    if (mine !== request) return;
    ui.matchup = matchup;if(ui.home?.round.number===ui.roundNumber)ui.home=withHomeVotes(ui.home,matchup);
    const myTeam = ui.home?.me.teamId;
    if (!keepSide&&!side) ui.side = matchup.away.team.id === myTeam ? 'away' : 'home';
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
    if(tab==='io'){tab='impostazioni';ui.presidentGroup='account';}
    if(tab==='schedine')slips.enter();
    if (tab === 'formazione') { tab = 'squadra'; ui.squadra.sub = 'formazione'; }
    if(tab==='giornata'&&round==null&&ui.tab!=='giornata')round=ui.home?.round.number;
    if(tab==='giornata'&&ui.tab!=='giornata')ui.liveFrom={tab:ui.tab,scroll:root.querySelector('.os-track')?.scrollLeft||0};
    if(ui.tab==='giornata'&&tab!=='giornata')request++;
    if(tab==='classifica'&&!['classifica','calendario','schedine'].includes(ui.lega.sub))ui.lega.sub='classifica';
    if(tab==='lega')ui.lega.sub=null;
    if(record)writeAppRoute({mode:'fanta',page:tab,section:['lega','classifica','presidente'].includes(tab)?ui.lega.sub:null,league:league()?.id,round:tab==='schedine'?(round||null):tab==='giornata'?(round||ui.roundNumber||ui.home?.round.number):null});
    if(tab==='asta'&&ui.tab!=='asta')ui.asta.from=ui.tab;
    ui.tab=tab;ui.sheet=null;ui.studio=null;
    if (tab === 'asta') {startAuction();render();}
    else {ui.asta.wizard=null;ui.asta.panel=0;stopAuction();void auctionStream?.check();}
    if (tab === 'giornata' && (round != null || !ui.round || !ui.matchup)) { loadRound(round != null ? Number(round) : null, { matchup }); }
    else if (tab === 'squadra' && (!ui.squadra.data||Date.now()-(ui.squadra.loadedAt||0)>60000)) loadTeam({keepView:!!ui.squadra.data});
    else if (['lega','classifica','presidente'].includes(tab) && !ui.lega.data) loadLega();
    else render();
    scrollTo(0, 0);
  }

  function closeLiveStudio(){
    const {tab='oggi',scroll=0}=ui.liveFrom||{};
    ui.liveFrom=null;
    writeAppRoute({mode:'fanta',page:tab,section:tab==='squadra'?ui.squadra.sub:tab==='lega'?ui.lega.sub:null,league:league()?.id},{replace:true});
    openTab(tab,undefined,undefined,false);
    if(scroll)window.requestAnimationFrame?.(()=>window.requestAnimationFrame(()=>{const track=root.querySelector('.os-track');if(ui.tab===tab&&track)track.scrollLeft=scroll;}));
  }

  // Trascinamento nella formazione: stesse regole del tocco, controllate sulla bozza.
  const dragOptions = {
    signal:lifecycle.signal,
    onStart:()=>{lastStudioTap=null;},
    canDrop: (drag, target) => {
      const sq = ui.squadra;
      return !!ui.studio && !sq.saving && !suspended && !!sq.draft && !sq.data?.round.locked && canDropOn(sq.draft, sq.data.roster, drag, target, sq.data.rules.benchMax);
    },
    onDrop: (drag, target) => {
      const sq = ui.squadra;
      if(drag.from==='bench'&&target===`bench:${sq.draft.bench.indexOf(drag.id)}`)return;
      const wasIncomplete=missingOf(sq.draft)>0;
      setDraft(dropOn(sq.draft, drag, target, sq.data.rules.benchMax, sq.data.roster));
      if(ui.studio){
        ui.studio.slot=null;
        if(sideBench?.matches&&drag.from==='bench'&&target.startsWith('slot:'))ui.studio.benchOpen=false;
        if(wasIncomplete&&!missingOf(sq.draft))ui.studio.role='tutti';
      }
      render();
    },
  };
  const studioRoot=document.getElementById('v2-sheet-root');if(studioRoot)studioDrag=enableDrag(studioRoot,dragOptions);
  on(sideBench,'change',()=>{if(ui.studio){ui.studio.benchOpen=false;renderSheet();}});
  on(studioRoot,'keydown',e=>{
    const grip=e.target.closest('[data-bench-grip]');
    if(!grip||!['ArrowUp','ArrowLeft','ArrowDown','ArrowRight'].includes(e.key))return;
    e.preventDefault();
    handleSquadra({benchMove:grip.dataset.benchGrip,step:['ArrowUp','ArrowLeft'].includes(e.key)?'-1':'1',benchGrip:true},e);
  });

  const auctionLocked=()=>ui.tab==='asta'&&ui.asta.data?.status==='running'&&!ui.asta.wizard;
  function requestAuctionExit(resume){
    pendingAuctionNavigation=resume;ui.sheet={auctionExit:true};renderSheet();
  }
  on(document,'click',e=>{
    if(!auctionAudioChosen&&e.isTrusted&&e.target.closest('.auction-room,[data-go="asta"],[data-auction-manage]')){
      auctionAudioChosen=true;
      void auctionSound.set(true);
    }
    if(ui.tab!=='asta'||replayingAuctionNavigation)return;
    const selector='[data-auction-exit],[data-tab],[data-go],[data-mode],[data-app-mode],[data-league],[data-bar-page],[data-action="leagues"],a[href]';
    const action=e.target.closest(selector);
    if(!action||action.matches('[data-go="asta"],[data-mode="fanta"],[data-app-mode="fanta"]'))return;
    if(!ui.asta.wizard?.busy&&!auctionLocked())return;
    e.preventDefault();e.stopImmediatePropagation();
    if(ui.asta.wizard?.busy)return;
    const href=action.getAttribute('href'),data=JSON.stringify(action.dataset);
    requestAuctionExit(()=>{(action.isConnected?action:[...document.querySelectorAll(selector)].find(el=>el.getAttribute('href')===href&&JSON.stringify(el.dataset)===data))?.click();});
  },{capture:true});
  on(window,'popstate',e=>{
    const next=readAppRoute();if(replayingAuctionNavigation||!auctionLocked()||next?.mode==='fanta'&&next.page==='asta'&&(!next.league||next.league===league()?.id))return;
    e.stopImmediatePropagation();
    const destination=location.href,state=e.state;
    writeAppRoute({mode:'fanta',page:'asta',league:league()?.id});
    requestAuctionExit(()=>{history.replaceState(state,'',destination);window.dispatchEvent(new PopStateEvent('popstate',{state}));});
  },{capture:true});

  on(document,'click',e=>{const trigger=e.target.closest('[data-fanta-chat]');if(trigger)document.dispatchEvent(new CustomEvent('quasi:open-chat',{detail:{league:league()?.id,trigger}}));});
  on(window,'offline',()=>{if(ui.tab==='schedine')render();});
  on(window,'online',()=>{if(ui.tab==='schedine')render();});
  on(root,'error',e=>{if(e.target.matches?.('img[data-fanta-photo]'))e.target.hidden=true;},{capture:true});
  on(root,'click', handle);
  on(document,'click',e=>{if(e.target.closest('#app-header'))handle(e);});
  on(document.getElementById('v2-sheet-root'),'click', handle);
  on(window,'keydown',e=>{if(e.key==='Escape'&&ui.studio){if(sideBench?.matches&&ui.studio.benchOpen)handleSquadra({stBenchPanel:'close'},e);else{closeLineupStudio();renderSheet();}}});
  on(window,'keydown',e=>{if(e.key==='Escape'&&ui.tab==='giornata'&&!ui.sheet){e.preventDefault();closeLiveStudio();}});
  on(window,'keydown', e => { if (e.key === 'Escape' && ui.sheet) { if(ui.sheet.player){e.preventDefault();closePlayerSheet();return;}pendingAuctionNavigation=null;ui.sheet = null; renderSheet(); } });

  async function enterClaimedTeam(data,id){
    bootstrap=data;ui.leagueId=id;ui.tab='oggi';store.set('qdq:fantaLeague',id);
    await load();writeAppRoute({mode:'fanta',page:'oggi',league:id});
    document.dispatchEvent(new window.CustomEvent('quasi:fanta-team-claimed',{detail:{league:id}}));
    toast('La tua squadra ti aspetta!');
  }
  async function chooseTeam(id,team){
    if(ui.claimingTeam)return;ui.claimingTeam=team;ui.choiceError=null;render();
    try{
      await api.claimTeam(id,team);api.invalidateReads?.();const data=await api.bootstrap(id);
      if(!destroyed)await enterClaimedTeam(data,id);
    }catch(err){
      if(destroyed)return;ui.choiceError=err.message;
      // A timeout can arrive after the assignment committed. Re-read ownership
      // before offering another team; never issue a second assignment blindly.
      try{api.invalidateReads?.();const data=await api.bootstrap(id);if(destroyed)return;
        if(data.leagues.some(l=>l.id===id)){ui.choiceError=null;await enterClaimedTeam(data,id);}
        else{ui.teamChoices=data.teamChoices||[];ui.choiceLeagueId=data.choiceLeagueId||ui.teamChoices[0]?.id||null;}
      }catch{/* Keep the picker and its retry control available. */}
    }finally{ui.claimingTeam=null;if(!destroyed)render();}
  }

  function handle(e) {
    if(e.target.closest('.fanta-native-slips'))return;
    const el = e.target.closest('[data-team-claim],[data-demo-scenario],[data-roster-confirm],[data-releases-confirm],[data-release],[data-release-undo],[data-releases-done],[data-pilot-pick],[data-pilot-claim],[data-competition-open],[data-team-roster],[data-mode],[data-tab],[data-go],[data-action],[data-league],[data-round],[data-matchup],[data-side],[data-player],[data-view],'
      + '[data-pick-role],[data-studio],[data-st-bench-panel],[data-st-role],[data-st-slot],[data-st-player],[data-st-clear],[data-sq-sub],[data-sq-calendar-more],[data-sq-calendar-previous],[data-sq-filter],.fanta-team-formation [data-pitch-flip],[data-formation],[data-slot],[data-pick],[data-unpick],[data-bench-add],[data-bench-pick],[data-bench-remove],[data-bench-move],[data-lineup],[data-list-add],'
      + '[data-lega-sub],[data-lega-round],[data-lega-invite],[data-auction-manage],[data-auction-exit],[data-auction-exit-confirm],[data-auction-close-confirm],[data-auction-lobby-start],[data-auction-panel],[data-auction-team],[data-auction-prev],[data-auction-order],'
      + '[data-asta-mode],[data-asta-cancel],[data-asta-close],[data-asta-draw],[data-m-role],[data-m-table],[data-m-clear],[data-m-team],[data-m-confirm],[data-m-undo],'
      + '[data-bid-step],[data-asta-pass],[data-asta-listone],[data-asta-role],[data-asta-pick],[data-asta-amount],[data-asta-call]');
    if(!el?.dataset.stSlot)lastStudioTap=null;
    if (!el || el.disabled||el.getAttribute('aria-busy')==='true') return;
    const d = el.dataset;
    if(d.auctionExitConfirm&&ui.sheet?.auctionExit){
      const resume=pendingAuctionNavigation;pendingAuctionNavigation=null;ui.sheet=null;renderSheet();
      replayingAuctionNavigation=true;try{resume?.();}finally{replayingAuctionNavigation=false;}
      return;
    }
    if(d.auctionManage){void manageAuction(el);return;}
    if(d.auctionExit){openTab(ui.asta.from||'lega');return;}
    if(d.auctionPanel!==undefined){showAuctionPanel(Number(d.auctionPanel));return;}
    if(d.auctionTeam){void openRoster(d.auctionTeam,{readOnly:true});return;}
    const wizard=ui.asta.wizard;
    if(wizard&&!wizard.busy&&d.auctionPrev){wizard.step--;wizard.error=null;ui.asta.keepWizardScroll=false;render();return;}
    if(wizard&&!wizard.busy&&d.auctionOrder!==undefined){const i=Number(d.auctionOrder),j=i+Number(d.step),ids=wizard.teamOrder;if(j>=0&&j<ids.length){[ids[i],ids[j]]=[ids[j],ids[i]];render();}return;}
    if(d.teamClaim){void chooseTeam(d.choiceLeague,d.teamClaim);return;}
    if(d.action==='refresh-team-choices'){el.disabled=true;api.invalidateReads?.();void api.teamChoices().then(choices=>{ui.teamChoices=choices;if(!choices.some(l=>l.id===ui.choiceLeagueId))ui.choiceLeagueId=choices[0]?.id||null;ui.choiceError=null;}).catch(err=>{ui.choiceError=err.message;}).finally(()=>{if(!destroyed)render();});return;}
    if(kind==='public'&&d.demoScenario&&api.setScenario){el.disabled=true;void api.setScenario(d.demoScenario).then(async()=>{ui.sheet=null;ui.home=null;ui.round=null;ui.matchup=null;ui.squadra.data=null;ui.lega.data=null;ui.roundNumber=null;ui.matchupId=null;ui.home=await api.home(league()?.id);await openTab('oggi');}).catch(e=>toast(e.message));return;}
    if(d.pilotPick){ui.sheet={pilotConfirm:d.pilotPick};renderSheet();return;}
    if(d.pilotClaim){el.disabled=true;el.setAttribute('aria-busy','true');const choice=d.pilotClaim==='random'?{random:true}:{teamId:d.pilotClaim};api.pilotClaim(choice).then(async r=>{ui.sheet=null;ui.pilot=null;ui.me={...ui.me,pilotTeam:r.team.id};ui.leagueId=r.league.id;store.set('qdq:fantaLeague',r.league.id);ui.leagues=[];toast('Benvenuto! La tua panchina ti aspetta.');await load();}).catch(async err=>{ui.sheet=null;toast(err.message);try{ui.pilot=await api.pilotTeams();}catch(e){ui.error=e.message;}render();});return;}
    if(d.rosterConfirm&&ui.sheet?.rosterConfirm){const p=ui.sheet.rosterConfirm;el.disabled=true;api.rosterChange(league()?.id,p.kind,{teamId:p.teamId,playerId:p.playerId,...(p.price!==undefined?{price:p.price}:{}),...(p.toTeamId?{toTeamId:p.toTeamId}:{})}).then(async()=>{ui.sheet=null;ui.home=null;await loadLega();ui.home=await api.home(league()?.id);await openRoster(p.teamId);render();toast('Rosa corretta.');}).catch(err=>{ui.sheet=null;renderSheet();toast(err.message);});return;}
    if(d.teamRoster){void openRoster(d.teamRoster);return;}
    if(d.competitionOpen){void switchCompetition(d.competitionOpen);return;}
    if(d.action==='edit-logo'){void editLogo();return;}
    if(d.inviteLeague){ui.presidentGroup='persone';openTab('presidente');return;}
    if (handleLega(d)) return;
    if (handleAsta(d)) return;
    if (handleSquadra(d,e)) return;
    if(d.mode==='bar'&&d.barPage==='schedina')return openTab('schedine',d.barRound);
    if (d.mode) return setMode(d.mode,d.barRound?{page:'schedina',sourceScope:'fantacalcio',league:d.barLeague,round:d.barRound,match:d.barMatch}:d.presidentGroup?{page:d.barPage,group:d.presidentGroup}:d.barPage);
    if (d.tab) {if(d.presidentGroup)ui.presidentGroup=d.presidentGroup;if(d.tab==='schedine'&&ui.tab==='schedine')return;if(d.legaOpen)ui.lega.sub=d.legaOpen;return openTab(d.legaOpen==='classifica'?'classifica':d.tab);}
    if(d.go==='formazione'&&ui.tab==='oggi'){void openHomeLineup();return;}
    if(d.presidentGroup)ui.presidentGroup=d.presidentGroup;
    if (d.go) return openTab(d.go, d.round, d.mu);
    if (d.round) {writeAppRoute({mode:'fanta',page:'giornata',league:league()?.id,round:d.round},{replace:true});loadRound(Number(d.round));return;}
    if(d.matchup){if(d.matchup!==ui.matchupId||ui.liveError)void loadMatchup(d.matchup,undefined,false,d.liveSide);return;}
    if (d.player) {
      const side=el.closest('[data-pitch-team]')?.dataset.pitchTeam==='1'?'away':'home';
      if(findPlayer(ui.matchup,d.player,side)){ui.sheet={player:d.player,side,origin:el};renderSheet();}
      return;
    }
    if (d.league) {
      api.setCompetition?.(null);
      writeAppRoute({mode:'fanta',page:'oggi',league:d.league});ui.leagueId = d.league; store.set('qdq:fantaLeague', ui.leagueId);
      ui.sheet = null; ui.home = null; ui.round = null; ui.roundNumber = null; ui.squadra.data = null; ui.asta.data = null; ui.asta.players = null; ui.asta.releasePlayers = null; ui.lega.data = null; ui.tab = ui.tab==='schedine'?'schedine':'oggi'; stopAuction(); render(); load(); return;
    }
    const action = d.action;
    if(action==='close-live-studio'){closeLiveStudio();return;}
    if (action === 'demo-info') { ui.sheet = 'demo'; renderSheet(); return; }
    if (action === 'demo-ok') { store.set('qdq:fantaDemoSeen', '1'); ui.sheet = null; renderSheet(); return; }
    if (action === 'leagues') { ui.sheet = 'leagues'; renderSheet(); }
    else if (action === 'close-sheet') { if(ui.sheet?.player){closePlayerSheet();return;}pendingAuctionNavigation=null;ui.sheet = null; renderSheet(); }
    else if (action === 'retry') load();
  }

  // Interruttori delle notifiche (pagina Io): si salvano subito.
  on(root,'change', e => {
    const w=ui.asta.wizard;
    if(w&&e.target.closest('[data-auction-wizard]')){
      const {name,value,checked}=e.target;
      if(name==='computerTeams')w.computerTeams=checked;
      if(['type','mode','timing','startsAt','budget','nomination','playerOrder','turns'].includes(name))w[name]=value;
      if(['mode','timing','nomination','turns'].includes(name))render();
      return;
    }
    const key = e.target.dataset?.notify;
    if (!key || !ui.me) return;
    const previous=ui.me.settings;
    ui.me.settings = { ...previous, notify: { ...previous?.notify, [key]: e.target.checked } };
    api.saveSettings(ui.me.settings).then(() => { ui.io.saved = true; render(); setTimeout(() => { ui.io.saved = false; if (ui.tab === 'io') render(); }, 2000); }).catch(() => {ui.me.settings=previous;render();toast('Preferenza non salvata. Riprova tra poco.');});
  });

  on(window,'popstate',()=>{const r=readAppRoute();if(r?.mode!=='fanta')return;const changedLeague=r.league&&r.league!==league()?.id&&ui.leagues.some(l=>l.id===r.league);if(changedLeague){ui.leagueId=r.league;ui.home=null;ui.squadra.data=null;ui.round=null;ui.lega.data=null;ui.asta.data=null;api.setCompetition?.(null);}if(r.section){if(r.page==='squadra')ui.squadra.sub=r.section;else ui.lega.sub=r.section;}if(changedLeague){ui.tab=r.page;ui.sheet=null;ui.studio=null;ui.asta.wizard=null;stopAuction();void load().then(()=>{if(ui.tab==='asta')startAuction();});return;}openTab(r.page,r.round?Number(r.round):undefined,undefined,false);});
  if(readAppRoute()?.section){if(readAppRoute().page==='squadra')ui.squadra.sub=readAppRoute().section;else ui.lega.sub=readAppRoute().section;}
  render();
  const socketContext=()=>({league:league()?.id,inRoom:ui.tab==='asta'&&!ui.asta.wizard,active:!destroyed&&!suspended&&ui.mode==='fanta'&&!ui.choiceLeagueId&&!document.hidden&&navigator.onLine!==false});
  const discoveredAuction=a=>{
    const old=ui.home?.auction,changed=old&&(old.status!==a.status||old.startsAt!==a.startsAt||old.mode!==a.mode||old.type!==a.type);
    const status={status:a.status,startsAt:a.startsAt,mode:a.mode,type:a.type};
    if(old)Object.assign(old,status,{title:auctionTitles[a.type]||old.title});
    if(ui.lega.data?.auction)Object.assign(ui.lega.data.auction,status);
    const slot=changed&&ui.tab==='oggi'&&root.querySelector('[data-fanta-auction-banner]');
    if(slot)slot.innerHTML=auctionCard(ui.home,Date.now());
  };
  if(api.auctionSocket===true&&typeof window.WebSocket==='function')auctionStream=createAuctionSocket({context:socketContext,
    onData:(a,clockOffset)=>{
      ui.asta.lastSync=Date.now();ui.asta.syncError=false;
      observeCompetitionActivation(a);
      if(ui.tab==='asta'){applyAuction(a,{clockOffset});showAuctionConnection();}
    },onStatus:discoveredAuction,onPresence:ids=>{
      if(JSON.stringify(ids)===JSON.stringify(ui.asta.presence))return;
      ui.asta.presence=ids;
      if(ui.tab==='asta'&&!ui.asta.wizard&&ui.asta.data?.status==='running')render();
    },onConnection:()=>{if(ui.tab==='asta')showAuctionConnection();},
  });
  const ready=load().then(async()=>{
    void auctionStream?.check();
    if(destroyed||suspended)return;
    if(ui.tab==='asta')startAuction();
    if(entryRoute?.mode!=='fanta'||entryRoute.league!==league()?.id)return;
    const round=Number(entryRoute.round)||null;
    if(ui.tab==='squadra'&&entryRoute.section==='studio')await openHomeLineup(round);
    if(ui.tab==='giornata'&&round&&ui.roundNumber!==round)await loadRound(round);
  });
  const auctionWatch=!auctionStream&&api.auctionStatus?watchAuction({
    read:id=>api.auctionStatus(id),
    context:()=>({league:league()?.id,active:!destroyed&&!suspended&&ui.mode==='fanta'&&ui.tab!=='asta'&&!ui.choiceLeagueId&&!document.hidden&&navigator.onLine!==false}),
    onStatus:discoveredAuction,
  }):null;
  on(document,'visibilitychange',()=>{void auctionStream?.check();if(!document.hidden){if(ui.tab==='asta')void pollAuction();else void auctionWatch?.check();}});
  void ready.then(()=>auctionWatch?.check());
  // In demo la spiegazione si apre da sola la prima volta.
  if (kind==='public' && store.get('qdq:fantaDemoSeen') !== '1' && ui.mode === 'fanta') { ui.sheet = 'demo'; renderSheet(); }
  timer = setInterval(() => {if(suspended)return;tickCountdowns(root);if(ui.tab==='schedine')slips.tick(slipContext());}, 1000);


  return {
    ready,
    get leagueId(){return league()?.id;},
    get hasTeam(){return ui.leagues.some(l=>l.id===ui.leagueId);},
    setBarLeagues:(next)=>{barLeagues=next;},
    suspend:()=>{suspended=true;stopAuction();void auctionStream?.check();ui.sheet=null;ui.studio=null;ui.asta.wizard=null;root.querySelector('.fanta-live-studio')?._pitchCleanup?.();renderSheet();document.body.classList.remove('fanta-sheet-open','fs-open','fanta-auction-page');const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.innerHTML='';}},
    resume:(tab,{route}={})=>{suspended=false;ui.mode='fanta';if(route?.section){if(route.page==='squadra')ui.squadra.sub=route.section;else ui.lega.sub=route.section;}openTab(tab||ui.tab,route?.round?Number(route.round):undefined,undefined,!route);},
    reload: () => { api.invalidateReads?.();ui.home = null; ui.sheet = null; ui.squadra.data = null; render(); return load(); },
    refreshLive,
    destroy: () => { destroyed=true;request++;lifecycle.abort();clearInterval(timer);sportsStream.stop();stopAuction();auctionSound.close();auctionWatch?.stop();void auctionStream?.stop();root.querySelector('.fanta-live-studio')?._pitchCleanup?.();document.body.classList.remove('fanta-auction-page','fs-open');root.innerHTML='';const sheet=document.getElementById('v2-sheet-root');if(sheet){sheet.hidden=true;sheet.classList.remove('auction-overlay');sheet.innerHTML='';} },
  };
}
