import { PARAMS, type ParamKey, type ParamValues } from '../params';
import type { Levers } from './levers';
import { Simulation, type NetworkKind } from './sim';

export interface MCResult { months: number[]; p5: number[]; p50: number[]; p95: number[]; finalMean: number }

/** Run a policy from the same initial conditions with K seeds; returns 5/50/95 percentile bands of the target metric. */
export function monteCarlo(initial: Levers, policy: Levers, opts: { seeds: number; months: number; n: number; network: NetworkKind; params?: Partial<ParamValues> },
  progress?: (done: number) => void): MCResult {
  const series: number[][] = [];
  for (let k = 0; k < opts.seeds; k++) {
    const sim = new Simulation({ n: opts.n, seed: 1000 + k, levers: initial, network: opts.network, params: opts.params });
    sim.setLevers(policy);
    for (let t = 0; t < opts.months; t++) sim.step();
    series.push(sim.history.map((r) => r.target));
    progress?.(k + 1);
  }
  const months = series[0].map((_, i) => i);
  const q = (arr: number[], p: number) => { const s = [...arr].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.max(0, Math.round(p * (s.length - 1))))]; };
  const p5: number[] = [], p50: number[] = [], p95: number[] = [];
  for (const m of months) { const col = series.map((s) => s[m]); p5.push(q(col, 0.05)); p50.push(q(col, 0.5)); p95.push(q(col, 0.95)); }
  const finalMean = series.reduce((s, x) => s + x[x.length - 1], 0) / series.length;
  return { months, p5, p50, p95, finalMean };
}

export const SENSITIVITY_KEYS: ParamKey[] = [
  'b_availability', 'b_marketing', 'b_innovation', 'b_acceptance', 'b_peerStart', 'b_peerRisk', 'b_product',
  'b_awarenessHelp', 'b_supportHelp', 'alc_escalation', 'drug_escalation', 'gamblingToSud',
  'h_LR_MR', 'h_MR_LR', 'h_MR_PG', 'h_PG_MR', 'h_PG_TX', 'h_TX_RC', 'h_RC_PG',
  'illegalRisk', 'illegalTaxSlope', 'policyDelay', 'resistanceAttenuation', 'tau_acceptance',
];

export interface SensRow { key: ParamKey; label: string; low: number; high: number; base: number }

/** One-at-a-time ±25% perturbation; outcome = mean target over the last 12 months. */
export function sensitivity(initial: Levers, policy: Levers, opts: { months: number; n: number; seeds: number; network: NetworkKind },
  progress?: (done: number, total: number) => void): SensRow[] {
  const run = (params: Partial<ParamValues>) => {
    let s = 0;
    for (let k = 0; k < opts.seeds; k++) {
      const sim = new Simulation({ n: opts.n, seed: 500 + k, levers: initial, network: opts.network, params });
      sim.setLevers(policy);
      for (let t = 0; t < opts.months; t++) sim.step();
      const tail = sim.history.slice(-12);
      s += tail.reduce((a, r) => a + r.target, 0) / tail.length;
    }
    return s / opts.seeds;
  };
  const base = run({});
  const out: SensRow[] = [];
  const total = SENSITIVITY_KEYS.length;
  SENSITIVITY_KEYS.forEach((key, idx) => {
    const v = PARAMS[key].value;
    out.push({ key, label: key, base, low: run({ [key]: v * 0.75 }), high: run({ [key]: v * 1.25 }) });
    progress?.(idx + 1, total);
  });
  out.sort((a, b) => Math.abs(b.high - b.low) - Math.abs(a.high - a.low));
  return out;
}
