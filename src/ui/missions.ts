import type { Row } from '../model/sim';
import type { InterventionKey } from '../model/levers';
import { HILDA, PARAMS } from '../params';

export type MissionStatus = { state: 'active' | 'ok' | 'fail'; text: string };
export interface Mission {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  /** Interventions the player may use; the others are locked. */
  allowed?: InterventionKey[];
  check: (h: Row[]) => MissionStatus;
}

const ADULTS = PARAMS.adultPopulation.value;
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const k = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : `${Math.round(x / 1e3)}k`);
const bn = (x: number) => `$${(x / 1e9).toFixed(1)}bn`;
const avg = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length);
const yr = (m: number) => 2018 + Math.floor(m / 12);
/** Share of at-risk adults who leave risk per year. */
const exitRate = (rows: Row[]) => avg(rows, (r) => r.outflow) / Math.max(1, avg(rows, (r) => r.target) * ADULTS);

export const MISSIONS: Mission[] = [
  {
    id: 'goal1', title: 'Goal 1 · Fewer adults entering risk',
    brief: 'Using only the ad ban and the anti-gambling campaign, cut the number of adults who become at risk each year by 30% — by 2030.',
    teaches: 'Prevention works on the inflow. It is slow, because social acceptance is a stock that takes years to move, but it is the only goal that shrinks the stock for good.',
    allowed: ['adBan', 'campaign'],
    check: (h) => {
      if (h.length < 13) return { state: 'active', text: 'Collecting a baseline (first year)…' };
      const base = avg(h.slice(0, 13), (r) => r.inflow), now = avg(h.slice(-12), (r) => r.inflow), m = h.length - 1;
      if (now <= base * 0.7 && m <= 144) return { state: 'ok', text: `Done in ${yr(m)}: new at-risk adults ${k(base)} → ${k(now)} per year.` };
      if (m > 144) return { state: 'fail', text: `2030 passed at ${k(now)}/yr (needed ≤ ${k(base * 0.7)}). The online boom pushes the other way.` };
      return { state: 'active', text: `${yr(m)}: ${k(now)} new at-risk adults/yr — target ≤ ${k(base * 0.7)}` };
    },
  },
  {
    id: 'goal2', title: 'Goal 2 · Less harm',
    brief: 'Using only affordability checks and recovery support programs, bring the social cost of harm 25% below where it started, within 10 years.',
    teaches: 'Harm reduction acts on people already at risk. Affordability checks protect the heaviest losers\' money; recovery support moves people down the risk ladder. Both cut tax revenue, which funds services (watch government spend).',
    allowed: ['affordability', 'support'],
    check: (h) => {
      const r0 = h[0]; if (!r0) return { state: 'active', text: '' };
      const now = avg(h.slice(-12), (r) => r.socialCost * 12), m = h.length - 1, start = r0.socialCost * 12;
      if (h.length > 12 && now <= start * 0.75 && m <= 120) return { state: 'ok', text: `Done in ${yr(m)}: social cost ${bn(start)} → ${bn(now)} a year.` };
      if (m > 120) return { state: 'fail', text: `2028 passed at ${bn(now)} a year (needed ≤ ${bn(start * 0.75)}). Try them together.` };
      return { state: 'active', text: `${yr(m)}: social cost ${bn(now)}/yr — target ≤ ${bn(start * 0.75)}` };
    },
  },
  {
    id: 'goal3', title: 'Goal 3 · More people recovering',
    brief: 'Using only the anti-gambling campaign and recovery support programs, raise the share of at-risk adults who leave risk each year by 25% within 8 years.',
    teaches: 'The outflow depends on help-seeking and on treatment & counselling capacity. More help-seeking without more places just builds a waiting list, and capacity takes about a year to build.',
    allowed: ['campaign', 'support'],
    check: (h) => {
      if (h.length < 13) return { state: 'active', text: 'Collecting a baseline (first year)…' };
      const base = exitRate(h.slice(0, 13)), now = exitRate(h.slice(-12)), m = h.length - 1;
      if (now >= base * 1.25 && m <= 96) return { state: 'ok', text: `Done in ${yr(m)}: ${pct(base)} → ${pct(now)} of at-risk adults leave risk per year.` };
      if (m > 96) return { state: 'fail', text: `2026 passed at ${pct(now)}/yr (needed ≥ ${pct(base * 1.25)}). Check the treatment queue.` };
      return { state: 'active', text: `${yr(m)}: ${pct(now)} of at-risk adults leave risk per year — target ≥ ${pct(base * 1.25)}` };
    },
  },
  {
    id: 'all', title: 'All four · Back to 2018',
    brief: 'With all four interventions available, get at-risk gambling below the 2018 level (7.3%) and keep it there for 24 months.',
    teaches: 'No single intervention is enough against the online boom. Prevention, harm reduction and recovery work on different parts of the stock, and their delays add up.',
    check: (h) => {
      const w = winStatus(h);
      if (w.won) return { state: 'ok', text: `Done: 24 months below ${pct(HILDA[2018].total)}.` };
      const r = h[h.length - 1]; if (!r) return { state: 'active', text: '' };
      return { state: 'active', text: `At risk ${pct(r.target)} (< ${pct(HILDA[2018].total)}) · ${w.streak} of 24 months below` };
    },
  },
];

/** Overall win: at-risk gambling back below the 2018 HILDA level for 24 months. */
export function winStatus(h: Row[]): { won: boolean; streak: number } {
  let streak = 0;
  for (let i = h.length - 1; i >= 1; i--) {
    if (h[i].target < HILDA[2018].total) streak++; else break;
  }
  return { won: streak >= 24, streak };
}
