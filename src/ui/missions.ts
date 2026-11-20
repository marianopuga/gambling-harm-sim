import type { Row } from '../model/sim';
import type { Levers } from '../model/levers';
import { HILDA } from '../params';

export type MissionStatus = { state: 'active' | 'ok' | 'fail'; text: string };
export interface Mission {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  scenario: string;
  /** Lever groups or lever keys the player may use; others are locked. */
  allowed?: string[];
  check: (h: Row[]) => MissionStatus;
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const k = (x: number) => (x >= 1e6 ? `${(x / 1e6).toFixed(2)}M` : `${Math.round(x / 1e3)}k`);
const avg = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length);
const yr = (m: number) => 2018 + Math.floor(m / 12);

export const MISSIONS: Mission[] = [
  {
    id: 'entry', title: 'Goal 3 · The tobacco playbook',
    brief: 'Using only advertising and age rules, cut the number of adults who start being at risk each year by 30% — by 2030.',
    teaches: 'Prevention works on the inflow. It is slow (a generation, like tobacco) but it is the only goal that shrinks the stock for good.',
    scenario: 'status-quo', allowed: ['marketing', 'adBan', 'ageVerification'],
    check: (h) => {
      if (h.length < 25) return { state: 'active', text: 'Collecting a baseline (first 2 years)…' };
      const base = avg(h.slice(1, 25), (r) => r.inflow), now = avg(h.slice(-12), (r) => r.inflow), m = h.length - 1;
      if (now <= base * 0.7 && m <= 144) return { state: 'ok', text: `Done in ${yr(m)}: new at-risk adults ${k(base)} → ${k(now)} per year.` };
      if (m > 144) return { state: 'fail', text: `2030 passed at ${k(now)}/yr (needed ≤ ${k(base * 0.7)}). Notice how slowly acceptance moves.` };
      return { state: 'active', text: `${yr(m)}: ${k(now)} new at-risk adults/yr — target ≤ ${k(base * 0.7)}` };
    },
  },
  {
    id: 'escalation', title: 'Goal 1 · Catch it early',
    brief: 'Using only Health & social levers, cut escalations (low → moderate → high) by 30% within 8 years.',
    teaches: 'Early detection acts where most people are: the low-risk group. Watch the treatment queue — help-seeking can outrun capacity.',
    scenario: 'status-quo', allowed: ['Health & social'],
    check: (h) => {
      if (h.length < 25) return { state: 'active', text: 'Collecting a baseline (first 2 years)…' };
      const base = avg(h.slice(1, 25), (r) => r.escalations), now = avg(h.slice(-12), (r) => r.escalations), m = h.length - 1;
      if (now <= base * 0.7 && m <= 96) return { state: 'ok', text: `Done in ${yr(m)}: escalations ${k(base)} → ${k(now)} per year.` };
      if (m > 96) return { state: 'fail', text: `2026 passed at ${k(now)}/yr (needed ≤ ${k(base * 0.7)}).` };
      return { state: 'active', text: `${yr(m)}: ${k(now)} escalations/yr — target ≤ ${k(base * 0.7)}` };
    },
  },
  {
    id: 'severity', title: 'Goal 2 · Reduce severity',
    brief: 'Using Regulation levers, bring moderate + high-risk gambling 30% below its 2018 level within 10 years, without the offshore channel passing 25%.',
    teaches: 'Loss limits cut harm fast for those already at risk — but only in licensed channels (Fixes that Fail).',
    scenario: 'status-quo', allowed: ['Regulation'],
    check: (h) => {
      const r0 = h[0]; if (!r0) return { state: 'active', text: '' };
      const now = avg(h.slice(-6), (r) => r.modHigh), ill = avg(h.slice(-6), (r) => r.illegalShare), m = h.length - 1;
      if (now <= r0.modHigh * 0.7 && ill < 0.25 && m <= 120) return { state: 'ok', text: `Done in ${yr(m)}: ${pct(r0.modHigh)} → ${pct(now)}, offshore ${pct(ill)}.` };
      if (m > 120) return { state: 'fail', text: `2028 passed at ${pct(now)} (needed ≤ ${pct(r0.modHigh * 0.7)}).` };
      return { state: 'active', text: `${yr(m)}: moderate + high ${pct(now)} — target ≤ ${pct(r0.modHigh * 0.7)} · offshore ${pct(ill)}` };
    },
  },
  {
    id: 'who-pays', title: 'Who pays?',
    brief: 'Start in the revenue-dependent state. Halve high-risk gambling while keeping tax at ≥ 70% of the start and avoiding a budget crisis.',
    teaches: 'Fiscal capture (R3), lobbying (R4), and why phasing reforms matters when the budget depends on harm.',
    scenario: 'captured',
    check: (h) => {
      const r0 = h[0]; if (!r0) return { state: 'active', text: '' };
      const pg0 = r0.counts[4], pg = avg(h.slice(-12), (r) => r.counts[4]), tax = avg(h.slice(-12), (r) => r.tax);
      if (h.some((r) => r.crisis)) return { state: 'fail', text: 'Budget crisis triggered. Try slower, phased changes or replace revenue first.' };
      if (h.length > 24 && pg <= pg0 * 0.5 && tax >= r0.tax * 0.7) return { state: 'ok', text: `High risk ${pct(pg0)} → ${pct(pg)} with tax at ${Math.round(tax / r0.tax * 100)}% of start.` };
      return { state: 'active', text: `High risk: ${pct(pg)} (target ≤ ${pct(pg0 * 0.5)}) · Tax: ${Math.round(tax / r0.tax * 100)}% of start (≥ 70%)` };
    },
  },
  {
    id: 'ban', title: 'Ban it all?',
    brief: 'Start under prohibition. Get at-risk gambling below the 2018 level AND the offshore channel under 25% of spend.',
    teaches: 'Fixes that Fail: prohibition without enforcement pushes play to operators with no protections.',
    scenario: 'prohibition',
    check: (h) => {
      const r = h[h.length - 1]; if (!r) return { state: 'active', text: '' };
      const target = avg(h.slice(-12), (x) => x.target), ill = avg(h.slice(-12), (x) => x.illegalShare);
      const ref = HILDA[2018].total;
      if (h.length > 24 && target < ref && ill < 0.25) return { state: 'ok', text: `At risk ${pct(target)} and offshore share ${pct(ill)}.` };
      return { state: 'active', text: `At risk ${pct(target)} (< ${pct(ref)}) · Offshore ${pct(ill)} (< 25%)` };
    },
  },
];

/** Overall win: at-risk gambling back below the 2018 HILDA level for 24 months, with no crisis and a small offshore channel. */
export function winStatus(h: Row[]): { won: boolean; streak: number } {
  let streak = 0;
  for (let i = h.length - 1; i >= 1; i--) {
    const r = h[i];
    if (r.target < HILDA[2018].total && !r.crisis && r.illegalShare < 0.25) streak++; else break;
  }
  return { won: streak >= 24, streak };
}

export type { Levers };
