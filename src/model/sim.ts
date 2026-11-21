import { defaultParamValues, type ParamValues } from '../params';
import { type Levers } from './levers';
import { clamp, hazardToProb, mulberry32 } from './rng';
import { REGION_AVAILABILITY, project, sampleHome } from '../geo/australia';

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
  /** Month from which the chosen interventions apply (0 = Jan 2018). Before it, history runs on the starting levers. */
  policyStart?: number;
}

export interface SimEvent { month: number; kind: string; text: string }

/** Calendar: month 0 of a run is January 2018 (first HILDA reference wave). */
export const START_YEAR = 2018;
export const AT_RISK = (s: number) => s === LR || s === MR || s === PG || s === TX;
/** Spend per state, in multiples of the base spend (in treatment and in recovery people have stopped). */
const SPEND_STATE = [0, 1, 3, 8, 25, 0, 0];

/**
 * One row of history per month. Every field is a variable of the causal loop diagram
 * (plus the social cost of harm, kept from the original model).
 */
export interface Row {
  month: number;
  counts: number[]; // per state, as shares of population
  // the stock and its flows
  target: number; // At-risk gamblers: low + moderate + high (incl. in treatment), share of adults
  modHigh: number; // moderate + high share
  regionAtRisk: number[]; // at-risk share by state (NSW, VIC, QLD, WA, SA, TAS, ACT, NT)
  inflow: number; // Entering at-risk gambling, people / year
  outflow: number; // Exit from risk, people / year
  escalations: number; // low → moderate → high, people / year
  helpAdmissions: number; // starting treatment, people / year
  // market & social norms
  acceptance: number; // Social acceptance, 0-1
  exposure: number; // Exposure to gambling, index (2018 = 1)
  marketing: number; // Marketing exposure, index (2018 = 1)
  accessibility: number; // Gambling accessibility, index (2018 = 1)
  participation: number; // Gambling participation, share of adults who gamble
  expenditure: number; // Gambling expenditure (losses), AUD / month
  operatorRevenue: number; // AUD / month, after tax
  atRiskRevenueShare: number; // share of expenditure from at-risk gamblers
  // individual harm (averages over at-risk gamblers)
  intensity: number; // Gambling intensity, index (2018 = 1)
  losses: number; // Gambling losses per at-risk gambler, AUD / month
  financialStress: number; coping: number; distress: number; conflict: number; isolation: number; // 0-1
  harm: number; // Gambling-related harm, harm units per 1,000 adults (weights 1:3:10)
  harmByGroup: [number, number, number]; // low, moderate, high (per 1,000 adults)
  socialCost: number; // AUD / month = harm units × cost per unit
  // government & public response
  tax: number; // Gambling tax revenue, AUD / month
  govSpend: number; // Government spend on harm services, AUD / month
  programCost: number; // intervention budgets (campaign + recovery programs), AUD / month
  awareness: number; // Awareness of harm, 0-1
  helpSeeking: number; // Help-seeking, multiplier (2018 = 1)
  pressure: number; // Public pressure to reform, 0-1
  regulation: number; // Regulatory strength, 0-1
  capacity: number; // Treatment & counselling capacity, places (people)
  queue: number; // people waiting for treatment
  // interventions in effect (0-1)
  adBanCoverage: number; campaign: number; affordability: number; support: number;
}

type Agg = ReturnType<Simulation['aggregate']>;
interface InEffect { adCov: number; camp: number; aff: number; sup: number; threshold: number }

const AD_STAGES = [
  '',
  'Ad ban, stage 1: inducements and bonus bets are banned.',
  'Ad ban, stage 2: gambling ads on social media are banned.',
  'Ad ban, stage 3: TV, radio and online display ads are banned.',
  'Ad ban complete: sport sponsorship ends. Marketing exposure drops to a small fraction of its old level.',
];
/** Cumulative share of marketing exposure removed once each stage is in force. */
const AD_COVERAGE = [0, 0.2, 0.5, 0.8, 1];

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
  male: Uint8Array;
  region: Uint8Array;
  px: Float32Array; // projected map position in [0,1]
  py: Float32Array;
  income: Float32Array; // AUD / month
  covered: Uint8Array; // play covered by affordability checks (online / carded)
  loss: Float32Array; // gambling losses, AUD / month
  fs: Float32Array; // financial stress 0-1
  cope: Float32Array; // gambling as coping 0-1
  dist: Float32Array; // emotional distress 0-1
  conf: Float32Array; // family conflict 0-1
  iso: Float32Array; // social isolation 0-1
  waiting: Uint8Array;
  waitSince: Int32Array;
  // network (CSR) and layout
  nbrStart: Int32Array;
  nbr: Int32Array;
  longLinks: Int32Array; // pairs of rewired long-range ties (for drawing)
  network: NetworkKind;
  policyStart: number;
  private flow = { inflow: 0, outflow: 0, esc: 0, help: 0 };

  // system-level stocks (diagram variables)
  SA: number; // social acceptance
  M = 0.5; // marketing exposure (0.5 = 2018)
  AW = 0.3; // awareness of harm
  PP = 0.3; // public pressure to reform
  RS = 0.3; // regulatory strength
  GS = 0; // government spend on harm services, AUD / month
  TC = 0; // treatment & counselling capacity, places
  adCov = 0; // share of advertising banned
  private adBanSince = -1;
  private adStage = 0;
  private eff = { campaign: [0, 0, 0], affordability: [0, 0, 0], support: [0, 0, 0] };
  private initialLevers: Levers;
  // references frozen at the end of burn-in (the 2018 status quo)
  // per-state means of the harm cluster, so a person's multipliers compare them with others in the same risk state
  private ref = { part: 0.62, OR: 1, H: 1, cov: 1, intensity: 1, tax: 1, cope: new Float64Array(STATE_COUNT), iso: new Float64Array(STATE_COUNT), fs: new Float64Array(STATE_COUNT) };
  private burning = false;
  private flags: Record<string, boolean> = {};
  private lastAgg: Agg | null = null;

  constructor(opts: SimOptions) {
    this.n = opts.n;
    this.P = { ...defaultParamValues(), ...(opts.params ?? {}) } as ParamValues;
    this.scale = this.P.adultPopulation / this.n;
    this.rand = mulberry32(opts.seed);
    this.levers = { ...opts.levers };
    this.initialLevers = { ...opts.levers };
    this.network = opts.network ?? 'smallworld';
    this.policyStart = Math.max(0, opts.policyStart ?? 0);
    this.SA = this.P.acceptanceAnchor;
    const n = this.n;
    this.state = new Uint8Array(n);
    this.prev = new Uint8Array(n);
    this.age = new Float32Array(n);
    this.vuln = new Float32Array(n);
    this.male = new Uint8Array(n);
    this.region = new Uint8Array(n);
    this.px = new Float32Array(n);
    this.py = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const h = sampleHome(this.rand);
      const [x, y] = project([h.lon, h.lat]);
      this.px[i] = x; this.py[i] = y; this.region[i] = h.region;
    }
    this.income = new Float32Array(n);
    this.covered = new Uint8Array(n);
    this.loss = new Float32Array(n);
    this.fs = new Float32Array(n);
    this.cope = new Float32Array(n);
    this.dist = new Float32Array(n);
    this.conf = new Float32Array(n);
    this.iso = new Float32Array(n);
    this.waiting = new Uint8Array(n);
    this.waitSince = new Int32Array(n);
    const net = this.buildNetwork();
    this.nbrStart = net.start; this.nbr = net.list; this.longLinks = net.long;

    // initial distribution ≈ 2018 status-quo steady state (HILDA 2018: 3.7% low, 2.5% moderate, 1.1% high risk)
    const init = [0.37, 0.552, 0.037, 0.025, 0.011, 0.0007, 0.0023];
    for (let i = 0; i < n; i++) this.spawn(i, true, init);

    if (opts.burnIn !== false) this.burnIn();
    else this.freezeRefs(this.aggregate());
  }

  // ---------------------------------------------------------------- setup
  /** Spatial social network: each adult knows their ~6 nearest neighbours on the map; 'smallworld' rewires 5% to anywhere (family, work, online). */
  private buildNetwork() {
    const n = this.n, rnd = this.rand, k = 6;
    const adj: number[][] = Array.from({ length: n }, () => []);
    const long: number[] = [];
    const link = (a: number, b: number) => { if (a !== b && !adj[a].includes(b)) { adj[a].push(b); adj[b].push(a); } };
    const G = 64, cell = new Map<number, number[]>();
    const key = (x: number, y: number) => y * G + x;
    const cx = (v: number) => Math.min(G - 1, Math.max(0, Math.floor(v * G)));
    for (let i = 0; i < n; i++) { const kk = key(cx(this.px[i]), cx(this.py[i])); (cell.get(kk) ?? cell.set(kk, []).get(kk)!).push(i); }
    for (let i = 0; i < n; i++) {
      const x0 = cx(this.px[i]), y0 = cx(this.py[i]);
      let cand: number[] = [];
      for (let r = 1; r < G && cand.length < k + 1; r++) {
        cand = [];
        for (let y = y0 - r; y <= y0 + r; y++) for (let x = x0 - r; x <= x0 + r; x++) { const c = cell.get(key(x, y)); if (c) cand.push(...c); }
      }
      const d = (j: number) => (this.px[j] - this.px[i]) ** 2 + (this.py[j] - this.py[i]) ** 2;
      cand = cand.filter((j) => j !== i).sort((a, b) => d(a) - d(b)).slice(0, k);
      for (const j0 of cand) {
        let j = j0;
        if (this.network === 'smallworld' && rnd() < 0.05) { j = Math.floor(rnd() * n); long.push(i, j); }
        link(i, j);
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
    const r = this.rand, P = this.P;
    this.age[i] = initial ? 18 + r() * 67 : 18;
    const z = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    this.vuln[i] = Math.exp(0.45 * z - 0.45 * 0.45 / 2); // lognormal vulnerability with mean 1
    this.male[i] = r() < 0.49 ? 1 : 0;
    const z2 = Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
    this.income[i] = P.incomeMedian * Math.exp(0.6 * z2) * (initial ? 1 : 0.6); // new adults earn less
    this.covered[i] = r() < P.affordabilityCoverage ? 1 : 0;
    let s = NG;
    if (dist) { let acc = 0; const v = r(); for (let k = 0; k < STATE_COUNT; k++) { acc += dist[k]; if (v < acc) { s = k; break; } } }
    else s = r() < 0.35 ? NR : NG; // some 18-year-olds already gamble
    this.state[i] = s;
    this.loss[i] = 0; this.fs[i] = 0; this.cope[i] = 0; this.dist[i] = 0; this.conf[i] = 0; this.iso[i] = 0;
    this.waiting[i] = 0;
  }

  // ---------------------------------------------------------------- drivers
  /** Exogenous online and sports-betting boom (2018 →): raises accessibility and marketing, 0..trendYears×rate. */
  trend(): number { return this.burning ? 0 : (this.P.trendPerYear / 100) * Math.min(this.month / 12, this.P.trendYears); }
  /** Gambling accessibility (0.5 = 2018): the online boom raises it, regulatory strength cuts it (B1). */
  accessibility(T = this.trend()): number { return clamp(0.5 + T - this.P.a_regulation * (this.RS - 0.3), 0.05, 2); }

  setLevers(l: Levers) { this.levers = { ...l }; }

  /** Interventions in effect this month: the ad-ban phase-out schedule, plus a third-order delay for the other three. */
  private interventions(): InEffect {
    const P = this.P;
    // burn-in settles the 2018 status quo: no interventions
    if (this.burning) return { adCov: 0, camp: 0, aff: 0, sup: 0, threshold: this.levers.affordabilityThreshold };
    const L = this.month < this.policyStart ? this.initialLevers : this.levers;
    // ad ban: stage 1 now, then one stage every third of the phase-out, sponsorship last
    if (L.adBan) { if (this.adBanSince < 0) this.adBanSince = this.month; } else this.adBanSince = -1;
    let stage = 0;
    if (this.adBanSince >= 0) {
      const len = Math.max(1, L.adBanYears) * 12;
      stage = 1 + Math.min(3, Math.floor((this.month - this.adBanSince) / (len / 3)));
    }
    if (stage > this.adStage) this.pushEvent('policy', AD_STAGES[stage]);
    this.adStage = stage;
    this.adCov += (AD_COVERAGE[stage] - this.adCov) * 0.5;
    const rate = Math.min(1, 3 / P.policyDelay);
    const delay = (k: 'campaign' | 'affordability' | 'support', on: boolean) => {
      const s = this.eff[k];
      s[0] += ((on ? 1 : 0) - s[0]) * rate; s[1] += (s[0] - s[1]) * rate; s[2] += (s[1] - s[2]) * rate;
      return s[2];
    };
    return {
      adCov: this.adCov,
      camp: delay('campaign', L.campaign),
      aff: delay('affordability', L.affordability),
      sup: delay('support', L.support),
      threshold: L.affordabilityThreshold,
    };
  }

  // ---------------------------------------------------------------- lifecycle
  private burnIn() {
    this.burning = true;
    const months = this.P.burnInMonths;
    // average the flows over the last burn-in year so the opening month already shows yearly flows
    const acc = { inflow: 0, outflow: 0, esc: 0, help: 0 }, tail = Math.min(12, months);
    for (let t = 0; t < months; t++) {
      this.step();
      if (t >= months - tail) { acc.inflow += this.flow.inflow; acc.outflow += this.flow.outflow; acc.esc += this.flow.esc; acc.help += this.flow.help; }
    }
    this.flow = { inflow: acc.inflow / tail, outflow: acc.outflow / tail, esc: acc.esc / tail, help: acc.help / tail };
    this.burning = false;
    this.freezeRefs(this.lastAgg!);
    this.month = 0;
    this.history = [];
    this.events = [];
    this.flags = {};
    this.record(this.lastAgg!, this.interventions());
  }

  /** The 2018 status quo becomes the reference point every multiplier is centred on. */
  private freezeRefs(a: Agg) {
    this.trackRefs(a);
    this.SA = this.P.acceptanceAnchor; this.M = 0.5; this.AW = 0.3; this.PP = 0.3; this.RS = 0.3;
    this.GS = this.P.servicesShare * a.tax;
    this.TC = this.GS / this.P.costPerPlace;
    this.ref.cov = this.TC / Math.max(1, a.severe);
  }
  private trackRefs(a: Agg) {
    this.ref.part = a.participation; this.ref.OR = Math.max(1, a.operatorRevenue); this.ref.tax = Math.max(1, a.tax); this.ref.H = Math.max(1e-9, a.harmPerCap);
    this.ref.cope.set(a.copeByState); this.ref.iso.set(a.isoByState); this.ref.fs.set(a.fsByState);
    this.ref.intensity = Math.max(1e-9, a.intensityRaw);
  }

  // ---------------------------------------------------------------- one month
  step() {
    const P = this.P, rnd = this.rand, n = this.n;
    const iv = this.interventions();
    const T = this.trend();
    const A = this.accessibility(T);
    const cA = A - 0.5, cM = this.M - 0.5, cE = this.SA - P.acceptanceAnchor;
    // market & social norms → starting, quitting, entering risk, relapse
    // accessibility mostly changes how intensely people gamble; its effect on who starts is smaller
    const startG = Math.exp(0.15 * P.b_accessibility * cA + P.b_marketing * cM + P.b_exposure * cE);
    const quitG = Math.exp(-0.5 * P.b_exposure * cE);
    const escG = P.escalationScale * Math.exp(0.45 * P.b_marketing * cM + 0.4 * P.b_accessibility * cA + 0.4 * P.b_exposure * cE);
    const relapseG = Math.exp(P.b_accessibility * cA + 0.5 * P.b_marketing * cM);
    const youngMale = Math.exp(P.b_youngMenMarketing * cM);
    // treatment & counselling coverage relative to 2018: lowers harm by speeding de-escalation (TC → harm −)
    const severe = this.lastAgg ? this.lastAgg.severe : 1;
    const covRel = this.burning ? 1 : this.TC / Math.max(1, severe) / Math.max(1e-9, this.ref.cov);
    const covBoost = (1 + P.k_coverage * clamp(covRel - 1, -0.6, 3)) * (1 + P.supportBreadth * iv.sup);
    const deescG = P.recoveryScale * Math.exp(-0.3 * P.b_accessibility * cA);
    // help-seeking: awareness, the campaign (asking for help is normal) and helplines
    const helpG = Math.exp(P.b_awarenessHelp * (this.AW - 0.3)) * (1 + P.campaignHelp * iv.camp) * (1 + P.supportHelplines * iv.sup);
    const flow = this.flow; flow.inflow = flow.outflow = flow.esc = flow.help = 0;
    const ref = this.ref;

    this.prev.set(this.state);
    const prev = this.prev, st = this.state;

    for (let i = 0; i < n; i++) {
      // ageing & generational turnover
      this.age[i] += 1 / 12;
      if (this.age[i] >= 85) { this.spawn(i, false); continue; }

      // friends who gamble (exposure through the social network)
      let g = 0;
      const a0 = this.nbrStart[i], a1 = this.nbrStart[i + 1];
      for (let q = a0; q < a1; q++) { const s = prev[this.nbr[q]]; if (s >= NR && s <= PG) g++; }
      const peerG = g / Math.max(1, a1 - a0) - ref.part;

      // the person's own harm cluster shapes their transitions (compared with 2018 people in the same state)
      const s0 = prev[i];
      const copeM = Math.exp(P.b_coping * (this.cope[i] - ref.cope[s0])); // gambling to cope → escalation
      const isoM = Math.exp(-P.b_isolation * (this.iso[i] - ref.iso[s0])); // isolation → slower exit
      const stressEsc = Math.exp(P.b_stress * (this.fs[i] - ref.fs[s0]));
      const stressDe = Math.exp(-P.b_stress * (this.fs[i] - ref.fs[s0])); // less money lost → easier to step down
      const helpIso = Math.exp(-0.5 * P.b_isolation * (this.iso[i] - ref.iso[s0]));
      const young = this.age[i] < 25 ? 1.5 : 1;
      const ym = this.male[i] === 1 && this.age[i] < 35;
      const sexEsc = (this.male[i] ? P.maleRisk : P.femaleRisk) * (ym ? P.youngMenRisk * youngMale : 1);
      const regAv = Math.exp(P.b_accessibility * 0.5 * (REGION_AVAILABILITY[this.region[i]] - 1));
      const escI = escG * this.vuln[i] * sexEsc * regAv * copeM;
      const deesc = deescG * isoM * stressDe;

      let s = s0;
      const u = rnd();
      switch (s0) {
        case NG: {
          const r = P.h_NG_NR * startG * young * regAv * (ym ? youngMale : 1) * Math.exp(P.b_peerStart * peerG);
          if (u < hazardToProb(r)) s = NR;
          break;
        }
        case NR: {
          const rq = P.h_NR_NG * quitG, ru = P.h_NR_LR * escI;
          const pt = hazardToProb(rq + ru);
          if (u < pt) s = u < pt * rq / (rq + ru) ? NG : LR;
          break;
        }
        case LR: {
          const rd = P.h_LR_NR * deesc, rq = P.h_LR_NG * quitG, ru = P.h_LR_MR * escI;
          const tot = rd + rq + ru, pt = hazardToProb(tot);
          if (u < pt) { const v = u / pt * tot; s = v < rd ? NR : v < rd + rq ? NG : MR; }
          break;
        }
        case MR: {
          const rd = P.h_MR_LR * deesc * covBoost, ru = P.h_MR_PG * P.pgScale * escI * stressEsc;
          const pt = hazardToProb(rd + ru);
          if (u < pt) s = u < pt * rd / (rd + ru) ? LR : PG;
          else if (!this.waiting[i] && rnd() < hazardToProb(P.h_MR_TX * helpG * helpIso)) { this.waiting[i] = 1; this.waitSince[i] = this.month; }
          break;
        }
        case PG: {
          const rd = P.h_PG_MR * deesc * covBoost;
          if (u < hazardToProb(rd)) s = MR;
          else if (!this.waiting[i] && rnd() < hazardToProb(P.h_PG_TX * helpG * helpIso)) { this.waiting[i] = 1; this.waitSince[i] = this.month; }
          break;
        }
        case TX: {
          const rs = P.h_TX_RC * (1 + P.supportBreadth * iv.sup), rf = P.h_TX_PG;
          const pt = hazardToProb(rs + rf);
          if (u < pt) s = u < pt * rs / (rs + rf) ? RC : PG;
          break;
        }
        case RC: {
          const rp = P.h_RC_PG * relapseG * sexEsc, rm = P.h_RC_MR * relapseG, rn = P.h_RC_NG;
          const tot = rp + rm + rn, pt = hazardToProb(tot);
          if (u < pt) { const v = u / pt * tot; s = v < rp ? PG : v < rp + rm ? MR : NG; }
          break;
        }
      }
      st[i] = s;
      if (s !== s0) {
        const was = AT_RISK(s0), now = AT_RISK(s);
        if (!was && now) flow.inflow++; else if (was && !now) flow.outflow++;
        if ((s0 === LR && s === MR) || (s0 === MR && s === PG)) flow.esc++;
      }
      if (this.waiting[i] && (s !== MR && s !== PG)) this.waiting[i] = 0;
      if (this.waiting[i] && this.month - this.waitSince[i] > 6 && rnd() < 0.1) this.waiting[i] = 0; // abandon queue

      this.personHarm(i, s, iv);
    }

    // treatment admissions (FIFO by waiting time, limited by treatment & counselling capacity)
    let inTx = 0;
    for (let i = 0; i < n; i++) if (st[i] === TX) inTx++;
    const free = this.TC / this.scale - inTx;
    let freeInt = Math.floor(free) + (rnd() < free - Math.floor(free) ? 1 : 0);
    if (freeInt > 0) {
      const waiting: number[] = [];
      for (let i = 0; i < n; i++) if (this.waiting[i]) waiting.push(i);
      waiting.sort((a, b) => this.waitSince[a] - this.waitSince[b]);
      for (const i of waiting) {
        if (freeInt-- <= 0) break;
        st[i] = TX; this.waiting[i] = 0; flow.help++;
      }
    }

    const agg = this.aggregate();
    this.lastAgg = agg;
    this.updateStocks(agg, iv, T);
    if (!this.burning) { this.month++; this.record(agg, iv); this.detectEvents(iv); }
  }

  /**
   * One person's harm cluster: intensity → losses → financial stress → gambling as coping → intensity (R3),
   * and harm → distress → family conflict → isolation → coping (R4). Affordability checks cap losses;
   * recovery support eases financial stress.
   */
  private personHarm(i: number, s: number, iv: InEffect) {
    const P = this.P;
    const sev = s === LR ? P.harm_LR : s === MR ? P.harm_MR : s === PG || s === TX ? P.harm_PG : 0;
    let loss = P.baseSpend * SPEND_STATE[s] * (1 + P.copingIntensity * this.cope[i]);
    if (iv.aff > 0 && this.covered[i] && loss > iv.threshold) {
      const allowed = Math.max(iv.threshold, P.affordableShare * this.income[i]);
      if (loss > allowed) loss -= iv.aff * (loss - allowed);
    }
    this.loss[i] = loss;
    let fsT = 1 - Math.exp(-(loss / this.income[i]) / P.stressScale);
    if (s === MR || s === PG || s === TX) fsT *= 1 - P.supportStress * iv.sup;
    this.fs[i] += (fsT - this.fs[i]) / P.tau_stress;
    this.dist[i] += (clamp(0.6 * sev / P.harm_PG + 0.4 * this.fs[i], 0, 1) - this.dist[i]) / P.tau_distress;
    this.conf[i] += (0.8 * this.dist[i] - this.conf[i]) / P.tau_conflict;
    this.iso[i] += (0.8 * this.conf[i] - this.iso[i]) / P.tau_isolation;
    this.cope[i] += (clamp(0.6 * this.fs[i] + 0.4 * this.iso[i], 0, 1) - this.cope[i]) / P.tau_coping;
  }

  // ---------------------------------------------------------------- aggregation
  private aggregate() {
    const P = this.P, n = this.n, scale = this.scale, st = this.state;
    const counts = new Array(STATE_COUNT).fill(0);
    let spend = 0, atRiskSpend = 0, units = 0, hLR = 0, hMR = 0, hPG = 0, queue = 0;
    let arN = 0, sFs = 0, sCope = 0, sDist = 0, sConf = 0, sIso = 0, spN = 0, sInt = 0, sLoss = 0;
    const regN = new Array(8).fill(0), regR = new Array(8).fill(0);
    const copeByState = new Float64Array(STATE_COUNT), isoByState = new Float64Array(STATE_COUNT), fsByState = new Float64Array(STATE_COUNT);
    for (let i = 0; i < n; i++) {
      const s = st[i];
      counts[s]++;
      copeByState[s] += this.cope[i]; isoByState[s] += this.iso[i]; fsByState[s] += this.fs[i];
      if (this.waiting[i]) queue++;
      const ar = AT_RISK(s);
      regN[this.region[i]]++; if (ar) regR[this.region[i]]++;
      spend += this.loss[i];
      if (s >= LR && s <= PG) { atRiskSpend += this.loss[i]; sLoss += this.loss[i]; sInt += SPEND_STATE[s] * (1 + P.copingIntensity * this.cope[i]); spN++; }
      if (ar) { arN++; sFs += this.fs[i]; sCope += this.cope[i]; sDist += this.dist[i]; sConf += this.conf[i]; sIso += this.iso[i]; }
      if (s === LR) { units += P.harm_LR; hLR += P.harm_LR; }
      else if (s === MR) { units += P.harm_MR; hMR += P.harm_MR; }
      else if (s === PG || s === TX) { units += P.harm_PG; hPG += P.harm_PG; }
    }
    const expenditure = spend * scale;
    const tax = expenditure * P.taxRate;
    const k = Math.max(1, arN);
    for (let s = 0; s < STATE_COUNT; s++) { const c = Math.max(1, counts[s]); copeByState[s] /= c; isoByState[s] /= c; fsByState[s] /= c; }
    return {
      counts, expenditure, tax, operatorRevenue: expenditure - tax, copeByState, isoByState, fsByState,
      atRiskShare: spend > 0 ? atRiskSpend / spend : 0,
      participation: (counts[NR] + counts[LR] + counts[MR] + counts[PG]) / n,
      severe: (counts[MR] + counts[PG] + counts[TX]) * scale,
      harmPerCap: units / n,
      harmByGroup: [hLR / n * 1000, hMR / n * 1000, hPG / n * 1000] as [number, number, number],
      socialCost: (units * scale * P.costPerHarmUnit) / 12,
      financialStress: sFs / k, coping: sCope / k, distress: sDist / k, conflict: sConf / k, isolation: sIso / k,
      intensityRaw: spN ? sInt / spN : 0, losses: spN ? sLoss / spN : 0,
      queue: queue * scale,
      regionAtRisk: regR.map((r, j) => (regN[j] ? r / regN[j] : 0)),
    };
  }

  private updateStocks(a: Agg, iv: InEffect, T: number) {
    const P = this.P;
    if (this.burning) { this.trackRefs(a); this.GS = P.servicesShare * a.tax; this.TC = this.GS / P.costPerPlace; return; }
    const ref = this.ref;
    // R1 and B1: participation makes gambling feel normal; public pressure and the campaign push it down (slow)
    const saT = clamp(P.acceptanceAnchor + P.a_participation * (a.participation - ref.part) - P.a_pressure * (this.PP - 0.3) - P.campaignAcceptance * iv.camp, 0, 1);
    this.SA += (saT - this.SA) / P.tau_acceptance;
    // R2: operators turn revenue into marketing; the online boom adds more; the ad ban removes it
    const mT = (0.5 + T) * Math.pow(Math.max(1e-6, a.operatorRevenue / ref.OR), P.m_revenue) * (1 - (1 - P.adBanResidual) * iv.adCov);
    this.M += (mT - this.M) / P.tau_marketing;
    // gambling-related harm → awareness (delay) → public pressure → regulatory strength (delay)
    const awT = clamp(0.3 * Math.pow(Math.max(1e-6, a.harmPerCap / ref.H), 0.7) + P.campaignAwareness * iv.camp + 0.05 * iv.sup, 0, 1);
    this.AW += (awT - this.AW) / P.tau_awareness;
    this.PP += (clamp(0.3 + (this.AW - 0.3), 0, 1) - this.PP) / P.tau_pressure;
    this.RS += (clamp(0.3 + (this.PP - 0.3), 0, 1) - this.RS) / P.tau_regulation;
    // gambling tax → government spend (budget delay) → treatment & counselling capacity (hiring delay); pressure adds funding
    const gsT = P.servicesShare * this.ref.tax * Math.pow(Math.max(1e-6, a.tax / this.ref.tax), P.govSpendElasticity) + iv.sup * P.supportBudget / 12;
    this.GS += (gsT - this.GS) / P.tau_govSpend;
    const tcT = (this.GS / P.costPerPlace) * Math.max(0, 1 + P.pressureCapacity * (this.PP - 0.3));
    this.TC += (tcT - this.TC) / P.tau_capacity;
  }

  private record(a: Agg, iv: InEffect) {
    const P = this.P, n = this.n, ref = this.ref;
    const counts = a.counts.map((c) => c / n);
    const exposure = Math.exp(P.b_exposure * (this.SA - P.acceptanceAnchor) + P.b_peerStart * (a.participation - ref.part));
    this.history.push({
      month: this.month,
      counts,
      target: counts[LR] + counts[MR] + counts[PG] + counts[TX],
      modHigh: counts[MR] + counts[PG],
      regionAtRisk: a.regionAtRisk,
      inflow: this.flow.inflow * this.scale * 12,
      outflow: this.flow.outflow * this.scale * 12,
      escalations: this.flow.esc * this.scale * 12,
      helpAdmissions: this.flow.help * this.scale * 12,
      acceptance: this.SA,
      exposure,
      marketing: this.M / 0.5,
      accessibility: this.accessibility() / 0.5,
      participation: a.participation,
      expenditure: a.expenditure,
      operatorRevenue: a.operatorRevenue,
      atRiskRevenueShare: a.atRiskShare,
      intensity: a.intensityRaw / ref.intensity,
      losses: a.losses,
      financialStress: a.financialStress, coping: a.coping, distress: a.distress, conflict: a.conflict, isolation: a.isolation,
      harm: a.harmPerCap * 1000,
      harmByGroup: a.harmByGroup,
      socialCost: a.socialCost,
      tax: a.tax,
      govSpend: this.GS,
      programCost: (iv.camp * P.campaignCost + iv.sup * P.supportBudget) / 12,
      awareness: this.AW,
      helpSeeking: Math.exp(P.b_awarenessHelp * (this.AW - 0.3)) * (1 + P.campaignHelp * iv.camp) * (1 + P.supportHelplines * iv.sup),
      pressure: this.PP,
      regulation: this.RS,
      capacity: this.TC,
      queue: a.queue,
      adBanCoverage: iv.adCov, campaign: iv.camp, affordability: iv.aff, support: iv.sup,
    });
  }

  // ---------------------------------------------------------------- events ("why did that happen?")
  private pushEvent(kind: string, text: string) { this.events.push({ month: this.month, kind, text }); }
  private once(key: string, cond: boolean, kind: string, text: string) {
    if (cond && !this.flags[key]) { this.flags[key] = true; this.pushEvent(kind, text); }
  }
  private detectEvents(iv: InEffect) {
    const h = this.history, r = h[h.length - 1], r0 = h[0];
    if (!r || !r0) return;
    const year = START_YEAR + Math.floor(this.month / 12);
    if (this.policyStart > 0) this.once('policy', this.month === this.policyStart, 'hilda',
      `January ${START_YEAR + this.policyStart / 12}: your interventions start now. Until today the model replayed the status quo.`);
    this.once('hilda22', this.month === 48, 'hilda',
      `January 2022: the model says ${(r.target * 100).toFixed(1)}% of adults are at risk. HILDA measured 9.8% in 2022 (4.9% low, 3.1% moderate, 1.8% high).`);
    this.once('camp', iv.camp > 0.5, 'policy',
      'The anti-gambling campaign is running. Social acceptance is a slow stock: expect years, not months, before fewer people start.');
    this.once('aff', iv.aff > 0.5, 'policy',
      `Affordability checks are in force: deposits stop for people losing more than $${this.levers.affordabilityThreshold.toLocaleString('en-AU')} a month who cannot afford it. Losses and financial stress fall first.`);
    this.once('sup', iv.sup > 0.5, 'policy',
      'Recovery support programs are funded ($150M a year). Treatment and counselling places take about a year to build.');
    this.once('queue', r.queue > Math.max(r.capacity, 2 * r0.queue) && r.queue > 0, 'queue',
      'The treatment waiting list now exceeds the number of treatment places. Help-seeking rose faster than places can be built (about a 12-month delay).');
    this.once('down20', r.target < r0.target * 0.8, 'progress',
      'At-risk gambling is down 20% from the start. Note how long it took: implementation delays plus slow-moving social norms.');
    this.once('up20', r.target > r0.target * 1.2, 'worse',
      'At-risk gambling is up 20% since the start. The online wagering boom feeds the reinforcing loops: more participation makes gambling feel normal (R1) and more revenue buys more marketing (R2).');
    this.once('reg', r.regulation > 0.35, 'norms',
      `${year}: public pressure has turned into stronger regulation, cutting gambling accessibility (B1). It took years: awareness, pressure and lawmaking are all slow.`);
    this.once('costtax', r.socialCost > 3 * r.tax && this.month > 1, 'fiscal',
      'The social cost of gambling harm is more than 3× the tax it brings in. The state collects the revenue; families, health and justice systems pay the cost.');
    this.once('acc', Math.abs(r.acceptance - r0.acceptance) > 0.05, 'norms',
      `Social acceptance has moved by more than 5 points (${Math.round(r0.acceptance * 100)} → ${Math.round(r.acceptance * 100)}). This slow stock now amplifies or dampens everything else.`);
    this.once('taxdrop', r.tax < r0.tax * 0.8 && r0.tax > 0, 'fiscal',
      'Tax revenue is down 20%. Less gambling means less tax, and the share of tax spent on harm services shrinks with it.');
    const lowModHarm = r.harmByGroup[0] + r.harmByGroup[1] > r.harmByGroup[2];
    this.once('paradox', lowModHarm && this.month > 3, 'paradox',
      'Prevention paradox: low- and moderate-risk gamblers now carry more total harm than high-risk gamblers, simply because there are many more of them.');
  }

  // ---------------------------------------------------------------- render helpers
  /** Packed per-agent render info: bits 0-2 state, bit 5 waiting for treatment, bit 6 man aged 18-34. */
  renderBuffer(out?: Uint8Array): Uint8Array {
    const b = out ?? new Uint8Array(this.n);
    for (let i = 0; i < this.n; i++)
      b[i] = this.state[i] | (this.waiting[i] << 5) | ((this.male[i] && this.age[i] < 35 ? 1 : 0) << 6);
    return b;
  }
}
