import type { Row } from '../model/sim';
import type { Levers } from '../model/levers';

export type MissionStatus = { state: 'active' | 'ok' | 'fail'; text: string };
export interface Mission {
  id: string;
  title: string;
  brief: string;
  teaches: string;
  scenario: string;
  /** Lever groups the player may use; others are locked. */
  allowedGroups?: string[];
  check: (h: Row[]) => MissionStatus;
}

const pct = (x: number) => `${(x * 100).toFixed(2)}%`;
const avg = (rows: Row[], f: (r: Row) => number) => rows.reduce((s, r) => s + f(r), 0) / Math.max(1, rows.length);

export const MISSIONS: Mission[] = [
  {
    id: 'slow-stock', title: '1 · The slow stock',
    brief: 'Using only Health & social levers, cut moderate + problem gambling by 30% within 10 years (120 months).',
    teaches: 'Delays, slow-moving social norms, and the limits of downstream (treatment-only) fixes.',
    scenario: 'status-quo', allowedGroups: ['Health & social'],
    check: (h) => {
      const base = h[0]?.target ?? 0, now = avg(h.slice(-6), (r) => r.target), m = h.length - 1;
      if (now <= base * 0.7 && m <= 120) return { state: 'ok', text: `Done in month ${m}: ${pct(base)} → ${pct(now)}` };
      if (m > 120) return { state: 'fail', text: `Month 120 passed at ${pct(now)} (needed ≤ ${pct(base * 0.7)}). Which loop held you back?` };
      return { state: 'active', text: `Month ${m}: ${pct(now)} — target ≤ ${pct(base * 0.7)}` };
    },
  },
  {
    id: 'who-pays', title: '2 · Who pays?',
    brief: 'Start in the fiscally captured state. Halve problem gambling while keeping annual tax revenue at ≥ 70% of the starting level and avoiding a budget crisis.',
    teaches: 'Fiscal capture (R3), lobbying (R4), and why phasing reforms matters when the budget depends on harm.',
    scenario: 'captured',
    check: (h) => {
      const r0 = h[0]; if (!r0) return { state: 'active', text: '' };
      const pg0 = r0.counts[4], pg = avg(h.slice(-12), (r) => r.counts[4]), tax = avg(h.slice(-12), (r) => r.tax);
      if (h.some((r) => r.crisis)) return { state: 'fail', text: 'Budget crisis triggered. Try slower, phased changes or replace revenue first.' };
      if (h.length > 24 && pg <= pg0 * 0.5 && tax >= r0.tax * 0.7) return { state: 'ok', text: `Problem gambling ${pct(pg0)} → ${pct(pg)} with tax at ${Math.round(tax / r0.tax * 100)}% of start.` };
      return { state: 'active', text: `Problem: ${pct(pg)} (target ≤ ${pct(pg0 * 0.5)}) · Tax: ${Math.round(tax / r0.tax * 100)}% of start (≥ 70%)` };
    },
  },
  {
    id: 'ban', title: '3 · Ban it all?',
    brief: 'Start under prohibition. Get moderate + problem gambling below the status-quo level AND the illegal channel under 25% of spend.',
    teaches: 'Fixes that Fail: prohibition without enforcement pushes play to operators with no protections.',
    scenario: 'prohibition',
    check: (h) => {
      const r = h[h.length - 1]; if (!r) return { state: 'active', text: '' };
      const target = avg(h.slice(-12), (x) => x.target), ill = avg(h.slice(-12), (x) => x.illegalShare);
      const ref = 0.046; // status-quo equilibrium (calibrated)
      if (h.length > 24 && target < ref && ill < 0.25) return { state: 'ok', text: `MR+PG ${pct(target)} and illegal share ${pct(ill)}.` };
      return { state: 'active', text: `MR+PG ${pct(target)} (< ${pct(ref)}) · Illegal ${pct(ill)} (< 25%)` };
    },
  },
];

export function winStatus(h: Row[]): { won: boolean; streak: number } {
  let streak = 0;
  for (let i = h.length - 1; i >= 0; i--) {
    const r = h[i];
    if (r.target < 0.03 && !r.crisis && r.illegalShare < 0.25) streak++; else break;
  }
  return { won: streak >= 24, streak };
}

export type LockFn = (allowed: string[] | undefined) => void;
export type { Levers };
