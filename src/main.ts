import './style.css';
import { DEFAULT_LEVERS, type Levers } from './model/levers';
import type { Row, SimEvent } from './model/sim';
import type { MCResult, SensRow } from './model/batch';
import { SCENARIOS, scenarioLevers } from './scenarios/presets';
import { applyStrings, t } from './ui/strings';
import { LineChart, drawTornado, cssVar, type Series } from './ui/charts';
import { MapView } from './ui/mapView';
import { HILDA, PARAMS } from './params';
import { LeversPanel } from './ui/leversPanel';
import { CLD } from './ui/cld';
import { MISSIONS, winStatus, type Mission } from './ui/missions';
import { renderModelDoc } from './ui/modelDoc';
import type { ToWorker } from './worker';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const HORIZON = 240;
const SPEEDS = [1, 3, 6, 12, 30]; // months per second
const STRUCTURAL: (keyof Levers)[] = ['startDependency', 'earmarking'];
const ADULTS = PARAMS.adultPopulation.value;
const GOAL = HILDA[2018].total;

// ---------------------------------------------------------------- state
const state = {
  scenario: 'status-quo',
  levers: { ...DEFAULT_LEVERS } as Levers,
  start: { ...DEFAULT_LEVERS } as Levers,
  // seed 54 tracks HILDA closely (7.4% → 9.9%); see scripts/seeds.ts
  seed: 54, n: 3000, network: 'smallworld' as 'smallworld' | 'grid',
  policyYear: 2018,
  history: [] as Row[], events: [] as SimEvent[],
  compare: '' as string, historyB: [] as Row[],
  playing: false, awaiting: false, awaitingB: false, acc: 0, speed: 3,
  mission: null as Mission | null,
};

const policyStart = () => (state.policyYear - 2018) * 12;
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
    if ([2018, 2022, 2026].includes(o.py)) state.policyYear = o.py;
  } catch { /* ignore malformed links */ }
}
function shareLink(): string {
  const base = scenarioLevers(state.scenario); const diff: Partial<Levers> = {};
  for (const k of Object.keys(state.levers) as (keyof Levers)[]) if (state.levers[k] !== base[k]) (diff as Record<string, unknown>)[k] = state.levers[k];
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ sc: state.scenario, l: diff, s: state.seed, n: state.n, net: state.network, py: state.policyYear }))));
  return `${location.origin}${location.pathname}#${enc}`;
}

// ---------------------------------------------------------------- workers
const mkWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const wA = mkWorker();
let wB: Worker | null = null;
let wX: Worker | null = null;
const post = (w: Worker, m: ToWorker) => w.postMessage(m);

const view = new MapView($<HTMLCanvasElement>('agentCanvas'), $('agentTip'));
const panel = new LeversPanel($('leverGroups'), (l) => {
  state.levers = l; post(wA, { type: 'levers', levers: l });
  if (wB && state.mission === null) { /* comparison B keeps its own scenario */ }
}, (k) => cld.highlightLever(k));
const cld = new CLD($('cld'));

wA.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    view.setLayout({ n: m.n, px: m.px, py: m.py, region: m.region, longLinks: m.longLinks });
    view.setBuffer(m.buffer);
    $('perDot').textContent = Math.round(m.scale / 100) * 100 >= 1000 ? `${(Math.round(m.scale / 100) * 100).toLocaleString('en-AU')}` : String(Math.round(m.scale));
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
  post(wA, { type: 'init', n: state.n, seed: state.seed, levers: state.start, network: state.network, policyStart: policyStart() });
  panel.set(state.levers, state.start);
  const note = $('policyNote');
  note.hidden = state.policyYear === 2018;
  note.textContent = `Policies apply from January ${state.policyYear}. Until then the model replays history (status quo, calibrated to HILDA). Set your levers now — they switch on in ${state.policyYear}.`;
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
  post(wB, { type: 'init', n: state.n, seed: state.seed, levers: startFor(policyB), network: state.network, policyStart: policyStart() });
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
const fmtMoney = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : `$${(v / 1e6).toFixed(0)}M`);
const fmtPeople = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0));

function renderKpis() {
  const h = state.history, r = h[h.length - 1], r0 = h[0]; if (!r || !r0) return;
  const b = state.historyB[Math.min(state.historyB.length - 1, h.length - 1)];
  const win = winStatus(h);
  const ratio = r.tax > 0 ? r.socialCost / r.tax : Infinity;
  const tiles: { k: string; v: string; d: string; cls?: string; dir?: number; bv?: string }[] = [
    { k: t('kTarget'), v: fmtPct(r.target, 1), d: win.won ? t('won') : `${fmtPeople(r.target * ADULTS)} adults · ${t('goal')}${win.streak ? ` · ${win.streak} mo` : ''}`, cls: 'target' + (win.won ? ' win' : ''), dir: r.target - r0.target, bv: b && fmtPct(b.target, 1) },
    { k: 'Low · moderate · high', v: `${(r.counts[2] * 100).toFixed(1)} · ${(r.counts[3] * 100).toFixed(1)} · ${((r.counts[4] + r.counts[5]) * 100).toFixed(1)}`, d: 'HILDA 2018: 3.7 · 2.5 · 1.1 (%)', cls: 'compact', dir: r.modHigh - r0.modHigh },
    { k: 'Men aged 18-34 at risk', v: fmtPct(r.youngMenAtRisk, 1), d: `vs ${fmtPct(r.othersAtRisk, 1)} of everyone else`, dir: r.youngMenAtRisk - r0.youngMenAtRisk, bv: b && fmtPct(b.youngMenAtRisk, 1) },
    { k: 'Social cost / yr', v: fmtMoney(r.socialCost * 12), d: Number.isFinite(ratio) ? `${ratio.toFixed(1)}× the tax it raises` : 'no tax raised', dir: r.socialCost - r0.socialCost, bv: b && fmtMoney(b.socialCost * 12) },
    { k: t('kTax'), v: fmtMoney(r.tax * 12), d: `${fmtPct(r.dependency, 1)} of state tax revenue`, dir: -(r.tax - r0.tax), bv: b && fmtMoney(b.tax * 12) },
    { k: t('kBudget'), v: fmtMoney(r.budgetBalance), d: r.crisis ? '⚠ budget crisis' : 'buffer for reforms', dir: -(r.budgetBalance - r0.budgetBalance) },
    { k: t('kResistance'), v: fmtPct(r.resistance, 0), d: 'waters down harm-reducing reforms', dir: r.resistance - r0.resistance, bv: b && fmtPct(b.resistance, 0) },
    { k: 'Offshore channel', v: fmtPct(r.illegalShare, 0), d: 'of spend, no protections', dir: r.illegalShare - r0.illegalShare, bv: b && fmtPct(b.illegalShare, 0) },
    { k: t('kQueue'), v: fmtPeople(r.queue), d: `${fmtPeople(r.capacity)} treatment places`, dir: r.queue - r0.queue },
  ];
  $('kpis').innerHTML = tiles.map((x) => {
    const arrow = x.dir === undefined || Math.abs(x.dir) < 1e-9 ? '' : `<span class="${x.dir > 0 ? 'up' : 'down'}">${x.dir > 0 ? '▲' : '▼'}</span>`;
    return `<div class="kpi ${x.cls ?? ''}"><div class="k">${x.k}</div><div class="v">${x.v} ${arrow}</div><div class="d">${x.d}${state.compare && x.bv ? ` · <b>B:</b> ${x.bv}` : ''}</div></div>`;
  }).join('');
  $('kpiMini').textContent = `at risk ${fmtPct(r.target, 1)} · men 18-34 ${fmtPct(r.youngMenAtRisk, 1)} · social cost ${fmtMoney(r.socialCost * 12)} · tax ${fmtMoney(r.tax * 12)} · resistance ${fmtPct(r.resistance, 0)}`;
  const yr = 2018 + Math.floor(r.month / 12), mo = r.month % 12;
  $('month').textContent = `${MONTHS[mo]} ${yr} · ${t('month')} ${r.month}/${HORIZON}`;
  $('year').textContent = String(yr);
  view.setRegionStats(r.regionAtRisk, r0.regionAtRisk);
  renderHero();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mean = (rows: Row[], f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0) / Math.max(1, rows.length);
/** The stock-and-flow panel and the three prevention goals (12-month averages; flows are noisy month to month). */
function renderHero() {
  const h = state.history, r = h[h.length - 1]; if (!r) return;
  const last = h.slice(-12).filter((x) => x.month > 0), base = h.slice(1, 13);
  const fin = mean(last, (x) => x.inflow), fout = mean(last, (x) => x.outflow), fesc = mean(last, (x) => x.escalations), fhelp = mean(last, (x) => x.helpAdmissions);
  $('sfIn').textContent = last.length ? `+${fmtPeople(fin)}` : '–';
  $('sfOut').textContent = last.length ? `−${fmtPeople(fout)}` : '–';
  const sp = (v: number) => `${Math.max(0.35, Math.min(4, 4e5 / Math.max(1, v))).toFixed(2)}s`;
  (document.querySelector('.sf-flow.in .sf-arrow') as HTMLElement).style.setProperty('--speed', sp(fin));
  (document.querySelector('.sf-flow.out .sf-arrow') as HTMLElement).style.setProperty('--speed', sp(fout));
  $('sfStock').textContent = fmtPct(r.target, 1);
  $('sfPeople').textContent = `${fmtPeople(r.target * ADULTS)} adults · 2018: ${fmtPct(h[0].target, 1)}`;
  const parts = [[r.counts[2], 2, 'low'], [r.counts[3], 3, 'moderate'], [r.counts[4] + r.counts[5], 4, 'high']] as const;
  $('sfBars').innerHTML = parts.map(([v, c, l]) => `<i style="width:${(v / Math.max(1e-9, r.target)) * 100}%;background:var(--s${c})" title="${l}: ${fmtPct(v, 1)}"></i>`).join('');
  $('sfEsc').innerHTML = last.length ? `<span><i class="dot" style="background:var(--s2)"></i>low <b>${fmtPct(r.counts[2], 1)}</b></span><span><i class="dot" style="background:var(--s3)"></i>moderate <b>${fmtPct(r.counts[3], 1)}</b></span><span><i class="dot" style="background:var(--s4)"></i>high <b>${fmtPct(r.counts[4] + r.counts[5], 1)}</b></span><span>↑ escalating <b>${fmtPeople(fesc)}</b>/yr</span><span>→ starting treatment <b>${fmtPeople(fhelp)}</b>/yr</span>` : '';
  const g = (name: string, title: string, now: number, b0: number, fmt: (v: number) => string, what: string) => {
    const d = b0 > 0 && base.length >= 6 ? now / b0 - 1 : NaN;
    const cls = !Number.isFinite(d) ? '' : d < -0.05 ? 'good' : d > 0.05 ? 'bad' : '';
    const dv = Number.isFinite(d) ? `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}% vs 2018` : 'baseline…';
    return `<div class="goal"><span class="gk">${name}</span><span class="gt">${title}</span><span class="gv ${cls}">${fmt(now)} · ${dv}</span><span class="gd">${what}</span></div>`;
  };
  $('goals').innerHTML = [
    g('Goal 1', 'Prevent escalation', fesc, mean(base, (x) => x.escalations), (v) => `${fmtPeople(v)}/yr`, 'people moving low → moderate → high'),
    g('Goal 2', 'Reduce severity', r.modHigh / Math.max(1e-9, r.target), h[0].modHigh / Math.max(1e-9, h[0].target), (v) => `${(v * 100).toFixed(0)}% of at-risk`, 'share of at-risk people at moderate or high risk'),
    g('Goal 3', 'Prevent people becoming at risk', fin, mean(base, (x) => x.inflow), (v) => `${fmtPeople(v)}/yr`, 'new at-risk adults per year (the inflow)'),
  ].join('');
}

// ---------------------------------------------------------------- events feed
function renderEvents() {
  const ol = $('events');
  if (!state.events.length) { ol.innerHTML = `<li class="empty">${t('noEvents')}</li>`; return; }
  ol.innerHTML = [...state.events].reverse().map((e) => `<li class="${e.kind}"><b>${MONTHS[e.month % 12]} ${2018 + Math.floor(e.month / 12)}</b>${e.text}</li>`).join('');
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
  const hilda = [{ x: 0, y: HILDA[2018].total, label: 'HILDA 2018 · 7.3%' }, { x: 48, y: HILDA[2022].total, label: 'HILDA 2022 · 9.8%' }];
  addChart('The stock: at-risk gamblers (% of adults)', { stacked: true, yFmt: pctFmt, goal: { value: GOAL, label: 'back to 2018' }, points: hilda }, () => [
    { label: 'High (PGSI 8+)', color: col(4), data: H().map((r) => r.counts[4] + r.counts[5]) },
    { label: 'Moderate (3-7)', color: col(3), data: H().map((r) => r.counts[3]) },
    { label: 'Low (1-2)', color: col(2), data: H().map((r) => r.counts[2]) },
  ]);
  addChart('Flows in and out of risk (adults / yr, 12-mo avg)', { yFmt: (v) => fmtPeople(v) }, () => {
    const sm = (f: (r: Row) => number) => H().map((_, i) => (i === 0 ? NaN : mean(H().slice(Math.max(1, i - 11), i + 1), f)));
    return [
      { label: 'Inflow: become at risk', color: cssVar('--bad'), data: sm((r) => r.inflow), width: 2.5 },
      { label: 'Outflow: leave risk', color: cssVar('--good'), data: sm((r) => r.outflow), width: 2.5 },
      { label: 'Escalations', color: col(4), data: sm((r) => r.escalations), dash: [5, 3] },
      { label: 'Start treatment', color: col(6), data: sm((r) => r.helpAdmissions), dash: [2, 3] },
    ];
  });
  addChart('Who is at risk: men 18-34 vs everyone else', { yFmt: pctFmt }, () => {
    const s: Series[] = [
      { label: 'Men 18-34', color: cssVar('--accent'), data: H().map((r) => r.youngMenAtRisk), width: 2.5 },
      { label: 'Everyone else', color: col(0), data: H().map((r) => r.othersAtRisk), width: 2 },
    ];
    if (state.compare) s.push({ label: `B: ${SCENARIOS.find((x) => x.id === state.compare)?.name} (all adults)`, color: cssVar('--ink'), dash: [5, 4], data: state.historyB.slice(0, H().length).map((r) => r.target), width: 1.6 });
    return s;
  });
  addChart('Who pays: social cost vs tax revenue (AUD / yr)', { yFmt: (v) => fmtMoney(v) }, () => [
    { label: 'Social cost of harm', color: cssVar('--bad'), data: H().map((r) => r.socialCost * 12), width: 2.5 },
    { label: 'Gambling losses (GGR)', color: col(1), data: H().map((r) => (r.ggrLegal + r.ggrIllegal) * 12) },
    { label: 'Tax revenue', color: col(5), data: H().map((r) => r.tax * 12), width: 2.5 },
    { label: 'Programme cost', color: col(6), data: H().map((r) => r.programCost * 12), dash: [4, 3] },
  ]);
  addChart('Harm by risk group — low risk matters too (prevention paradox)', { stacked: true, yFmt: (v) => v.toFixed(0) }, () => [
    { label: 'High', color: col(4), data: H().map((r) => r.harmByGroup[2]) },
    { label: 'Moderate', color: col(3), data: H().map((r) => r.harmByGroup[1]) },
    { label: 'Low', color: col(2), data: H().map((r) => r.harmByGroup[0]) },
  ]);
  addChart('Slow stocks & politics', { yMin: 0, yMax: 1, yFmt: (v) => v.toFixed(2) }, () => [
    { label: 'Social acceptance', color: col(3), data: H().map((r) => r.acceptance) },
    { label: 'Public awareness', color: col(5), data: H().map((r) => r.awareness) },
    { label: 'Industry influence', color: col(6), data: H().map((r) => r.influence) },
    { label: 'Political resistance', color: cssVar('--bad'), data: H().map((r) => r.resistance), width: 2.5 },
    { label: 'Fiscal dependency ×5', color: cssVar('--ink'), data: H().map((r) => Math.min(1, r.dependency * 5)), dash: [4, 3] },
    { label: 'Offshore share', color: col(0), data: H().map((r) => r.illegalShare) },
  ]);
}

function drawCharts() {
  const months = H().map((r) => r.month);
  const markers = state.events.map((e) => e.month);
  for (const c of charts) {
    c.chart.opts.markers = markers;
    c.chart.opts.vline = state.policyYear > 2018 ? { x: policyStart(), label: `policies from ${state.policyYear}` } : undefined;
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
    state.policyYear = 2018; $<HTMLSelectElement>('policyYear').value = '2018'; // missions are scored from 2018
    state.levers = scenarioLevers(m.scenario);
    // missions start *in* the scenario: its levers are the starting point
    reset(); state.start = { ...state.levers }; post(wA, { type: 'init', n: state.n, seed: state.seed, levers: state.levers, network: state.network, policyStart: 0 });
    panel.set(state.levers, state.start); panel.lock(m.allowed); renderMissions();
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
const mcChart = new LineChart($<HTMLCanvasElement>('mcChart'), { yFmt: pctFmt, goal: { value: GOAL, label: 'back to 2018 (7.3%)' } });
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
  const py = $<HTMLSelectElement>('policyYear'); py.value = String(state.policyYear);
  py.addEventListener('change', () => { state.policyYear = Number(py.value); if (state.mission) { state.mission = null; panel.lock(undefined); renderMissions(); } reset(); });
  const kw = $<HTMLDetailsElement>('kpiWrap');
  try { if (localStorage.getItem('kpiOpen') === '0') kw.open = false; } catch { /* ignore */ }
  kw.addEventListener('toggle', () => { try { localStorage.setItem('kpiOpen', kw.open ? '1' : '0'); } catch { /* ignore */ } });
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
  $('ovHeat').addEventListener('change', (e) => (view.overlays.heat = (e.target as HTMLInputElement).checked));
  $('ovYoung').addEventListener('change', (e) => (view.overlays.young = (e.target as HTMLInputElement).checked));
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
  $('runMc').addEventListener('click', () => { $('mcStatus').textContent = t('running'); post(analysisWorker(), { type: 'mc', initial: state.start, policy: state.levers, seeds: 20, months: HORIZON, n: 1500, network: state.network, policyStart: policyStart() }); });
  $('runSens').addEventListener('click', () => { $('sensStatus').textContent = t('running'); post(analysisWorker(), { type: 'sens', initial: state.start, policy: state.levers, months: 120, n: 1500, network: state.network, policyStart: policyStart() }); });
  // legend
  $('legend').innerHTML = ['Not gambling', 'No risk', 'Low risk', 'Moderate', 'High risk', 'In treatment', 'Recovered']
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
  const cols = ['month', 'date', 'atRisk', 'youngMenAtRisk', 'othersAtRisk', 'inflowPerYear', 'outflowPerYear', 'escalationsPerYear', 'socialCostPerMonth', 'nonGambler', 'noRisk', 'lowRisk', 'moderateRisk', 'problem', 'inTreatment', 'inRecovery', 'target', 'harmPer1000', 'ggrLegal', 'ggrIllegal', 'tax', 'programCost',
    'atRiskRevenueShare', 'acceptance', 'awareness', 'influence', 'dependency', 'resistance', 'illegalShare', 'budgetBalance', 'queue', 'capacity', 'sudAmongPG', 'affectedOthers', 'crisis'];
  const lines = [cols.join(',')];
  for (const r of state.history) lines.push([r.month, `${2018 + Math.floor(r.month / 12)}-${String((r.month % 12) + 1).padStart(2, '0')}`, r.target, r.youngMenAtRisk, r.othersAtRisk, r.inflow, r.outflow, r.escalations, r.socialCost, ...r.counts, r.target, r.harm, r.ggrLegal, r.ggrIllegal, r.tax, r.programCost, r.atRiskRevenueShare, r.acceptance, r.awareness,
    r.influence, r.dependency, r.resistance, r.illegalShare, r.budgetBalance, r.queue, r.capacity, r.sudAmongPG, r.affectedOthers, r.crisis ? 1 : 0].map((v) => (typeof v === 'number' ? +v.toPrecision(6) : v)).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gambling-harm-${state.scenario}-seed${state.seed}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init();
