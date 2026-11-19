import { describe, expect, it } from 'vitest';
import { Simulation, MR, PG } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
import { CALIBRATION_TARGETS as T } from '../src/params';

describe('status-quo calibration (after burn-in)', () => {
  it('stays within ±20% of the prevalence targets over 10 years, averaged over seeds', () => {
    const seeds = [1, 2, 3, 4, 5];
    let mr = 0, pg = 0, gam = 0, share = 0, dep = 0;
    for (const seed of seeds) {
      const sim = new Simulation({ n: 4000, seed, levers: DEFAULT_LEVERS });
      for (let t = 0; t < 120; t++) sim.step();
      const rows = sim.history.slice(-60);
      const avg = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / rows.length;
      mr += avg((r) => r.counts[MR]); pg += avg((r) => r.counts[PG]);
      gam += avg((r) => r.counts[1] + r.counts[2] + r.counts[3] + r.counts[4]);
      share += avg((r) => r.atRiskRevenueShare); dep += avg((r) => r.dependency);
    }
    const k = seeds.length;
    mr /= k; pg /= k; gam /= k; share /= k; dep /= k;
    console.log({ moderate: mr.toFixed(4), problem: pg.toFixed(4), gamblers: gam.toFixed(3), atRiskRevenueShare: share.toFixed(3), dependency: dep.toFixed(4) });
    expect(mr).toBeGreaterThan(T.moderate * 0.8); expect(mr).toBeLessThan(T.moderate * 1.2);
    expect(pg).toBeGreaterThan(T.problem * 0.8); expect(pg).toBeLessThan(T.problem * 1.2);
    expect(gam).toBeGreaterThan(T.gamblers * 0.9); expect(gam).toBeLessThan(T.gamblers * 1.1);
    expect(share).toBeGreaterThan(T.atRiskRevenueShare[0] * 0.85); expect(share).toBeLessThan(T.atRiskRevenueShare[1] * 1.15);
    expect(dep).toBeGreaterThan(T.dependency * 0.8); expect(dep).toBeLessThan(T.dependency * 1.2);
  }, 60_000);
});
