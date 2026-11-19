import { defaultParamValues, type ParamValues } from '../params';
import { DEFAULT_LEVERS, LEVER_META, type Levers } from './levers';
import { clamp, hazardToProb, mulberry32 } from './rng';

/** Gambling states (PGSI categories + treatment pathway). */
export const NG = 0, NR = 1, LR = 2, MR = 3, PG = 4, TX = 5, RC = 6;
export const STATE_COUNT = 7;
export const STATE_NAMES = ['Non-gambler', 'No risk (PGSI 0)', 'Low risk (1–2)', 'Moderate risk (3–7)', 'Problem (8+)', 'In treatment', 'In recovery'];

export type NetworkKind = 'smallworld' | 'grid';

export interface SimOptions {
  n: number;
  seed: number;
  levers: Levers;
  params?: Partial<ParamValues>;
  network?: NetworkKind;
  burnIn?: boolean;
}

export interface SimEvent { month: number; kind: string; text: string }

/** One row of history per month. */
export interface Row {
  month: number;
  counts: number[]; // per state, as shares of population
  target: number; // moderate + problem share
  harm: number; // harm index per 1,000 adults
  harmByGroup: [number, number, number]; // low, moderate, problem (incl. affected others)
  ggrLegal: number; // currency / month (real scale)
  ggrIllegal: number;
  tax: number;
  programCost: number;
  atRiskRevenueShare: number;
  acceptance: number;
  awareness: number;
  influence: number;
  dependency: number;
  resistance: number;
  illegalShare: number;
  budgetBalance: number;
  queue: number; // real people waiting
  capacity: number; // real treatment slots
  sudAmongPG: number; // share of PG agents with alcohol or drug disorder
  affectedOthers: number; // real people
  crisis: boolean;
}

/** Numeric view of levers so that toggles can phase in through delays. */
type Eff = Record<keyof Levers, number>;
const toNum = (l: Levers): Eff => {
  const o = {} as Eff;
  for (const k of Object.keys(l) as (keyof Levers)[]) {
    const v = l[k];
    o[k] = typeof v === 'boolean' ? (v ? 1 : 0) : (v as number);
  }
  return o;
};

const PRODUCTS = 5; // lottery, sports, in-play, casino, EGM

export class Simulation {
  readonly n: number;
  readonly scale: number; // real adults per agent
  readonly P: ParamValues;
  readonly rand: () => number;
  levers: Levers;
  month = 0;
  history: Row[] = [];
  events: SimEvent[] = [];

  // agents
  state: Uint8Array;
  prev: Uint8Array;
  age: Float32Array;
  vuln: Float32Array;
  subtype: Uint8Array; // 0 conditioned, 1 emotionally vulnerable, 2 antisocial-impulsive
  alc: Uint8Array;
  drug: Uint8Array;
  illegal: Uint8Array;
  debt: Float32Array;
  waiting: Uint8Array;
  waitSince: Int32Array;
  taste: Float32Array;
  prAgentDefault: Float32Array;
  // network (CSR) and layout
  nbrStart: Int32Array;
  nbr: Int32Array;
  longLinks: Int32Array; // pairs of rewired long-range ties (for drawing)
  cols: number;
  rows: number;
  network: NetworkKind;

  // SD stocks
  A = 0.6; W = 0.3; L = 0.5; D = 0.025; R = 0.3; I = 0.15; C = 0; balance = 0; crisis = false;
  private eff: { s1: Eff; s2: Eff; s3: Eff };
  private initialEff: Eff;
  // references frozen at the end of burn-in
  private ref = { harm: 1, gamblers: 0.66, profit: 1, tax: 1, program: 0, budget: 1, prMean: 1 };
  private burning = false;
  /** mean SUD escalation multiplier in the status quo, so heterogeneity does not shift the calibration */
  private sudNorm = 1;
  private flags: Record<string, boolean> = {};

  constructor(opts: SimOptions) {
    this.n = opts.n;
    this.P = { ...defaultParamValues(), ...(opts.params ?? {}) } as ParamValues;
    this.scale = this.P.adultPopulation / this.n;
    this.rand = mulberry32(opts.seed);
    this.levers = { ...opts.levers };
    this.network = opts.network ?? 'smallworld';
    const n = this.n;
    this.state = new Uint8Array(n);
    this.prev = new Uint8Array(n);
    this.age = new Float32Array(n);
    this.vuln = new Float32Array(n);
    this.subtype = new Uint8Array(n);
    this.alc = new Uint8Array(n);
    this.drug = new Uint8Array(n);
    this.illegal = new Uint8Array(n);
    this.debt = new Float32Array(n);
    this.waiting = new Uint8Array(n);
    this.waitSince = new Int32Array(n);
    this.taste = new Float32Array(n * PRODUCTS);
    this.prAgentDefault = new Float32Array(n);
    this.cols = Math.ceil(Math.sqrt(n * 1.6));
    this.rows = Math.ceil(n / this.cols);
    const net = this.buildNetwork();
    this.nbrStart = net.start; this.nbr = net.list; this.longLinks = net.long;

    const e = toNum(this.levers);
    this.eff = { s1: { ...e }, s2: { ...e }, s3: { ...e } };
    this.initialEff = { ...e };

    // initial distribution ≈ status-quo steady state
    const init = [0.339, 0.51, 0.102, 0.036, 0.0114, 0.0007, 0.0017];
    for (let i = 0; i < n; i++) this.spawn(i, true, init);
    this.A = this.levers.acceptance / 100;
    this.I = this.P.illegalBase;
    for (let i = 0; i < n; i++) this.illegal[i] = this.rand() < this.I ? 1 : 0;
    this.ref.prMean = this.meanProductRisk(true);
    {
      const a = DEFAULT_LEVERS.alcohol / 100 * 1.6, d = DEFAULT_LEVERS.drugs / 100 * 1.6;
      this.sudNorm = (1 - a + a * this.P.alc_escalation) * (1 - d + d * this.P.drug_escalation);
    }

    if (opts.burnIn !== false) this.burnIn();
    else this.freezeRefs();
  }

  // ---------------------------------------------------------------- setup
  private buildNetwork() {
    const n = this.n, cols = this.cols, rnd = this.rand;
    const adj: number[][] = Array.from({ length: n }, () => []);
    const long: number[] = [];
    const link = (a: number, b: number) => { if (a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
    if (this.network === 'grid') {
      for (let i = 0; i < n; i++) {
        const x = i % cols, y = Math.floor(i / cols);
        for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || nx >= cols) continue;
          const j = ny * cols + nx;
          if (j < n) link(i, j);
        }
      }
    } else {
      // Watts–Strogatz: ring lattice (k=6) laid out row-major, 5% rewiring
      const k = 3, pRewire = 0.05;
      for (let i = 0; i < n; i++) {
        for (let d = 1; d <= k; d++) {
          let j = (i + d) % n;
          if (rnd() < pRewire) { j = Math.floor(rnd() * n); long.push(i, j); }
          link(i, j);
        }
        // vertical neighbour keeps the visual grid coherent
        if (i + cols < n && rnd() < 0.5) link(i, i + cols);
      }
    }
    const start = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) start[i + 1] = start[i] + adj[i].length;
    const list = new Int32Array(start[n]);
    for (let i = 0; i < n; i++) list.set(adj[i], start[i]);
    return { start, list, long: new Int32Array(long) };
  }

  /** (Re)create agent i. `initial` draws age uniformly and state from `dist`; otherwise a new 18-year-old. */
  private spawn(i: number, initial: boolean, dist?: number[]) {
    const r = this.rand;
    this.age[i] = initial ? 18 + r() * 67 : 18;
    // lognormal vulnerability with mean 1
    const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    this.vuln[i] = Math.exp(0.45 * z - 0.45 * 0.45 / 2);
    const u = r();
    this.subtype[i] = u < 0.7 ? 0 : u < 0.9 ? 1 : 2;
    const alcP = this.levers.alcohol / 100, drugP = this.levers.drugs / 100;
    let s = NG;
    if (dist) { let acc = 0; const v = r(); for (let k = 0; k < STATE_COUNT; k++) { acc += dist[k]; if (v < acc) { s = k; break; } } }
    else s = r() < 0.35 ? NR : NG; // some 18-year-olds already gamble
    this.state[i] = s;
    const atRisk = s === MR || s === PG;
    this.alc[i] = r() < alcP * (atRisk ? 3 : 1) ? 1 : 0;
    this.drug[i] = r() < drugP * (atRisk ? 3 : 1) ? 1 : 0;
    this.debt[i] = 0;
    this.waiting[i] = 0;
    this.illegal[i] = r() < this.I ? 1 : 0;
    let sum = 0;
    for (let k = 0; k < PRODUCTS; k++) { const t = -Math.log(1 - r()); this.taste[i * PRODUCTS + k] = t; sum += t; }
    for (let k = 0; k < PRODUCTS; k++) this.taste[i * PRODUCTS + k] /= sum;
    this.prAgentDefault[i] = 0;
  }

  // ---------------------------------------------------------------- products
  private mix(e: Eff, useDefault = false): number[] {
    const ev = useDefault ? toNum(DEFAULT_LEVERS) : e;
    const f = 0.5 + ev.innovation / 100;
    const av = 0.5 + ev.availability / 100;
    return [0.3, 0.2, 0.15 * f * (1 - ev.inPlayBan), 0.2 * f, 0.15 * av];
  }
  private risks(): number[] {
    const P = this.P;
    return [P.risk_lottery, P.risk_sports, P.risk_inplay, P.risk_casino, P.risk_egm];
  }
  private productRisk(i: number, mix: number[], rk: number[]): number {
    let num = 0, den = 0;
    const o = i * PRODUCTS;
    for (let k = 0; k < PRODUCTS; k++) { const w = this.taste[o + k] * mix[k]; num += w * rk[k]; den += w; }
    return den > 0 ? num / den : 1;
  }
  private meanProductRisk(useDefault: boolean): number {
    const mix = this.mix(this.eff.s3, useDefault), rk = this.risks();
    let s = 0;
    for (let i = 0; i < this.n; i++) s += this.productRisk(i, mix, rk);
    return s / this.n;
  }

  // ---------------------------------------------------------------- lifecycle
  setLevers(l: Levers) { this.levers = { ...l }; }

  private burnIn() {
    this.burning = true;
    const months = this.P.burnInMonths;
    for (let t = 0; t < months; t++) this.step();
    this.burning = false;
    this.freezeRefs();
    this.month = 0;
    this.history = [];
    this.events = [];
    this.flags = {};
    this.record(this.lastAgg!);
  }

  private freezeRefs() {
    const a = this.lastAgg ?? this.aggregate(this.mix(this.eff.s3), this.risks(), this.eff.s3);
    this.ref.harm = Math.max(1e-9, a.harmPerCap);
    this.ref.gamblers = a.gamblerShare;
    this.ref.profit = Math.max(1, a.profit);
    this.ref.tax = Math.max(1, a.tax);
    this.ref.program = a.programCost;
    const dep = this.levers.startDependency / 100;
    this.ref.budget = dep > 0 ? a.tax / dep : this.P.publicBudgetMonthly;
    this.D = this.ref.budget > 0 ? a.tax / this.ref.budget : 0;
    this.balance = 12 * this.ref.tax;
    this.W = 0.3;
    this.L = 0.5;
    this.C = a.capacityTarget;
    this.R = this.resistanceTarget();
  }

  private resistanceTarget(): number {
    const e = this.eff.s3;
    return clamp(0.6 * this.D / 0.1 + 0.3 * this.L + 0.3 * e.earmarking / 100 + (this.crisis ? 0.3 : 0), 0, 1);
  }

  /** Third-order delay of every lever, with harm-reducing changes attenuated by political resistance. */
  private updateEffectiveLevers() {
    const { s1, s2, s3 } = this.eff;
    const tau = this.burning ? 1 : this.P.policyDelay;
    const att = this.P.resistanceAttenuation * this.R;
    const set = toNum(this.levers);
    for (const m of LEVER_META) {
      const k = m.key;
      if (k === 'startDependency') { s1[k] = s2[k] = s3[k] = set[k]; continue; }
      const base = this.initialEff[k];
      let target = set[k];
      const delta = target - base;
      const harmReducing = m.reformSign !== 0 && Math.sign(delta) === m.reformSign;
      if (harmReducing) target = base + delta * (1 - att);
      const rate = Math.min(1, 3 / tau);
      s1[k] += (target - s1[k]) * rate;
      s2[k] += (s1[k] - s2[k]) * rate;
      s3[k] += (s2[k] - s3[k]) * rate;
    }
  }

  private lastAgg: ReturnType<Simulation['aggregate']> | null = null;

  // ---------------------------------------------------------------- one month
  step() {
    this.updateEffectiveLevers();
    const P = this.P, e = this.eff.s3, rnd = this.rand, n = this.n;
    const proh = e.prohibition;
    const adBanF = 1 - 0.5 * Math.min(1, e.adBan) - 0.4 * Math.max(0, e.adBan - 1);
    const mkt = (e.marketing / 100) * adBanF * (1 - 0.8 * proh) + 0.05 * proh;
    const avail = (e.availability / 100) * (1 - proh) + 0.3 * proh;
    const cAv = avail - 0.5, cMkt = mkt - 0.5, cInn = e.innovation / 100 - 0.5;
    const cAcc = this.A - 0.6;
    const pressure = e.socialPressure / 50;
    const stake = e.stakeLimits * (1 - proh), dep = e.depositLimits * (1 - proh), aff = e.affordability * (1 - proh);
    const selfEx = e.selfExclusion * (1 - proh);
    const support = e.support / 100;
    const mix = this.mix(e), rk = this.risks();
    const prRef = this.ref.prMean;

    const startG = Math.exp(P.b_availability * cAv + P.b_marketing * cMkt + P.b_acceptance * cAcc);
    const quitG = Math.exp(-0.5 * (P.b_availability * cAv + P.b_acceptance * cAcc));
    const escG = P.escalationScale * Math.exp(0.45 * P.b_marketing * cMkt + 0.45 * P.b_innovation * cInn + 0.4 * P.b_availability * cAv + 0.4 * P.b_acceptance * cAcc);
    const limitEsc = (1 - 0.08 * stake) * (1 - 0.08 * dep) * (1 - 0.12 * aff);
    const deescG = P.recoveryScale * Math.exp(-0.3 * (P.b_innovation * cInn + P.b_availability * cAv)) * (1 + 0.05 * stake + 0.1 * dep + 0.1 * aff) * (1 + 0.5 * (this.W - 0.3));
    const helpG = Math.exp(P.b_awarenessHelp * (this.W - 0.3) + P.b_supportHelp * (support - 0.2) - 0.8 * cAcc) * (1 + 0.4 * selfEx);
    const relapseG = Math.exp(P.b_availability * cAv + 0.5 * P.b_marketing * cMkt) * (1 - 0.4 * selfEx);
    const integ = e.integratedServices;
    const alcP = clamp(e.alcohol / 100, 0, 0.6), drugP = clamp(e.drugs / 100, 0, 0.6);
    const sudOut = P.sudExitRate;
    const alcIn = (alcP / (1 - alcP)) * sudOut * 0.85; // 0.85 compensates for gambling→SUD coupling
    const drugIn = (drugP / (1 - drugP)) * sudOut * 0.85;
    const illegalTau = P.illegalTau;

    this.prev.set(this.state);
    const prev = this.prev;
    const st = this.state;

    for (let i = 0; i < n; i++) {
      // ageing & generational turnover
      this.age[i] += 1 / 12;
      if (this.age[i] >= 85) { this.spawn(i, false); continue; }

      // peers
      let g = 0, risk = 0;
      const a0 = this.nbrStart[i], a1 = this.nbrStart[i + 1];
      for (let q = a0; q < a1; q++) { const s = prev[this.nbr[q]]; if (s >= NR && s <= PG) g++; if (s === MR || s === PG) risk++; }
      const deg = Math.max(1, a1 - a0);
      const peerG = g / deg - this.ref.gamblers, peerR = risk / deg - 0.048;

      // comorbidity chains
      const s0 = prev[i];
      const atRisk = s0 === MR || s0 === PG;
      const sudMult = atRisk ? P.gamblingToSud : 1;
      if (this.alc[i]) { if (rnd() < hazardToProb(sudOut)) this.alc[i] = 0; }
      else if (rnd() < hazardToProb(alcIn * sudMult)) this.alc[i] = 1;
      if (this.drug[i]) { if (rnd() < hazardToProb(sudOut)) this.drug[i] = 0; }
      else if (rnd() < hazardToProb(drugIn * sudMult)) this.drug[i] = 1;

      // channel
      if (this.illegal[i]) { if (rnd() < hazardToProb((1 - this.I) / illegalTau)) this.illegal[i] = 0; }
      else if (rnd() < hazardToProb(this.I / illegalTau)) this.illegal[i] = 1;
      const ill = this.illegal[i] === 1;

      // individual multipliers
      const sub = this.subtype[i];
      const subEsc = sub === 0 ? 1 / 1.22 : sub === 1 ? 1.5 / 1.22 : 2.2 / 1.22;
      const subRec = sub === 0 ? 1.2 : sub === 1 ? 0.8 : 0.6;
      const subHelp = sub === 0 ? 1 : sub === 1 ? 1.3 : 0.6;
      const sudEsc = (this.alc[i] ? P.alc_escalation : 1) * (this.drug[i] ? P.drug_escalation : 1) / this.sudNorm;
      const sudRec = (this.alc[i] ? P.alc_recovery : 1) * (this.drug[i] ? P.drug_recovery : 1);
      const prRel = Math.pow(this.productRisk(i, mix, rk) / prRef, P.b_product);
      const peerEsc = Math.exp(P.b_peerRisk * pressure * clamp(peerR, -0.1, 0.4));
      const esc = escG * this.vuln[i] * subEsc * sudEsc * prRel * peerEsc * (ill ? P.illegalRisk : limitEsc);
      const deesc = deescG * subRec * sudRec / (ill ? 1.2 : 1);
      const young = this.age[i] < 25 ? 1.5 * (1 - 0.3 * e.ageVerification) : 1;

      let s = s0;
      const u = rnd();
      switch (s0) {
        case NG: {
          const r = P.h_NG_NR * startG * young * Math.exp(P.b_peerStart * pressure * peerG);
          if (u < hazardToProb(r)) s = NR;
          break;
        }
        case NR: {
          const rq = P.h_NR_NG * quitG, ru = P.h_NR_LR * esc;
          const pt = hazardToProb(rq + ru);
          if (u < pt) s = u < pt * rq / (rq + ru) ? NG : LR;
          break;
        }
        case LR: {
          const rd = P.h_LR_NR * deesc, rq = P.h_LR_NG * quitG, ru = P.h_LR_MR * esc;
          const tot = rd + rq + ru, pt = hazardToProb(tot);
          if (u < pt) { const v = u / pt * tot; s = v < rd ? NR : v < rd + rq ? NG : MR; }
          break;
        }
        case MR: {
          const debtF = 1 + 0.6 * Math.min(1, this.debt[i] / (P.baseSpend * 120));
          const rd = P.h_MR_LR * deesc, ru = P.h_MR_PG * P.pgScale * esc * debtF;
          const pt = hazardToProb(rd + ru);
          if (u < pt) s = u < pt * rd / (rd + ru) ? LR : PG;
          else if (!this.waiting[i] && rnd() < hazardToProb(P.h_MR_TX * helpG * subHelp)) { this.waiting[i] = 1; this.waitSince[i] = this.month; }
          break;
        }
        case PG: {
          const rd = P.h_PG_MR * deesc * (1 + 0.5 * selfEx * (ill ? 0 : 1));
          if (u < hazardToProb(rd)) s = MR;
          else if (!this.waiting[i] && rnd() < hazardToProb(P.h_PG_TX * helpG * subHelp)) { this.waiting[i] = 1; this.waitSince[i] = this.month; }
          break;
        }
        case TX: {
          const sudPenalty = (this.alc[i] || this.drug[i]) && !integ ? 1 : 0;
          const rs = P.h_TX_RC * (1 + (P.integratedTxBoost - 1) * integ) * (sudPenalty ? 0.8 : 1);
          const rf = P.h_TX_PG * (sudPenalty ? 1.5 : 1);
          const pt = hazardToProb(rs + rf);
          if (u < pt) s = u < pt * rs / (rs + rf) ? RC : PG;
          break;
        }
        case RC: {
          const rp = P.h_RC_PG * relapseG * (ill ? 1.3 : 1) * sudEsc, rm = P.h_RC_MR * relapseG, rn = P.h_RC_NG;
          const tot = rp + rm + rn, pt = hazardToProb(tot);
          if (u < pt) { const v = u / pt * tot; s = v < rp ? PG : v < rp + rm ? MR : NG; }
          break;
        }
      }
      st[i] = s;
      if (this.waiting[i] && (s !== MR && s !== PG)) this.waiting[i] = 0;
      if (this.waiting[i] && this.month - this.waitSince[i] > 6 && rnd() < 0.1) this.waiting[i] = 0; // abandon queue

      // debt dynamics
      if (s === MR || s === PG) {
        const over = (s === PG ? 0.6 : 0.3) * P.baseSpend * (s === PG ? P.spend_PG : P.spend_MR) * (ill ? 1 : (1 - 0.6 * aff));
        this.debt[i] = Math.min(this.debt[i] + over * 0.1, P.baseSpend * 240);
      } else this.debt[i] *= 0.97;
    }

    // treatment admissions (FIFO by waiting time, limited by capacity)
    let inTx = 0;
    for (let i = 0; i < n; i++) if (st[i] === TX) inTx++;
    const capAgents = this.C / this.scale;
    let free = capAgents - inTx;
    let freeInt = Math.floor(free) + (rnd() < free - Math.floor(free) ? 1 : 0);
    if (freeInt > 0) {
      const waiting: number[] = [];
      for (let i = 0; i < n; i++) if (this.waiting[i]) waiting.push(i);
      waiting.sort((a, b) => this.waitSince[a] - this.waitSince[b]);
      for (const i of waiting) { if (freeInt-- <= 0) break; st[i] = TX; this.waiting[i] = 0; }
    }

    const agg = this.aggregate(mix, rk, e);
    this.lastAgg = agg;
    this.updateStocks(agg, e);
    if (!this.burning) { this.month++; this.record(agg); this.detectEvents(); }
  }

  // ---------------------------------------------------------------- aggregation
  private aggregate(mix: number[], rk: number[], e: Eff) {
    const P = this.P, n = this.n, scale = this.scale, st = this.state;
    const proh = e.prohibition;
    const adBanF = 1 - 0.5 * Math.min(1, e.adBan) - 0.4 * Math.max(0, e.adBan - 1);
    const mkt = (e.marketing / 100) * adBanF * (1 - 0.8 * proh) + 0.05 * proh;
    const avail = (e.availability / 100) * (1 - proh) + 0.3 * proh;
    const intensity = Math.exp(0.4 * (mkt - 0.5) + 0.5 * (e.innovation / 100 - 0.5) + 0.3 * (avail - 0.5));
    const stake = e.stakeLimits * (1 - proh), dep = e.depositLimits * (1 - proh), aff = e.affordability * (1 - proh);
    const limitSpend = (1 - 0.25 * stake) * (1 - 0.2 * dep) * (1 - 0.35 * aff);
    const counts = new Array(STATE_COUNT).fill(0);
    let legal = 0, illegal = 0, atRiskSpend = 0, harmLR = 0, harmMR = 0, harmPG = 0, affected = 0, sudPG = 0, queue = 0;
    const mult = [0, P.spend_NR, P.spend_LR, P.spend_MR, P.spend_PG, 0, 0];
    for (let i = 0; i < n; i++) {
      const s = st[i];
      counts[s]++;
      if (this.waiting[i]) queue++;
      if (s >= NR && s <= PG) {
        const prRel = Math.sqrt(this.productRisk(i, mix, rk) / this.ref.prMean);
        let spend = P.baseSpend * mult[s] * intensity * prRel;
        const ill = this.illegal[i] === 1 || proh > 0.5;
        if (!ill && (s === MR || s === PG)) spend *= limitSpend;
        if (ill) illegal += spend; else legal += spend;
        if (s === MR || s === PG) atRiskSpend += spend;
      }
      const sud = this.alc[i] || this.drug[i] ? 2 : 0;
      if (s === LR) { harmLR += P.harm_LR + 0.3 * P.affected_LR; affected += P.affected_LR; }
      else if (s === MR) { harmMR += P.harm_MR + sud + 0.3 * P.affected_MR + this.debt[i] / (P.baseSpend * 100); affected += P.affected_MR; }
      else if (s === PG) { harmPG += P.harm_PG + sud + 0.3 * P.affected_PG + this.debt[i] / (P.baseSpend * 100); affected += P.affected_PG; if (sud) sudPG++; }
    }
    legal *= scale * (1 - proh); illegal *= scale;
    const tax = legal * (e.taxRate / 100);
    const marketingCost = legal * 0.08 * (e.marketing / 50);
    const profit = Math.max(0, legal - tax - marketingCost);
    const support = e.support / 100;
    const programCost = support * (P.supportBudgetFull + P.campaignCostFull) + (e.enforcement / 100) * P.enforcementCostFull;
    const capacityTarget = ((e.levy / 100) * tax + support * P.supportBudgetFull) / P.treatmentCostPerSlot;
    const totalSpend = legal + illegal;
    const harmTotal = harmLR + harmMR + harmPG;
    return {
      counts, legal, illegal, tax, profit, programCost, capacityTarget,
      atRiskShare: totalSpend > 0 ? (atRiskSpend * scale) / totalSpend : 0,
      harmPerCap: harmTotal / n,
      harmByGroup: [harmLR / n * 1000, harmMR / n * 1000, harmPG / n * 1000] as [number, number, number],
      gamblerShare: (counts[NR] + counts[LR] + counts[MR] + counts[PG]) / n,
      affected: affected * scale,
      sudAmongPG: counts[PG] > 0 ? sudPG / counts[PG] : 0,
      queue: queue * scale,
    };
  }

  private updateStocks(a: ReturnType<Simulation['aggregate']>, e: Eff) {
    const P = this.P;
    if (this.burning) {
      // keep references tracking the system while it settles
      this.ref.harm = Math.max(1e-9, a.harmPerCap);
      this.ref.gamblers = a.gamblerShare;
      this.C = a.capacityTarget;
      return;
    }
    const support = e.support / 100;
    const adBanF = 1 - 0.5 * Math.min(1, e.adBan) - 0.4 * Math.max(0, e.adBan - 1);
    const mkt = (e.marketing / 100) * adBanF * (1 - 0.8 * e.prohibition);
    // awareness: visible harm + campaigns
    const harmRel = a.harmPerCap / this.ref.harm;
    const wT = clamp(0.3 * Math.pow(harmRel, 0.7) + 0.35 * (support - 0.2), 0, 1);
    this.W += (wT - this.W) / P.tau_awareness;
    // acceptance: cultural anchor + marketing + participation − visible harm
    const aT = clamp(e.acceptance / 100 + 0.3 * (mkt - 0.5) + 0.4 * (a.gamblerShare - this.ref.gamblers) - 0.5 * (this.W - 0.3), 0, 1);
    this.A += (aT - this.A) / P.tau_acceptance;
    // industry influence follows profits
    const lT = clamp(0.5 * a.profit / this.ref.profit, 0, 1);
    this.L += (lT - this.L) / P.tau_influence;
    // fiscal dependency
    const dT = this.ref.budget > 0 ? a.tax / this.ref.budget : 0;
    this.D += (dT - this.D) / P.tau_dependency;
    // budget balance vs. the baseline the public budget was built on
    // the state slowly re-bases its budget on the new revenue/cost levels: fast changes hurt, slow ones don't
    this.balance += (a.tax - this.ref.tax) - (a.programCost - this.ref.program);
    this.ref.tax += (a.tax - this.ref.tax) / P.tau_budgetAdapt;
    this.ref.program += (a.programCost - this.ref.program) / P.tau_budgetAdapt;
    this.balance = Math.min(this.balance, 12 * Math.max(this.ref.tax, 1e6));
    const wasCrisis = this.crisis;
    this.crisis = this.balance < 0 ? true : this.balance > 3 * this.ref.tax ? false : this.crisis; // hysteresis
    if (this.crisis && !wasCrisis) this.pushEvent('crisis', 'Budget crisis: lost gambling revenue plus programme costs exhausted the fiscal reserve. Political resistance jumps.');
    this.R += (this.resistanceTarget() - this.R) / P.tau_resistance;
    // treatment capacity
    this.C += (a.capacityTarget - this.C) / P.tau_capacity;
    // illegal channel
    const enfEffect = 1 - 0.9 * (e.enforcement / 100 - 0.3);
    const iT = clamp(
      P.illegalBase * enfEffect + P.illegalTaxSlope * Math.max(0, e.taxRate / 100 - 0.2) +
      0.04 * e.stakeLimits + 0.03 * e.depositLimits + 0.06 * e.affordability + 0.05 * e.inPlayBan +
      0.03 * (e.adBan / 2) + 0.6 * e.prohibition * Math.max(0.2, enfEffect),
      0.01, 0.95);
    this.I += (iT - this.I) / P.illegalTau;
  }

  private record(a: ReturnType<Simulation['aggregate']>) {
    const n = this.n;
    const counts = a.counts.map((c) => c / n);
    this.history.push({
      month: this.month,
      counts,
      target: counts[MR] + counts[PG],
      harm: a.harmPerCap * 1000,
      harmByGroup: a.harmByGroup,
      ggrLegal: a.legal,
      ggrIllegal: a.illegal,
      tax: a.tax,
      programCost: a.programCost,
      atRiskRevenueShare: a.atRiskShare,
      acceptance: this.A,
      awareness: this.W,
      influence: this.L,
      dependency: this.D,
      resistance: this.R,
      illegalShare: (a.legal + a.illegal) > 0 ? a.illegal / (a.legal + a.illegal) : 0,
      budgetBalance: this.balance,
      queue: a.queue,
      capacity: this.C,
      sudAmongPG: a.sudAmongPG,
      affectedOthers: a.affected,
      crisis: this.crisis,
    });
  }

  // ---------------------------------------------------------------- events ("why did that happen?")
  private pushEvent(kind: string, text: string) { this.events.push({ month: this.month, kind, text }); }
  private once(key: string, cond: boolean, kind: string, text: string) {
    if (cond && !this.flags[key]) { this.flags[key] = true; this.pushEvent(kind, text); }
    if (!cond && this.flags[key] && key.endsWith('~')) this.flags[key] = false;
  }
  private detectEvents() {
    const h = this.history, r = h[h.length - 1], r0 = h[0];
    if (!r || !r0) return;
    this.once('illegal20', r.illegalShare > 0.25, 'illegal',
      `Illegal channel above 25% of spend. Tax, limits or prohibition pushed play offshore, where there is no tax and no protection (Fixes that Fail).`);
    this.once('queue', r.queue > Math.max(r.capacity, 2 * r0.queue) && r.queue > 0, 'queue',
      `Treatment waiting list now exceeds the number of treatment slots. Help-seeking rose faster than slots can be built (capacity has a ~12-month delay).`);
    this.once('resist', r.resistance > 0.6, 'resistance',
      `Political resistance above 60%. Fiscal dependency, earmarking and industry influence are now blocking most of your reforms (Policy Resistance).`);
    this.once('down20', r.target < r0.target * 0.8, 'progress',
      `Moderate + problem gambling down 20% from the start. Note how long it took: policy delays plus slow-moving social norms.`);
    this.once('up20', r.target > r0.target * 1.2, 'worse',
      `Moderate + problem gambling up 20% from the start. Check the reinforcing loops: peer contagion and normalization.`);
    this.once('acc', Math.abs(r.acceptance - r0.acceptance) > 0.1, 'norms',
      `Social acceptance has moved by more than 10 points. This slow stock now amplifies (or dampens) every other lever.`);
    this.once('taxdrop', r.tax < r0.tax * 0.7 && r0.tax > 0, 'fiscal',
      `Tax revenue down 30%. Harm reduction shrinks the tax base, and a levy-funded treatment budget shrinks with it (Shifting the Burden).`);
    const fewPGButHarm = r.harmByGroup[0] + r.harmByGroup[1] > r.harmByGroup[2];
    this.once('paradox', fewPGButHarm && this.month > 3, 'paradox',
      `Prevention paradox: low- and moderate-risk gamblers now carry more total harm than problem gamblers, simply because there are many more of them.`);
  }

  // ---------------------------------------------------------------- render helpers
  /** Packed per-agent render info: bits 0-2 state, bit 3 illegal, bit 4 substance disorder, bit 5 waiting. */
  renderBuffer(out?: Uint8Array): Uint8Array {
    const b = out ?? new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++)
      b[i] = this.state[i] | (this.illegal[i] << 3) | ((this.alc[i] | this.drug[i]) << 4) | (this.waiting[i] << 5);
    return b;
  }
}
