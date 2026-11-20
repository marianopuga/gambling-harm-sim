import { describe, expect, it } from 'vitest';
import { Simulation, LR, MR, PG, TX } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
import { CALIBRATION_TARGETS as T } from '../src/params';

describe('Australian calibration (status quo, averaged over seeds)', () => {
  it('starts at HILDA 2018 and rises toward HILDA 2022', () => {
    const seeds = [1, 2, 3, 4, 5];
    let lr = 0, mr = 0, pg = 0, gam = 0, share = 0, dep = 0, risk22 = 0, cost = 0, tax = 0;
    for (const seed of seeds) {
      const sim = new Simulation({ n: 4000, seed, levers: DEFAULT_LEVERS });
      for (let t = 0; t < 54; t++) sim.step();
      const y18 = sim.history.slice(0, 6), y22 = sim.history.slice(45, 52);
      const avg = (rows: typeof y18, f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
      lr += avg(y18, (r) => r.counts[LR]); mr += avg(y18, (r) => r.counts[MR]); pg += avg(y18, (r) => r.counts[PG] + r.counts[TX]);
      gam += avg(y18, (r) => r.counts[1] + r.counts[2] + r.counts[3] + r.counts[4]);
      share += avg(y18, (r) => r.atRiskRevenueShare); dep += avg(y18, (r) => r.dependency);
      cost += avg(y18, (r) => r.socialCost); tax += avg(y18, (r) => r.tax);
      risk22 += avg(y22, (r) => r.target);
    }
    const k = seeds.length;
    [lr, mr, pg, gam, share, dep, risk22, cost, tax] = [lr, mr, pg, gam, share, dep, risk22, cost, tax].map((v) => v / k);
    console.log({ low: lr.toFixed(4), moderate: mr.toFixed(4), high: pg.toFixed(4), atRisk2022: risk22.toFixed(4), gamblers: gam.toFixed(3), atRiskRevenueShare: share.toFixed(3), dependency: dep.toFixed(4), costToTax: (cost / tax).toFixed(1) });
    const within = (v: number, target: number, tol: number) => { expect(v).toBeGreaterThan(target * (1 - tol)); expect(v).toBeLessThan(target * (1 + tol)); };
    within(lr, T.low, 0.25); within(mr, T.moderate, 0.25); within(pg, T.problem, 0.3);
    within(risk22, T.atRisk2022, 0.07);
    within(gam, T.gamblers, 0.12);
    expect(share).toBeGreaterThan(T.atRiskRevenueShare[0]); expect(share).toBeLessThan(T.atRiskRevenueShare[1]);
    within(dep, T.dependency, 0.1);
    expect(cost / tax).toBeGreaterThan(3); // social cost far exceeds tax revenue (Victoria 2023 vs state tax)
  }, 60_000);
});
