// One abortable DB channel per tab. Late responses can never update another league.
import {beginRequestFeedback} from './action-feedback.mjs';
import {recordAnalyticsRequest} from './analytics.mjs';
const writes=new Map();
export function requestJson(url,options={}){
 const done=beginRequestFeedback(),key=options.method==='POST'?url+'\n'+options.body:null;
 if(key&&writes.has(key))return writes.get(key).finally(done);
 const started=Date.now();const job=requestTransport(url,options).then(data=>{recordAnalyticsRequest(url,options.method,true,Date.now()-started);return data;},error=>{recordAnalyticsRequest(url,options.method,false,Date.now()-started,error.status);throw error;});if(key)writes.set(key,job);
 return job.finally(()=>{if(key)writes.delete(key);done();});
}
async function requestTransport(url, {fetcher = fetch, timeoutMs = 10000, signal, meta = false, ...options} = {}) {
  const controller = new AbortController();
  let timer, cancel;
  const aborted = new Promise((_, reject) => {
    cancel = () => { controller.abort(signal?.reason); reject(signal?.reason || new Error('Richiesta interrotta')); };
    if (signal?.aborted) cancel();
    else signal?.addEventListener('abort', cancel, {once: true});
    timer = setTimeout(() => { controller.abort(); reject(new Error('Tempo di attesa scaduto')); }, timeoutMs);
  });
  try {
    return await Promise.race([aborted, (async () => {
      const response = await fetcher(url, {...options, signal: controller.signal});
      if (response.status === 304) return {notModified: true, etag: response.headers.get('etag')};
      const data = await response.json().catch(()=>{throw Object.assign(Error('Il servizio non ha risposto correttamente. Riprova tra poco.'),{status:response.status});});
      if (!response.ok) throw Object.assign(new Error(data.error || 'Operazione non riuscita'), {status: response.status,...(Array.isArray(data.issues)?{issues:data.issues}:{})});
      return meta ? {data, etag: response.headers.get('etag')} : data;
    })()]);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }
}

export function createLiveChannel({request, key, apply, status = () => {}, intervalMs = 60000, timeoutMs = 10000,
  document: doc = globalThis.document, window: win = globalThis.window, navigator: nav = globalThis.navigator,
  setTimer = setTimeout, clearTimer = clearTimeout, random = Math.random, now = Date.now} = {}) {
  let timer, active = null, stopped = true, failures = 0, wakePending = false;
  const etags = new Map();
  const available = () => !stopped && !doc?.hidden && nav?.onLine !== false;
  const schedule = delay => {
    clearTimer(timer);
    if (!available()) return;
    timer = setTimer(() => { timer = null; void poll(); }, delay);
  };
  async function poll() {
    if (!available() || active) return false;
    const current = key();
    if (!current) { schedule(intervalMs); return false; }
    const operation = {controller: new AbortController(), paused: false};
    active = operation;
    let watchdog;
    try {
      // The race is also a watchdog for a transport that ignores AbortSignal.
      const limit = new Promise((_, reject) => {
        operation.cancel = () => reject(new Error('Canale sospeso'));
        watchdog = setTimer(() => {
          operation.controller.abort();
          reject(new Error('Tempo di attesa scaduto'));
        }, timeoutMs);
      });
      const result = await Promise.race([limit, request({key: current, signal: operation.controller.signal, etag: etags.get(current)})]);
      if (!available() || operation.paused || key() !== current) { wakePending = true; return false; }
      if (!result.notModified) await apply(result.data);
      if (result.etag) {
        etags.set(current, result.etag);
        if (etags.size > 30) etags.delete(etags.keys().next().value);
      }
      failures = 0;
      status({state: 'ready', at: now()});
      return true;
    } catch (error) {
      if (!operation.paused && available()) { failures++; status({state: 'error', error}); }
      return false;
    } finally {
      clearTimer(watchdog);
      if (active === operation) active = null;
      const immediate = wakePending;
      wakePending = false;
      const delay = Math.min(300000, intervalMs * 2 ** Math.min(Math.max(0, failures - 1), 8));
      schedule(immediate ? 0 : Math.round(delay * (1 + (random() - .5) * .06)));
    }
  }
  function pause() {
    clearTimer(timer); timer = null;
    if (active) { active.paused = true; active.controller.abort(); active.cancel?.(); }
  }
  function wake() {
    if (!available()) { pause(); return; }
    clearTimer(timer); timer = null;
    if (active) { wakePending = true; active.paused = true; active.controller.abort(); active.cancel?.(); }
    else void poll();
  }
  const visibility = () => doc?.hidden ? pause() : wake();
  return {
    start() {
      if (!stopped) return;
      stopped = false;
      doc?.addEventListener('visibilitychange', visibility);
      win?.addEventListener('online', wake);
      win?.addEventListener('offline', pause);
      wake();
    },
    stop() {
      stopped = true; pause();
      doc?.removeEventListener('visibilitychange', visibility);
      win?.removeEventListener('online', wake);
      win?.removeEventListener('offline', pause);
    },
    wake,
    poll,
    get pending() { return !!active; },
  };
}

// Reconcile only explicitly selected, small live regions. Never call the page renderer.
const preserved = el => el.nodeType === 1 && el.matches('img,svg.quasi-avatar,input,textarea,select,.ranking-metric,.lineup-section,.quasi-scene,.dash-scene');
const key = el => el.nodeType===1 && (el.getAttribute('data-ranking-user') || el.getAttribute('data-ranking-team') || el.id);
function patch(current, fresh) {
  if (current.nodeType !== fresh.nodeType || current.nodeName !== fresh.nodeName) { current.replaceWith(fresh.cloneNode(true)); return; }
  if (current.nodeType === 3) { if (current.nodeValue !== fresh.nodeValue) current.nodeValue=fresh.nodeValue; return; }
  if (current.nodeType !== 1 || preserved(current)) return;
  if(current.localName==='template'&&current.innerHTML!==fresh.innerHTML)current.innerHTML=fresh.innerHTML;
  for (const a of [...current.attributes]) if (!fresh.hasAttribute(a.name) && a.name!=='open') current.removeAttribute(a.name);
  for (const a of [...fresh.attributes]) if(a.name!=='open' && current.getAttribute(a.name)!==a.value) current.setAttribute(a.name,a.value);
  const keyed=new Map([...current.children].filter(key).map(el=>[key(el),el]));
  let index=0;
  for(const next of [...fresh.childNodes]) {
    let old=current.childNodes[index];
    const match=key(next)&&keyed.get(key(next));
    if(match&&match!==old){current.insertBefore(match,old||null);old=match;}
    if(!old) current.append(next.cloneNode(true)); else patch(old,next);
    index++;
  }
  while(current.childNodes.length>index)current.lastChild.remove();
}
export function patchRegion(current,html) {
  if(!current)return;
  const template=current.ownerDocument.createElement('template');template.innerHTML=html;
  const fresh=template.content.firstElementChild;
  if(fresh)patch(current,fresh);
}
export function patchDashboard(root,html) {
  if(!root)return;
  const template=root.ownerDocument.createElement('template');template.innerHTML=html;
  for(const selector of ['.dash-next','.dash-numbers','.dash-summary']) {
    const fresh=template.content.querySelector(selector),current=root.querySelector(selector);
    if(fresh&&current)patch(current,fresh);
  }
}

export function mergeLiveSnapshot(state,data) {
  const league=state.leagues.find(l=>l.id===data.league);if(!league)return;
  if(Object.hasOwn(data,'slipReminder'))league.slipReminder=data.slipReminder;
  for(const incoming of data.members||[]){const m=league.members.find(m=>m.uid===incoming.uid);if(m)Object.assign(m,incoming);}
  if(data.fantasyRanking)league.fantasyRanking=data.fantasyRanking;
  for(const group of data.fantasyRanking?.groups||[])for(const total of group.members||[]){const member=league.members.find(m=>m.uid===total.uid);if(member){member.fantasyWallets??={};member.fantasyWallets[group.key]={initial:total.initial,credits:total.credits};}}
  if(data.progression?.fantacalcioByLeague){league.progression??={};league.progression.fantacalcioByLeague=data.progression.fantacalcioByLeague;}
  if(data.progression)for(const scope of ['seriea','fantacalcio']){
    if(!data.progression[scope])continue;
    league.progression??={};league.progression[scope]=data.progression[scope];
  }
  const byId=new Map();
  for(const round of [...(league.rounds||[]),...(state.calendar?.rounds||[])])for(const m of round.matches){
    if(!byId.has(m.id))byId.set(m.id,[]);byId.get(m.id).push(m);
  }
  const update=incoming=>{
    for(const m of byId.get(incoming.id)||[]){
      const {events,eventsAt,statistics,penalties,playerStats,kickoff,lineupRevision,...fields}=incoming;
      if(lineupRevision&&!(Date.parse(lineupRevision)<Date.parse(m.lineupRevision)))m.lineupRevision=lineupRevision;
      if(incoming.scoreUpdatedAt&&m.scoreUpdatedAt&&Date.parse(incoming.scoreUpdatedAt)<Date.parse(m.scoreUpdatedAt))continue;
      Object.assign(m,fields);if(kickoff)m.kickoff=kickoff;
      if(events){m.details={...m.details,events,updatedAt:eventsAt};if(eventsAt)m.detailRevision=eventsAt;}
      for(const [key,value]of Object.entries({statistics,penalties,playerStats}))if(value!==undefined)m.details={...m.details,[key]:value};
    }
  };
  for(const incoming of data.rounds||[]){
    const r=league.rounds.find(r=>r.id===incoming.id);if(!r)continue;
    r.closed=incoming.closed;r.settled=incoming.settled;r.publicChoicesAvailable=!!incoming.closed&&Array.isArray(incoming.publicSlips);
    if(incoming.slip&&r.slip)Object.assign(r.slip,incoming.slip);
    if(incoming.publicSlips)r.publicSlips=incoming.publicSlips.map(x=>({...r.publicSlips?.find(old=>old.uid===x.uid),...x}));
    incoming.matches.forEach(update);
  }
  (data.calendar||[]).forEach(update);
  if(data.standings)state.standings=data.standings;
}
