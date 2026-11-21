import './style.css';
import { DEFAULT_LEVERS, INTERVENTION_KEYS, isChanged, type Levers } from './model/levers';
import type { Row, SimEvent } from './model/sim';
import type { MCResult, SensRow } from './model/batch';
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
const ADULTS = PARAMS.adultPopulation.value;
const GOAL = HILDA[2018].total;

// ---------------------------------------------------------------- state
const state = {
  levers: { ...DEFAULT_LEVERS } as Levers,
  start: { ...DEFAULT_LEVERS } as Levers, // the status quo: no interventions
  // seed tracks HILDA closely in a single run; see scripts/seeds.ts
  seed: 58, n: 3000, network: 'smallworld' as 'smallworld' | 'grid',
  policyYear: 2018,
  history: [] as Row[], events: [] as SimEvent[],
  historyS: [] as Row[], // hidden "as is" run: same seed, no interventions
  playing: false, awaiting: false, awaitingS: false, acc: 0, speed: 3,
  mission: null as Mission | null,
};

const policyStart = () => (state.policyYear - 2018) * 12;
/** The reference row: the month interventions start (Jan 2018 by default, or the chosen year). */
const baseRow = () => state.history[Math.min(policyStart(), state.history.length - 1)];
/** 12 months of flows to compare against: the opening month, or the year before the policy year. */
const baseFlows = () => (policyStart() > 0 ? state.history.slice(policyStart() - 11, policyStart() + 1) : state.history.slice(0, 1));
const anyOn = (l: Levers) => isChanged(l, DEFAULT_LEVERS);

// ---------------------------------------------------------------- URL state
function loadHash() {
  try {
    const raw = location.hash.slice(1); if (!raw) return;
    const o = JSON.parse(decodeURIComponent(escape(atob(raw))));
    if (o.l && typeof o.l === 'object') state.levers = { ...DEFAULT_LEVERS, ...o.l };
    if (Number.isFinite(o.s)) state.seed = o.s; if ([500, 1000, 2000, 3000, 5000].includes(o.n)) state.n = o.n;
    if (o.net === 'grid' || o.net === 'smallworld') state.network = o.net;
    if ([2018, 2022, 2026].includes(o.py)) state.policyYear = o.py;
  } catch { /* ignore malformed links */ }
}
function shareLink(): string {
  const enc = btoa(unescape(encodeURIComponent(JSON.stringify({ l: state.levers, s: state.seed, n: state.n, net: state.network, py: state.policyYear }))));
  return `${location.origin}${location.pathname}#${enc}`;
}

// ---------------------------------------------------------------- workers
const mkWorker = () => new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
const wA = mkWorker();
let wS: Worker | null = null;
let wX: Worker | null = null;
const post = (w: Worker, m: ToWorker) => w.postMessage(m);

const view = new MapView($<HTMLCanvasElement>('agentCanvas'), $('agentTip'));
const panel = new LeversPanel($('ivList'), (l) => { state.levers = l; post(wA, { type: 'levers', levers: l }); renderHero(); }, () => { /* no hover action */ });
new CLD($('cld'));

wA.onmessage = (ev) => {
  const m = ev.data;
  if (m.type === 'ready') {
    view.setLayout({ n: m.n, px: m.px, py: m.py, region: m.region, longLinks: m.longLinks });
    view.setBuffer(m.buffer);
    $('perDot').textContent = Math.round(m.scale / 100) * 100 >= 1000 ? `${(Math.round(m.scale / 100) * 100).toLocaleString('en-AU')}` : String(Math.round(m.scale));
    state.history = m.history; state.events = (m.events ?? []).filter((e: SimEvent) => e.month >= policyStart());
    state.awaiting = false;
    post(wA, { type: 'levers', levers: state.levers });
    renderAll(true);
  } else if (m.type === 'tick') {
    state.history.push(...m.rows); state.events.push(...m.events);
    view.setBuffer(m.buffer); state.awaiting = false;
    syncShadow();
    if (m.events.length) renderEvents();
    if (state.history.length - 1 >= HORIZON && state.playing) setPlaying(false);
    renderAll(false);
  }
};

function reset() {
  setPlaying(false);
  state.history = []; state.events = []; // every run starts from zero
  state.awaiting = true;
  post(wA, { type: 'init', n: state.n, seed: state.seed, levers: state.start, network: state.network, policyStart: policyStart() });
  panel.set(state.levers, state.start);
  const note = $('policyNote');
  note.hidden = state.policyYear === 2018;
  note.textContent = `The run opens in January ${state.policyYear}: 2018–${state.policyYear - 1} has already happened (no interventions, calibrated to HILDA). Your interventions act from now on, and changes are measured against ${state.policyYear}.`;
  resetShadow();
  renderEvents();
}

/** The "as is" baseline: identical start and seed, no interventions. Differences = the impact of your interventions. */
function resetShadow() {
  wS?.terminate(); state.historyS = [];
  wS = mkWorker();
  wS.onmessage = (ev) => {
    const m = ev.data;
    if (m.type === 'ready') { state.historyS = m.history; state.awaitingS = false; syncShadow(); }
    else if (m.type === 'tick') { state.historyS.push(...m.rows); state.awaitingS = false; syncShadow(); renderHero(); }
  };
  state.awaitingS = true;
  post(wS, { type: 'init', n: state.n, seed: state.seed, levers: state.start, network: state.network, policyStart: policyStart() });
}

function setPlaying(p: boolean) {
  state.playing = p;
  const b = $('play'); b.innerHTML = p ? `❚❚ <span>${t('pause')}</span>` : `▶ <span>${t('play')}</span>`; b.setAttribute('aria-label', p ? t('pause') : t('play'));
}

function stepOnce(count = 1) {
  if (state.awaiting) return;
  state.awaiting = true; post(wA, { type: 'step', count });
  syncShadow(count);
}
/** Keep the "as is" run level with the main run: step it by however far it is behind (never by a fixed amount, or it falls behind for good). */
function syncShadow(extra = 0) {
  if (!wS || state.awaitingS || !state.historyS.length) return;
  const behind = state.history.length + extra - state.historyS.length;
  if (behind > 0) { state.awaitingS = true; post(wS, { type: 'step', count: Math.min(behind, 60) }); }
}

// ---------------------------------------------------------------- indicators
const fmtPct = (v: number, d = 2) => `${(v * 100).toFixed(d)}%`;
const fmtMoney = (v: number) => (Math.abs(v) >= 1e9 ? `$${(v / 1e9).toFixed(1)}bn` : `$${(v / 1e6).toFixed(0)}M`);
const fmtPeople = (v: number) => (v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}k` : v.toFixed(0));
const fmtIdx = (v: number) => `×${v.toFixed(2)}`;
const score = (v: number) => `${Math.round(v * 100)} / 100`;
const AD_STAGE = (cov: number) => (cov < 0.05 ? 'no ad ban' : cov > 0.95 ? 'ad ban complete' : `ad ban: ${Math.round(cov * 100)}% of ads removed`);

function renderKpis() {
  const h = state.history, r = h[h.length - 1], r0 = baseRow(); if (!r || !r0) return;
  const win = winStatus(h);
  const ratio = r.tax > 0 ? r.socialCost / r.tax : Infinity;
  const tiles: { k: string; v: string; d: string; cls?: string; dir?: number }[] = [
    { k: 'At-risk gamblers', v: fmtPct(r.target, 1), d: win.won ? t('won') : `${fmtPeople(r.target * ADULTS)} adults · ${t('goal')}${win.streak ? ` · ${win.streak} mo` : ''}`, cls: 'target' + (win.won ? ' win' : ''), dir: r.target - r0.target },
    { k: 'Low · moderate · high', v: `${(r.counts[2] * 100).toFixed(1)} · ${(r.counts[3] * 100).toFixed(1)} · ${((r.counts[4] + r.counts[5]) * 100).toFixed(1)}`, d: 'HILDA 2018: 3.7 · 2.5 · 1.1 (%)', cls: 'compact', dir: r.modHigh - r0.modHigh },
    { k: 'Social cost of harm / yr', v: fmtMoney(r.socialCost * 12), d: Number.isFinite(ratio) ? `${ratio.toFixed(1)}× the tax it raises` : 'no tax raised', dir: r.socialCost - r0.socialCost },
    { k: 'Gambling expenditure / yr', v: fmtMoney(r.expenditure * 12), d: `${fmtPct(r.atRiskRevenueShare, 0)} of it from at-risk gamblers`, dir: r.expenditure - r0.expenditure },
    { k: 'Tax → government spend', v: fmtMoney(r.tax * 12), d: `${fmtMoney(r.govSpend * 12)} a year on harm services`, dir: -(r.govSpend - r0.govSpend) },
    { k: 'Social acceptance', v: score(r.acceptance), d: `exposure to gambling ${fmtIdx(r.exposure)} vs 2018`, dir: r.acceptance - r0.acceptance },
    { k: 'Marketing exposure', v: `${fmtIdx(r.marketing)} vs 2018`, d: AD_STAGE(r.adBanCoverage), dir: r.marketing - r0.marketing },
    { k: 'Financial stress (at risk)', v: score(r.financialStress), d: `losses $${Math.round(r.losses).toLocaleString('en-AU')} / month per at-risk gambler`, dir: r.financialStress - r0.financialStress },
    { k: 'Treatment & counselling', v: `${fmtPeople(r.capacity)} places`, d: `${fmtPeople(r.queue)} waiting · help-seeking ${fmtIdx(r.helpSeeking)}`, dir: -(r.capacity - r0.capacity) },
    { k: 'Public pressure → regulation', v: score(r.pressure), d: `regulatory strength ${score(r.regulation)}`, dir: -(r.regulation - r0.regulation) },
  ];
  $('kpis').innerHTML = tiles.map((x) => {
    const arrow = x.dir === undefined || Math.abs(x.dir) < 1e-9 ? '' : `<span class="${x.dir > 0 ? 'up' : 'down'}">${x.dir > 0 ? '▲' : '▼'}</span>`;
    return `<div class="kpi ${x.cls ?? ''}"><div class="k">${x.k}</div><div class="v">${x.v} ${arrow}</div><div class="d">${x.d}</div></div>`;
  }).join('');
  $('kpiMini').textContent = `at risk ${fmtPct(r.target, 1)} · social cost ${fmtMoney(r.socialCost * 12)} · acceptance ${Math.round(r.acceptance * 100)} · marketing ${fmtIdx(r.marketing)} · tax ${fmtMoney(r.tax * 12)}`;
  const yr = 2018 + Math.floor(r.month / 12), mo = r.month % 12;
  $('month').textContent = `${MONTHS[mo]} ${yr} · ${t('month')} ${r.month}/${HORIZON}`;
  $('year').textContent = String(yr);
  view.setRegionStats(r.regionAtRisk, r0.regionAtRisk);
  renderHero();
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const mean = (rows: Row[], f: (r: Row) => number) => rows.reduce((a, r) => a + f(r), 0) / Math.max(1, rows.length);
/** The stock-and-flow panel and the three goals: fewer in, less harm, more out (12-month averages; flows are noisy month to month). */
function renderHero() {
  const h = state.history, r = h[h.length - 1]; if (!r) return;
  const last = h.slice(-12), base = baseFlows(), r0 = baseRow(), by = state.policyYear;
  const fin = mean(last, (x) => x.inflow), fout = mean(last, (x) => x.outflow), fesc = mean(last, (x) => x.escalations), fhelp = mean(last, (x) => x.helpAdmissions);
  const hasFlows = last.length > 0 && fin + fout > 0; // a run never has zero flows; zero means the data is not in yet
  $('sfIn').textContent = hasFlows ? `+${fmtPeople(fin)}` : '…';
  $('sfOut').textContent = hasFlows ? `−${fmtPeople(fout)}` : '…';
  const sp = (v: number) => `${Math.max(0.35, Math.min(4, 4e5 / Math.max(1, v))).toFixed(2)}s`;
  (document.querySelector('.sf-flow.in .sf-arrow') as HTMLElement).style.setProperty('--speed', sp(fin));
  (document.querySelector('.sf-flow.out .sf-arrow') as HTMLElement).style.setProperty('--speed', sp(fout));
  $('sfStock').textContent = fmtPct(r.target, 1);
  $('sfPeople').textContent = r.month === r0.month ? `${fmtPeople(r.target * ADULTS)} adults` : `${fmtPeople(r.target * ADULTS)} adults · ${by}: ${fmtPct(r0.target, 1)}`;
  const parts = [[r.counts[2], 2, 'low'], [r.counts[3], 3, 'moderate'], [r.counts[4] + r.counts[5], 4, 'high']] as const;
  $('sfBars').innerHTML = parts.map(([v, c, l]) => `<i style="width:${(v / Math.max(1e-9, r.target)) * 100}%;background:var(--s${c})" title="${l}: ${fmtPct(v, 1)}"></i>`).join('');
  $('sfEsc').innerHTML = last.length ? `<span><i class="dot" style="background:var(--s2)"></i>low <b>${fmtPct(r.counts[2], 1)}</b></span><span><i class="dot" style="background:var(--s3)"></i>moderate <b>${fmtPct(r.counts[3], 1)}</b></span><span><i class="dot" style="background:var(--s4)"></i>high <b>${fmtPct(r.counts[4] + r.counts[5], 1)}</b></span><span>↑ escalating <b>${fmtPeople(fesc)}</b>/yr</span><span>→ starting treatment <b>${fmtPeople(fhelp)}</b>/yr</span>` : '';
  // impact of your interventions: compare with the "as is" run over the same months
  const changed = anyOn(state.levers);
  const hs = state.historyS.slice(0, h.length), rs = hs[hs.length - 1];
  const hasS = changed && !!rs && rs.month === r.month;
  const lastS = hasS ? hs.slice(-12) : [];
  const imp = $('sfImpact');
  if (!changed) imp.innerHTML = `<span class="muted">As is — switch on an intervention or move a lever to see its impact here.</span>`;
  else if (!hasS) imp.innerHTML = `<span class="muted">Comparing with "as is"…</span>`;
  else {
    const dp = r.target - rs.target, people = dp * ADULTS;
    const cls = dp < -0.0005 ? 'good' : dp > 0.0005 ? 'bad' : '';
    imp.innerHTML = `<span>As is: <b>${fmtPct(rs.target, 1)}</b></span><span>With your interventions: <b>${fmtPct(r.target, 1)}</b></span><span class="${cls}"><b>${Math.abs(dp) < 0.0005 ? 'no difference yet' : `${fmtPeople(Math.abs(people))} ${dp < 0 ? 'fewer' : 'more'} adults at risk`}</b></span>`;
  }
  const g = (name: string, title: string, now: number, asIs: number, b0: number, fmt: (v: number) => string, what: string, up = false) => {
    const pct = (a: number, b: number) => (b > 0 ? a / b - 1 : NaN);
    const sign = (d: number) => `${d > 0 ? '+' : ''}${(d * 100).toFixed(0)}%`;
    const tone = (d: number) => (!Number.isFinite(d) ? '' : (up ? -d : d) < -0.03 ? 'good' : (up ? -d : d) > 0.03 ? 'bad' : '');
    let impact: string;
    if (!changed) impact = `<span class="gi muted">as is (no interventions)</span>`;
    else if (!hasS || !lastS.length) impact = `<span class="gi muted">comparing…</span>`;
    else { const d = pct(now, asIs); impact = `<span class="gi ${tone(d)}">${Math.abs(d) < 0.005 ? 'same as "as is" so far' : `${sign(d)} vs as is (${fmt(asIs)})`}</span>`; }
    const dy = base.length ? pct(now, b0) : NaN;
    const hist = Number.isFinite(dy) ? (r.month === r0.month ? `start of ${by}` : `${sign(dy)} vs ${by}`) : 'baseline…';
    return `<div class="goal"><span class="gk">${name}</span><span class="gt">${title}</span><span class="gv">${fmt(now)}</span>${impact}<span class="gd">${what} · ${hist}</span></div>`;
  };
  const cost = (x: Row) => x.socialCost * 12;
  const rate = (out: number, x: Row) => out / Math.max(1, x.target * ADULTS); // share of the stock that leaves per year
  if (!hasFlows) { $('goals').innerHTML = `<div class="goal"><span class="gd">Running the model…</span></div>`; return; }
  $('goals').innerHTML = [
    g('Goal 1', 'Fewer adults entering risk', fin, mean(lastS, (x) => x.inflow), mean(base, (x) => x.inflow), (v) => `${fmtPeople(v)}/yr`, 'adults who start being at risk'),
    g('Goal 2', 'Less harm (current and new)', cost(r), rs ? cost(rs) : NaN, cost(r0), (v) => `${fmtMoney(v)}/yr`, 'social cost of harm, all at-risk adults'),
    g('Goal 3', 'More people recovering', rate(fout, r), rs ? rate(mean(lastS, (x) => x.outflow), rs) : NaN, rate(mean(base, (x) => x.outflow), r0), (v) => `${(v * 100).toFixed(0)}% of at-risk/yr`, `${fmtPeople(fout)} adults leave risk per year`, true),
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
const r0 = () => state.history[0];
function setupCharts() {
  const hilda = [{ x: 0, y: HILDA[2018].total, label: 'HILDA 2018 · 7.3%' }, { x: 48, y: HILDA[2022].total, label: 'HILDA 2022 · 9.8%' }];
  addChart('The stock: at-risk gamblers (% of adults)', { stacked: true, yFmt: pctFmt, goal: { value: GOAL, label: 'back to 2018' }, points: hilda }, () => [
    { label: 'High (PGSI 8+)', color: col(4), data: H().map((r) => r.counts[4] + r.counts[5]) },
    { label: 'Moderate (3-7)', color: col(3), data: H().map((r) => r.counts[3]) },
    { label: 'Low (1-2)', color: col(2), data: H().map((r) => r.counts[2]) },
  ]);
  addChart('Flows: entering and leaving risk (adults / yr, 12-mo avg)', { yFmt: (v) => fmtPeople(v) }, () => {
    const sm = (f: (r: Row) => number) => H().map((_, i) => mean(H().slice(Math.max(0, i - 11), i + 1), f));
    return [
      { label: 'Entering at-risk gambling', color: cssVar('--bad'), data: sm((r) => r.inflow), width: 2.5 },
      { label: 'Exit from risk', color: cssVar('--good'), data: sm((r) => r.outflow), width: 2.5 },
      { label: 'Escalations', color: col(4), data: sm((r) => r.escalations), dash: [5, 3] },
      { label: 'Start treatment', color: col(6), data: sm((r) => r.helpAdmissions), dash: [2, 3] },
    ];
  });
  addChart('Market & social norms (× 2018)', { yMin: 0, yFmt: (v) => `×${v.toFixed(1)}` }, () => [
    { label: 'Marketing exposure', color: col(4), data: H().map((r) => r.marketing), width: 2.5 },
    { label: 'Gambling accessibility', color: col(3), data: H().map((r) => r.accessibility), width: 2 },
    { label: 'Exposure to gambling', color: col(1), data: H().map((r) => r.exposure) },
    { label: 'Social acceptance', color: col(6), data: H().map((r) => r.acceptance / r0().acceptance), width: 2 },
    { label: 'Gambling participation', color: col(0), data: H().map((r) => r.participation / r0().participation), dash: [4, 3] },
  ]);
  addChart('Individual harm (average among at-risk gamblers, 0-1)', { yMin: 0, yMax: 1, yFmt: (v) => v.toFixed(1) }, () => [
    { label: 'Financial stress', color: col(4), data: H().map((r) => r.financialStress), width: 2.5 },
    { label: 'Gambling as coping', color: col(3), data: H().map((r) => r.coping) },
    { label: 'Emotional distress', color: col(6), data: H().map((r) => r.distress) },
    { label: 'Family conflict', color: col(1), data: H().map((r) => r.conflict) },
    { label: 'Social isolation', color: col(0), data: H().map((r) => r.isolation), dash: [4, 3] },
  ]);
  addChart('Who pays: harm, spending, tax and services (AUD / yr)', { yFmt: (v) => fmtMoney(v) }, () => [
    { label: 'Social cost of harm', color: cssVar('--bad'), data: H().map((r) => r.socialCost * 12), width: 2.5 },
    { label: 'Gambling expenditure', color: col(1), data: H().map((r) => r.expenditure * 12) },
    { label: 'Gambling tax revenue', color: col(5), data: H().map((r) => r.tax * 12), width: 2.5 },
    { label: 'Government spend on harm services', color: col(6), data: H().map((r) => r.govSpend * 12), dash: [4, 3] },
  ]);
  addChart('Public response (0-1)', { yMin: 0, yMax: 1, yFmt: (v) => v.toFixed(1) }, () => [
    { label: 'Awareness of harm', color: col(5), data: H().map((r) => r.awareness), width: 2 },
    { label: 'Public pressure to reform', color: col(3), data: H().map((r) => r.pressure), width: 2 },
    { label: 'Regulatory strength', color: cssVar('--ink'), data: H().map((r) => r.regulation), width: 2.5 },
  ]);
  addChart('Treatment & counselling (people)', { yMin: 0, yFmt: (v) => fmtPeople(v) }, () => [
    { label: 'Treatment & counselling places', color: col(6), data: H().map((r) => r.capacity), width: 2.5 },
    { label: 'Waiting for treatment', color: cssVar('--bad'), data: H().map((r) => r.queue), dash: [4, 3] },
  ]);
  addChart('Your interventions in effect (0-1, after delays)', { yMin: 0, yMax: 1, yFmt: (v) => v.toFixed(1) }, () => [
    { label: '1 · Ad ban (share of ads removed)', color: col(4), data: H().map((r) => r.adBanCoverage), width: 2.5 },
    { label: '2 · Anti-gambling campaign', color: col(6), data: H().map((r) => r.campaign), width: 2 },
    { label: '3 · Affordability checks', color: col(3), data: H().map((r) => r.affordability), width: 2 },
    { label: '4 · Recovery support programs', color: col(5), data: H().map((r) => r.support), width: 2 },
  ]);
  addChart('Harm by risk group — low risk matters too (prevention paradox)', { stacked: true, yFmt: (v) => v.toFixed(0) }, () => [
    { label: 'High', color: col(4), data: H().map((r) => r.harmByGroup[2]) },
    { label: 'Moderate', color: col(3), data: H().map((r) => r.harmByGroup[1]) },
    { label: 'Low', color: col(2), data: H().map((r) => r.harmByGroup[0]) },
  ]);
}

function drawCharts() {
  if (!H().length) return;
  const months = H().map((r) => r.month);
  const markers = state.events.map((e) => e.month);
  for (const c of charts) {
    c.chart.opts.markers = markers;
    c.chart.opts.vline = state.policyYear > 2018 ? { x: policyStart(), label: `interventions from ${state.policyYear}` } : undefined;
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
    state.mission = m;
    state.policyYear = 2018; $<HTMLSelectElement>('policyYear').value = '2018'; // missions are scored from 2018
    state.levers = { ...DEFAULT_LEVERS };
    reset(); panel.lock(m.allowed); renderMissions();
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
function renderAll(full: boolean) {
  renderKpis();
  if (full) renderEvents();
  for (const c of charts) c.chart.dirty = true;
  if (state.mission && !$('tab-missions').hidden) renderMissions();
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.25, (now - last) / 1000); last = now;
  if (state.playing) {
    state.acc += dt * SPEEDS[state.speed - 1];
    if (state.acc >= 1 && !state.awaiting) { const c = Math.min(12, Math.floor(state.acc)); state.acc -= c; stepOnce(c); }
  }
  view.draw();
  if (!$('tab-charts').hidden && charts.some((c) => c.chart.dirty)) drawCharts();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- wiring
function init() {
  applyStrings();
  loadHash();
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
  $('clearAll').addEventListener('click', () => { state.levers = { ...DEFAULT_LEVERS }; panel.set(state.levers, state.start); post(wA, { type: 'levers', levers: state.levers }); renderHero(); });
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
  const cols: [string, (r: Row) => number | string][] = [
    ['month', (r) => r.month], ['date', (r) => `${2018 + Math.floor(r.month / 12)}-${String((r.month % 12) + 1).padStart(2, '0')}`],
    ['atRiskGamblers', (r) => r.target], ['lowRisk', (r) => r.counts[2]], ['moderateRisk', (r) => r.counts[3]], ['highRisk', (r) => r.counts[4]], ['inTreatment', (r) => r.counts[5]],
    ['enteringPerYear', (r) => r.inflow], ['exitPerYear', (r) => r.outflow], ['escalationsPerYear', (r) => r.escalations], ['startTreatmentPerYear', (r) => r.helpAdmissions],
    ['socialAcceptance', (r) => r.acceptance], ['exposureIndex', (r) => r.exposure], ['marketingIndex', (r) => r.marketing], ['accessibilityIndex', (r) => r.accessibility],
    ['participation', (r) => r.participation], ['expenditurePerMonth', (r) => r.expenditure], ['operatorRevenuePerMonth', (r) => r.operatorRevenue], ['atRiskShareOfSpend', (r) => r.atRiskRevenueShare],
    ['intensityIndex', (r) => r.intensity], ['lossesPerAtRiskGambler', (r) => r.losses], ['financialStress', (r) => r.financialStress], ['coping', (r) => r.coping],
    ['distress', (r) => r.distress], ['familyConflict', (r) => r.conflict], ['isolation', (r) => r.isolation], ['harmPer1000', (r) => r.harm], ['socialCostPerMonth', (r) => r.socialCost],
    ['taxPerMonth', (r) => r.tax], ['govSpendPerMonth', (r) => r.govSpend], ['programCostPerMonth', (r) => r.programCost], ['awareness', (r) => r.awareness], ['helpSeeking', (r) => r.helpSeeking],
    ['publicPressure', (r) => r.pressure], ['regulatoryStrength', (r) => r.regulation], ['treatmentPlaces', (r) => r.capacity], ['waiting', (r) => r.queue],
    ['adBanCoverage', (r) => r.adBanCoverage], ['campaign', (r) => r.campaign], ['affordabilityChecks', (r) => r.affordability], ['recoverySupport', (r) => r.support],
  ];
  const lines = [cols.map(([k]) => k).join(',')];
  for (const r of state.history) lines.push(cols.map(([, f]) => { const v = f(r); return typeof v === 'number' ? +v.toPrecision(6) : v; }).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
  const on = INTERVENTION_KEYS.filter((k) => state.levers[k]).join('-') || (anyOn(state.levers) ? 'custom' : 'as-is');
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `gambling-harm-${on}-seed${state.seed}.csv`; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init();
