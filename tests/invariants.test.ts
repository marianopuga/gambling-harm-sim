import { describe, expect, it } from 'vitest';
import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS, type Levers } from '../src/model/levers';
import { hazardToProb } from '../src/model/rng';
import { SCENARIOS, scenarioLevers } from '../src/scenarios/presets';

const run = (levers: Levers, months = 120, seed = 3, n = 1500, start: Levers = DEFAULT_LEVERS) => {
  const sim = new Simulation({ n, seed, levers: start });
  sim.setLevers(levers);
  for (let t = 0; t < months; t++) sim.step();
  return sim;
};
const tail = (sim: Simulation, k = 12) => sim.history.slice(-k).reduce((s, r) => s + r.target, 0) / k;

describe('invariants', () => {
  it('conserves population: state shares always sum to 1', () => {
    const sim = run(scenarioLevers('liberalization'), 60);
    for (const r of sim.history) expect(r.counts.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('keeps probabilities in [0, 1] for any hazard', () => {
    for (const h of [0, 1e-6, 0.01, 1, 50, 1e9, -3]) { const p = hazardToProb(h); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });

  it('keeps every stock inside its bounds under extreme levers', () => {
    const extreme: Levers = { ...DEFAULT_LEVERS, availability: 100, marketing: 100, innovation: 100, taxRate: 60, earmarking: 100, alcohol: 30, drugs: 15, socialPressure: 100, acceptance: 100, support: 0, enforcement: 0 };
    const sim = run(extreme, 120);
    for (const r of sim.history) {
      for (const v of [r.acceptance, r.awareness, r.influence, r.resistance, r.illegalShare]) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
      expect(Number.isFinite(r.tax)).toBe(true); expect(r.capacity).toBeGreaterThanOrEqual(0);
    }
  });

  it('is deterministic for a given seed', () => {
    const a = run(scenarioLevers('public-health'), 48, 11), b = run(scenarioLevers('public-health'), 48, 11);
    expect(a.history.map((r) => r.target)).toEqual(b.history.map((r) => r.target));
    const c = run(scenarioLevers('public-health'), 48, 12);
    expect(c.history.map((r) => r.target)).not.toEqual(a.history.map((r) => r.target));
  });
});

describe('directional effects (extreme levers)', () => {
  const base = tail(run(DEFAULT_LEVERS));
  const cases: [string, Partial<Levers>, 'up' | 'down'][] = [
    ['more marketing', { marketing: 100 }, 'up'],
    ['more availability', { availability: 100 }, 'up'],
    ['more innovation', { innovation: 100 }, 'up'],
    ['more alcohol disorder', { alcohol: 30 }, 'up'],
    ['full ad ban', { adBan: 2 }, 'down'],
    ['affordability + deposit + stake limits', { affordability: true, depositLimits: true, stakeLimits: true }, 'down'],
    ['much more state support', { support: 100, levy: 15 }, 'down'],
  ];
  for (const [name, change, dir] of cases) {
    it(`${name} → ${dir}`, () => {
      const v = tail(run({ ...DEFAULT_LEVERS, ...change }));
      if (dir === 'up') expect(v).toBeGreaterThan(base); else expect(v).toBeLessThan(base);
    }, 30_000);
  }

  it('higher tax raises the illegal share; enforcement lowers it', () => {
    const ill = (l: Partial<Levers>) => { const s = run({ ...DEFAULT_LEVERS, ...l }); return s.history.slice(-12).reduce((a, r) => a + r.illegalShare, 0) / 12; };
    const b = ill({});
    expect(ill({ taxRate: 50 })).toBeGreaterThan(b);
    expect(ill({ enforcement: 100 })).toBeLessThan(b);
  }, 30_000);

  it('prohibition sends tax to zero and almost all play to the illegal channel', () => {
    const s = run(scenarioLevers('prohibition'), 120);
    const r = s.history[s.history.length - 1];
    expect(r.tax).toBeLessThan(1);
    expect(r.illegalShare).toBeGreaterThan(0.9);
  }, 30_000);
});

describe('scenario presets', () => {
  it('produce qualitatively distinct 20-year trajectories', () => {
    const finals = SCENARIOS.map((sc) => {
      const pol = scenarioLevers(sc.id);
      const s = run(pol, 240, 5, 2000, { ...DEFAULT_LEVERS, startDependency: pol.startDependency, earmarking: pol.earmarking });
      const last = s.history.slice(-12);
      return { id: sc.id, target: tail(s), ill: last.reduce((a, r) => a + r.illegalShare, 0) / 12, res: last.reduce((a, r) => a + r.resistance, 0) / 12 };
    });
    const get = (id: string) => finals.find((f) => f.id === id)!;
    console.table(finals);
    expect(get('liberalization').target).toBeGreaterThan(get('status-quo').target * 1.5);
    expect(get('public-health').target).toBeLessThan(get('status-quo').target * 0.6);
    expect(get('captured').res).toBeGreaterThan(get('status-quo').res + 0.3);
    expect(get('prohibition').ill).toBeGreaterThan(0.9);
    expect(get('integrated').target).toBeLessThan(get('status-quo').target);
  }, 120_000);
});
