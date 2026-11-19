import './style.css';
import { DEFAULT_LEVERS, type Levers } from './model/levers';
import type { Row, SimEvent } from './model/sim';
import type { MCResult, SensRow } from './model/batch';
import { SCENARIOS, scenarioLevers } from './scenarios/presets';
import { applyStrings, t } from './ui/strings';
import { LineChart, drawTornado, cssVar, type Series } from './ui/charts';
import { AgentsView } from './ui/agentsView';
import { LeversPanel } from './ui/leversPanel';
import { CLD } from './ui/cld';
import { MISSIONS, winStatus, type Mission } from './ui/missions';
import { renderModelDoc } from './ui/modelDoc';
import type { ToWorker } from './worker';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const HORIZON = 240;
const SPEEDS = [1, 3, 6, 12, 30]; // months per second
const STRUCTURAL: (keyof Levers)[] = ['startDependency', 'earmarking'];

// ---------------------------------------------------------------- state
const state = {
  scenario: 'status-quo',
  levers: { ...DEFAULT_LEVERS } as Levers,
  start: { ...DEFAULT_LEVERS } as Levers,
  seed: 42, n: 3000, network: 'smallworld' as 'smallworld' | 'grid',
  history: [] as Row[], events: [] as SimEvent[],
  compare: '' as string, historyB: [] as Row[],
  playing: false, awaiting: false, awaitingB: false, acc: 0, speed: 3,
  mission: null as Mission | null,
};

const startFor = (policy: Levers): Levers => {
  const s = { ...DEFAULT_LEVERS };
  for (const k of STRUCTURAL) (s as unknown as Record<string, unknown>)[k] = policy[k];
  return s;
};

// ---------------------------------------------------------------- URL state
function loadHash() {
  try {
    const raw = location.hash.slice(1); if (!raw) return;
    const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (o.sc && SCENARIOS.some((s) => s.id === o.sc)) state.scenario = o.sc;
    state.levers = { ...scenarioLevers(state.scenario), ...(o.l ?? {}) };
    if (Number.isFinite(o.s)) state.seed = o.s; if ([500, 1000, 2000, 3000, 5000].includes(o.n)) state.n = o.n;
    if (o.net === 'grid' || o.net === 'smallworld') state.network = o.net;
  } catch { /* ignore malformed links */ }
}
function shareLink(): string {
  const base = scenarioLevers(state.scenario); const diff: Partial<Levers> = {};
  for (const k of Object.keys(state.levers) as (keyof Levers)[]) if (state.levers[k] !== base[k]) (diff as Record<string, unknown>)[k] = state.levers[k];
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ sc: state.scenario, l: diff, s: state.seed, n: state.n, net: state.network }))));
  return `${location.origin}${location.pathname}#${enc}`;
}

// ---------------------------------------------------------------- workers
const mkWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const wA = mkWorker();
let wB: Worker | null = null;
let wX: Worker | null = null;
const post = (w: Worker, m: ToWorker) => w.postMessage(m);

const view = new AgentsView($<HTMLCanvasElement>('agentCanvas'), $('agentTip'));
const panel = new LeversPanel($('leverGroups'), (l) => {
  state.levers = l; post(wA, { type: 'levers', levers: l });
  if (wB && state.mission === null) { /* comparison B keeps its own scenario */ }
}, (k) => cld.highlightLever(k));
const cld = new CLD($('cld'));

wA.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    view.setLayout({ n: m.n, cols: m.cols, rows: m.rows, longLinks: m.longLinks });
    view.setBuffer(m.buffer);
    state.history = m.history; state.events = [];
    state.awaiting = false;
    post(wA, { type: 'levers', levers: state.levers });
    renderAll(true);
  } else if (m.type === 'tick') {
    state.history.push(...m.rows); state.events.push(...m.events);
    view.setBuffer(m.buffer); state.awaiting = false;
    if (m.events.length) renderEvents();
    if (state.history.length - 1 >= HORIZON && state.playing) setPlaying(false);
    renderAll(false);
  }
};

function reset() {
  setPlaying(false);
  state.start = startFor(state.levers);
  state.awaiting = true;
  post(wA, { type: 'init', n: state.n, seed: state.seed, levers: state.start, network: state.network });
  panel.set(state.levers, state.start);
  resetCompare();
  renderEvents();
}

function resetCompare() {
  wB?.terminate(); wB = null; state.historyB = [];
  if (!state.compare) return;
  wB = mkWorker();
  const policyB = scenarioLevers(state.compare);
  wB.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'ready') { state.historyB = m.history; state.awaitingB = false; wB!.postMessage({ type: 'levers', levers: policyB }); }
    else if (m.type === 'tick') { state.historyB.push(...m.rows); state.awaitingB = false; }
  };
  state.awaitingB = true;
  post(wB, { type: 'init', n: state.n, seed: state.seed, levers: startFor(policyB), network: state.network });
}

function setPlaying(p: boolean) {
  state.playing = p;
  const b = $('play'); b.innerHTML = p ? `❚❚ <span>${t('pause')}</span>` : `▶ <span>${t('play')}</span>`; b.setAttribute('aria-label', p ? t('pause') : t('play'));
}

function stepOnce(count = 1) {
  if (state.awaiting) return;
  state.awaiting = true; post(wA, { type: 'step', count });
  if (wB && !state.awaitingB && state.historyB.length < state.history.length + count + 1) { state.awaitingB = true; post(wB, { type: 'step', count }); }
}

// ---------------------------------------------------------------- KPIs
const fmtPct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const fmtMoney = (v: number) => (Math.abs(v) >= 1e9 ? `${(v / 1e9).toFixed(2)}B` : `${(v / 1e6).toFixed(0)}M`);
const fmtPeople = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0));

function renderKpis() {
  const h = state.history, r = h[h.length - 1], r0 = h[0]; if (!r || !r0) return;
  const b = state.historyB[Math.min(state.historyB.length - 1, h.length - 1)];
  const win = winStatus(h);
  const tiles: { k: string; v: string; d: string; cls?: string; dir?: number; bv?: string }[] = [
    { k: t('kTarget'), v: fmtPct(r.target), d: win.won ? t('won') : `${t('goal')} · streak ${win.streak}`, cls: 'target' + (win.won ? ' win' : ''), dir: r.target - r0.target, bv: b && fmtPct(b.target) },
    { k: t('kProblem'), v: fmtPct(r.counts[4]), d: `${fmtPeople(r.counts[4] * 1e7)} adults`, dir: r.counts[4] - r0.counts[4], bv: b && fmtPct(b.counts[4]) },
    { k: t('kTax'), v: fmtMoney(r.tax * 12), d: `dependency ${fmtPct(r.dependency, 1)} of budget`, dir: -(r.tax - r0.tax), bv: b && fmtMoney(b.tax * 12) },
    { k: t('kIllegal'), v: fmtPct(r.illegalShare, 0), d: 'of all gambling spend', dir: r.illegalShare - r0.illegalShare, bv: b && fmtPct(b.illegalShare, 0) },
    { k: t('kBudget'), v: fmtMoney(r.budgetBalance), d: r.crisis ? '⚠ crisis' : 'buffer for reforms', dir: -(r.budgetBalance - r0.budgetBalance), bv: b && fmtMoney(b.budgetBalance) },
    { k: t('kResistance'), v: fmtPct(r.resistance, 0), d: 'blocks harm-reducing reforms', dir: r.resistance - r0.resistance, bv: b && fmtPct(b.resistance, 0) },
    { k: t('kQueue'), v: fmtPeople(r.queue), d: `${fmtPeople(r.capacity)} treatment slots`, dir: r.queue - r0.queue },
    { k: t('kAffected'), v: fmtPeople(r.affectedOthers), d: 'family, friends, colleagues', dir: r.affectedOthers - r0.affectedOthers, bv: b && fmtPeople(b.affectedOthers) },
  ];
  $('kpis').innerHTML = tiles.map((x) => {
    const arrow = x.dir === undefined || Math.abs(x.dir) < 1e-9 ? '' : `<span class="${x.dir > 0 ? 'up' : 'down'}">${x.dir > 0 ? '▲' : '▼'}</span>`;
    return `<div class="kpi ${x.cls ?? ''}"><div class="k">${x.k}</div><div class="v">${x.v} ${arrow}</div><div class="d">${x.d}${state.compare && x.bv ? ` · <b>B:</b> ${x.bv}` : ''}</div></div>`;
  }).join('');
  $('month').textContent = `${t('year')} ${(r.month / 12).toFixed(1)} · ${t('month')} ${r.month}/${HORIZON}`;
}

// ---------------------------------------------------------------- events feed
function renderEvents() {
  const ol = $('events');
  if (!state.events.length) { ol.innerHTML = `<li class="empty">${t('noEvents')}</li>`; return; }
  ol.innerHTML = [...state.events].reverse().map((e) => `<li class="${e.kind}"><b>Month ${e.month}</b>${e.text}</li>`).join('');
}

// ---------------------------------------------------------------- charts
interface ChartDef { title: string; chart: LineChart; series: () => Series[]; legend: HTMLElement }
const charts: ChartDef[] = [];
function addChart(title: string, opts: ConstructorParameters<typeof LineChart>[1], series: () => Series[]) {
  const card = document.createElement('div'); card.className = 'card';
  card.innerHTML = `<div class="card-head"><h2>${title}</h2></div><div class="chart-box"><canvas></canvas></div><div class="chart-legend"></div>`;
  $('charts').appendChild(card);
  const chart = new LineChart(card.querySelector('canvas')!, opts);
  charts.push({ title, chart, series, legend: card.querySelector('.chart-legend')! });
}
const col = (k: number) => cssVar(`--s${k}`);
const H = () => state.history;
const pctFmt = (v: number) => `${(v * 100).toFixed(1)}%`;
function setupCharts() {
  addChart('Target: moderate + problem gambling', { yFmt: pctFmt, goal: { value: 0.03, label: 'goal 3%' } }, () => {
    const s: Series[] = [
      { label: 'Moderate + problem', color: cssVar('--accent'), data: H().map((r) => r.target), width: 2.5 },
      { label: 'Moderate', color: col(3), data: H().map((r) => r.counts[3]), width: 1.2 },
      { label: 'Problem', color: col(4), data: H().map((r) => r.counts[4]), width: 1.2 },
    ];
    if (state.compare) s.push({ label: `B: ${SCENARIOS.find((x) => x.id === state.compare)?.name}`, color: cssVar('--ink'), dash: [5, 4], data: state.historyB.slice(0, H().length).map((r) => r.target), width: 1.6 });
    return s;
  });
  addChart('Population by state', { stacked: true, yMax: 1, yFmt: (v) => `${Math.round(v * 100)}%` }, () =>
    [4, 3, 2, 1, 5, 6, 0].map((k) => ({ label: ['Non-gambler', 'No risk', 'Low', 'Moderate', 'Problem', 'Treatment', 'Recovery'][k], color: col(k), data: H().map((r) => r.counts[k]) })));
  addChart('Harm by risk group (prevention paradox)', { stacked: true, yFmt: (v) => v.toFixed(0) }, () => [
    { label: 'Problem', color: col(4), data: H().map((r) => r.harmByGroup[2]) },
    { label: 'Moderate', color: col(3), data: H().map((r) => r.harmByGroup[1]) },
    { label: 'Low', color: col(2), data: H().map((r) => r.harmByGroup[0]) },
  ]);
  addChart('Money (per year)', { yFmt: (v) => fmtMoney(v) }, () => [
    { label: 'Legal GGR', color: col(1), data: H().map((r) => r.ggrLegal * 12) },
    { label: 'Illegal GGR', color: cssVar('--bad'), data: H().map((r) => r.ggrIllegal * 12) },
    { label: 'Tax revenue', color: col(5), data: H().map((r) => r.tax * 12), width: 2.5 },
    { label: 'Programme cost', color: col(6), data: H().map((r) => r.programCost * 12), dash: [4, 3] },
  ]);
  addChart('Slow stocks & politics', { yMin: 0, yMax: 1, yFmt: (v) => v.toFixed(2) }, () => [
    { label: 'Social acceptance', color: col(3), data: H().map((r) => r.acceptance) },
    { label: 'Public awareness', color: col(5), data: H().map((r) => r.awareness) },
    { label: 'Industry influence', color: col(6), data: H().map((r) => r.influence) },
    { label: 'Political resistance', color: cssVar('--bad'), data: H().map((r) => r.resistance), width: 2.5 },
    { label: 'Fiscal dependency ×10', color: cssVar('--ink'), data: H().map((r) => Math.min(1, r.dependency * 10)), dash: [4, 3] },
    { label: 'Illegal share', color: col(0), data: H().map((r) => r.illegalShare) },
  ]);
  addChart('Treatment & comorbidity', { yFmt: (v) => (v > 1.5 ? fmtPeople(v) : pctFmt(v)) }, () => [
    { label: 'Treatment slots', color: col(5), data: H().map((r) => r.capacity) },
    { label: 'Waiting list', color: cssVar('--bad'), data: H().map((r) => r.queue) },
  ]);
}

function drawCharts() {
  const months = H().map((r) => r.month);
  const markers = state.events.map((e) => e.month);
  for (const c of charts) {
    c.chart.opts.markers = markers;
    const s = c.series();
    c.chart.draw(s, months);
    const leg = s.map((x) => `<span><i style="background:${x.color}"></i>${x.label}</span>`).join('');
    if (c.legend.innerHTML !== leg) c.legend.innerHTML = leg;
  }
}

// ---------------------------------------------------------------- missions
function renderMissions() {
  const host = $('missions');
  host.innerHTML = MISSIONS.map((m) => {
    const active = state.mission?.id === m.id;
    const st = active ? m.check(state.history) : null;
    return `<div class="card mission"><h3>${m.title}</h3><p>${m.brief}</p><p class="teaches"><b>Teaches:</b> ${m.teaches}</p>
      ${st ? `<p class="status ${st.state === 'ok' ? 'ok' : st.state === 'fail' ? 'fail' : ''}">${st.state === 'ok' ? '✓ ' : st.state === 'fail' ? '✗ ' : ''}${st.text}</p>` : ''}
      <button class="btn ${active ? '' : 'primary'}" data-mission="${m.id}">${active ? 'End mission' : 'Start mission'}</button></div>`;
  }).join('');
  host.querySelectorAll<HTMLButtonElement>('button[data-mission]').forEach((b) => b.addEventListener('click', () => {
    const m = MISSIONS.find((x) => x.id === b.dataset.mission)!;
    if (state.mission?.id === m.id) { state.mission = null; panel.lock(undefined); renderMissions(); return; }
    state.mission = m; state.scenario = m.scenario; $<HTMLSelectElement>('scenario').value = m.scenario;
    state.levers = scenarioLevers(m.scenario);
    // missions start *in* the scenario: its levers are the starting point
    reset(); state.start = { ...state.levers }; post(wA, { type: 'init', n: state.n, seed: state.seed, levers: state.levers, network: state.network });
    panel.set(state.levers, state.start); panel.lock(m.allowedGroups); renderMissions();
  }));
}

// ---------------------------------------------------------------- analysis
function analysisWorker() {
  if (!wX) {
    wX = mkWorker();
    wX.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === 'progress') $(m.job === 'mc' ? 'mcStatus' : 'sensStatus').textContent = `${t('running')} ${m.done}/${m.total}`;
      if (m.type === 'mcResult') drawMc(m.result as MCResult, m.ms);
      if (m.type === 'sensResult') { lastSens = m.result; drawSens(); $('sensStatus').textContent = 'Longest bars = parameters your conclusion depends on most. Check their sources in Model & sources.'; }
    };
  }
  return wX;
}
let lastMc: MCResult | null = null, lastSens: SensRow[] | null = null;
const mcChart = new LineChart($<HTMLCanvasElement>('mcChart'), { yFmt: pctFmt, goal: { value: 0.03, label: 'goal 3%' } });
function drawMc(res?: MCResult, ms?: number) {
  if (res) lastMc = res; if (!lastMc) return;
  mcChart.opts.band = { lo: lastMc.p5, hi: lastMc.p95, color: cssVar('--accent') };
  mcChart.draw([{ label: 'Median', color: cssVar('--accent'), data: lastMc.p50, width: 2.5 }], lastMc.months);
  if (ms !== undefined) $('mcStatus').textContent = `20 runs in ${(ms / 1000).toFixed(1)} s · final mean ${pctFmt(lastMc.finalMean)} · 90% band ${pctFmt(lastMc.p5[lastMc.p5.length - 1])}–${pctFmt(lastMc.p95[lastMc.p95.length - 1])}`;
}
function drawSens() { if (lastSens) drawTornado($<HTMLCanvasElement>('sensChart'), lastSens.slice(0, 16), (v) => pctFmt(v)); }

// ---------------------------------------------------------------- render loop
let lastCld = 0;
function renderAll(full: boolean) {
  renderKpis();
  if (full) renderEvents();
  for (const c of charts) c.chart.dirty = true;
  if (state.mission) renderMissionsStatus();
}
function renderMissionsStatus() { if (!$('tab-missions').hidden) renderMissions(); }

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (state.playing) {
    state.acc += dt * SPEEDS[state.speed - 1];
    if (state.acc >= 1 && !state.awaiting) { const c = Math.min(12, Math.floor(state.acc)); state.acc -= c; stepOnce(c); }
  }
  view.draw();
  if (!$('tab-charts').hidden && charts.some((c) => c.chart.dirty)) drawCharts();
  if (!$('tab-cld').hidden && now - lastCld > 500) { cld.update(state.history[state.history.length - 1], state.history[0]); lastCld = now; }
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- wiring
function init() {
  applyStrings();
  loadHash();
  const sel = $<HTMLSelectElement>('scenario'), cmp = $<HTMLSelectElement>('compare');
  for (const s of SCENARIOS) { sel.add(new Option(s.name, s.id)); cmp.add(new Option(s.name, s.id)); }
  sel.value = state.scenario;
  sel.title = SCENARIOS.find((s) => s.id === state.scenario)?.description ?? '';
  sel.addEventListener('change', () => {
    state.scenario = sel.value; state.levers = scenarioLevers(sel.value); sel.title = SCENARIOS.find((s) => s.id === sel.value)?.description ?? '';
    state.mission = null; panel.lock(undefined); reset(); renderMissions();
  });
  cmp.addEventListener('change', () => { state.compare = cmp.value; reset(); });
  $<HTMLSelectElement>('agents').value = String(state.n);
  $<HTMLInputElement>('seed').value = String(state.seed);
  $<HTMLSelectElement>('network').value = state.network;
  $('agents').addEventListener('change', (e) => { state.n = Number((e.target as HTMLSelectElement).value); reset(); });
  $('seed').addEventListener('change', (e) => { state.seed = Math.max(1, Number((e.target as HTMLInputElement).value) || 1); reset(); });
  $('network').addEventListener('change', (e) => { state.network = (e.target as HTMLSelectElement).value as 'smallworld' | 'grid'; reset(); });
  $('play').addEventListener('click', () => { if (state.history.length - 1 >= HORIZON) reset(); setPlaying(!state.playing); });
  $('step').addEventListener('click', () => { setPlaying(false); stepOnce(1); });
  $('reset').addEventListener('click', () => { if (state.mission) { const m = state.mission; state.mission = null; document.querySelector<HTMLButtonElement>(`button[data-mission="${m.id}"]`)?.click(); } else reset(); });
  $('speed').addEventListener('input', (e) => { state.speed = Number((e.target as HTMLInputElement).value); });
  $('share').addEventListener('click', async () => {
    const link = shareLink(); history.replaceState(null, '', link);
    try { await navigator.clipboard.writeText(link); $('share').textContent = 'Copied!'; } catch { $('share').textContent = 'Link in address bar'; }
    setTimeout(() => ($('share').textContent = t('share')), 1500);
  });
  $('csv').addEventListener('click', exportCsv);
  $('theme').addEventListener('click', () => {
    const root = document.documentElement; const dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('theme', root.dataset.theme); } catch { /* ignore */ }
    view.refreshColors(); for (const c of charts) c.chart.dirty = true; drawMc(); drawSens();
  });
  try { const th = localStorage.getItem('theme'); if (th === 'light' || th === 'dark') document.documentElement.dataset.theme = th; } catch { /* ignore */ }
  view.refreshColors();
  $('ovSud').addEventListener('change', (e) => (view.overlays.sud = (e.target as HTMLInputElement).checked));
  $('ovIllegal').addEventListener('change', (e) => (view.overlays.illegal = (e.target as HTMLInputElement).checked));
  $('ovLinks').addEventListener('change', (e) => (view.overlays.links = (e.target as HTMLInputElement).checked));
  $('toggleLevers').addEventListener('click', () => {
    const el = $('levers'); const c = el.classList.toggle('collapsed');
    $('toggleLevers').textContent = c ? t('show') : t('hide'); $('toggleLevers').setAttribute('aria-expanded', String(!c));
  });
  document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((b) => b.addEventListener('click', () => {
    document.querySelectorAll<HTMLButtonElement>('.tabs button').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    document.querySelectorAll<HTMLElement>('.tab').forEach((s) => (s.hidden = s.id !== `tab-${b.dataset.tab}`));
    if (b.dataset.tab === 'charts') for (const c of charts) c.chart.dirty = true;
    if (b.dataset.tab === 'missions') renderMissions();
    if (b.dataset.tab === 'analysis') { drawMc(); drawSens(); }
  }));
  $('runMc').addEventListener('click', () => { $('mcStatus').textContent = t('running'); post(analysisWorker(), { type: 'mc', initial: state.start, policy: state.levers, seeds: 20, months: HORIZON, n: 1500, network: state.network }); });
  $('runSens').addEventListener('click', () => { $('sensStatus').textContent = t('running'); post(analysisWorker(), { type: 'sens', initial: state.start, policy: state.levers, months: 120, n: 1500, network: state.network }); });
  // legend
  $('legend').innerHTML = ['Non-gambler', 'No risk', 'Low', 'Moderate', 'Problem', 'Treatment', 'Recovery']
    .map((l, k) => `<span><i style="background:var(--s${k})"></i>${l}</span>`).join('');
  window.addEventListener('resize', () => { for (const c of charts) c.chart.dirty = true; drawMc(); drawSens(); });
  window.addEventListener('keydown', (e) => {
    if ((e.target as HTMLElement).closest('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); $('play').click(); }
    if (e.key === 's') $('step').click();
    if (e.key === 'r') $('reset').click();
  });
  if (window.innerWidth < 860) { $('levers').classList.add('collapsed'); $('toggleLevers').textContent = t('show'); $('toggleLevers').setAttribute('aria-expanded', 'false'); }
  setupCharts();
  renderModelDoc($('modelDoc'));
  renderMissions();
  reset();
  requestAnimationFrame(frame);
}

function exportCsv() {
  const cols = ['month', 'nonGambler', 'noRisk', 'lowRisk', 'moderateRisk', 'problem', 'inTreatment', 'inRecovery', 'target', 'harmPer1000', 'ggrLegal', 'ggrIllegal', 'tax', 'programCost',
    'atRiskRevenueShare', 'acceptance', 'awareness', 'influence', 'dependency', 'resistance', 'illegalShare', 'budgetBalance', 'queue', 'capacity', 'sudAmongPG', 'affectedOthers', 'crisis'];
  const lines = [cols.join(',')];
  for (const r of state.history) lines.push([r.month, ...r.counts, r.target, r.harm, r.ggrLegal, r.ggrIllegal, r.tax, r.programCost, r.atRiskRevenueShare, r.acceptance, r.awareness,
    r.influence, r.dependency, r.resistance, r.illegalShare, r.budgetBalance, r.queue, r.capacity, r.sudAmongPG, r.affectedOthers, r.crisis ? 1 : 0].map((v) => (typeof v === 'number' ? +v.toPrecision(6) : v)).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gambling-harm-${state.scenario}-seed${state.seed}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init();
