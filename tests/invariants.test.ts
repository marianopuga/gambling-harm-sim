import { describe, expect, it } from 'vitest';
import { Simulation, type Row } from '../src/model/sim';
import { DEFAULT_LEVERS, type Levers } from '../src/model/levers';
import { hazardToProb } from '../src/model/rng';

const ALL: Levers = { ...DEFAULT_LEVERS, adBan: true, campaign: true, affordability: true, support: true };
const run = (levers: Partial<Levers>, months = 120, seed = 3, n = 1500, policyStart = 0) => {
  const sim = new Simulation({ n, seed, levers: DEFAULT_LEVERS, policyStart });
  sim.setLevers({ ...DEFAULT_LEVERS, ...levers });
  for (let t = 0; t < months; t++) sim.step();
  return sim;
};
const tail = (sim: Simulation, f: (r: Row) => number = (r) => r.target, k = 12) => sim.history.slice(-k).reduce((s, r) => s + f(r), 0) / k;
/** Average a tail metric over a few seeds so single-seed noise cannot flip a direction. */
const avgRuns = (levers: Partial<Levers>, f?: (r: Row) => number, seeds = [3, 4]) => seeds.reduce((s, seed) => s + tail(run(levers, 120, seed, 2000), f), 0) / seeds.length;

describe('invariants', () => {
  it('conserves population: state shares always sum to 1', () => {
    const sim = run(ALL, 60);
    for (const r of sim.history) expect(r.counts.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 9);
  });

  it('keeps probabilities in [0, 1] for any hazard', () => {
    for (const h of [0, 1e-6, 0.01, 1, 50, 1e9, -3]) { const p = hazardToProb(h); expect(p).toBeGreaterThanOrEqual(0); expect(p).toBeLessThanOrEqual(1); }
  });

  it('keeps every variable inside its bounds, with and without interventions', () => {
    for (const levers of [DEFAULT_LEVERS, ALL]) {
      const sim = run(levers, 240);
      for (const r of sim.history) {
        for (const v of [r.acceptance, r.awareness, r.pressure, r.regulation, r.financialStress, r.coping, r.distress, r.conflict, r.isolation, r.participation, r.adBanCoverage, r.campaign, r.affordability, r.support]) {
          expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1);
        }
        for (const v of [r.tax, r.govSpend, r.capacity, r.expenditure, r.socialCost, r.marketing, r.accessibility, r.exposure, r.helpSeeking]) { expect(Number.isFinite(v)).toBe(true); expect(v).toBeGreaterThanOrEqual(0); }
      }
    }
  }, 30_000);

  it('is deterministic for a given seed', () => {
    const a = run(ALL, 48, 11), b = run(ALL, 48, 11);
    expect(a.history.map((r) => r.target)).toEqual(b.history.map((r) => r.target));
    const c = run(ALL, 48, 12);
    expect(c.history.map((r) => r.target)).not.toEqual(a.history.map((r) => r.target));
  });
});

describe('each intervention moves the system the way the diagram says', () => {
  const sqRisk = avgRuns({});
  const sqCost = avgRuns({}, (r) => r.socialCost);
  const sqSpend = avgRuns({}, (r) => r.expenditure);
  const exitRate = (r: Row) => r.outflow / Math.max(1, r.target * 20.8e6);
  const sqExit = avgRuns({}, exitRate);

  it('1 · ad ban → less marketing, fewer people at risk', () => {
    const s = run({ adBan: true });
    expect(tail(s, (r) => r.marketing)).toBeLessThan(0.5);
    expect(avgRuns({ adBan: true })).toBeLessThan(sqRisk * 0.8);
  }, 30_000);

  it('2 · anti-gambling campaign → lower social acceptance, fewer people at risk', () => {
    expect(tail(run({ campaign: true }), (r) => r.acceptance)).toBeLessThan(tail(run({}), (r) => r.acceptance));
    expect(avgRuns({ campaign: true })).toBeLessThan(sqRisk);
  }, 30_000);

  it('3 · affordability checks → lower losses and spending, less harm', () => {
    expect(avgRuns({ affordability: true }, (r) => r.expenditure)).toBeLessThan(sqSpend * 0.85);
    expect(avgRuns({ affordability: true }, (r) => r.socialCost)).toBeLessThan(sqCost);
    // a lower threshold catches more people
    const spend = (threshold: number) => tail(run({ affordability: true, affordabilityThreshold: threshold }), (r) => r.expenditure);
    expect(spend(500)).toBeLessThan(spend(2000));
  }, 60_000);

  it('4 · recovery support → more places, more people leaving risk, less harm', () => {
    const s = run({ support: true });
    expect(tail(s, (r) => r.capacity)).toBeGreaterThan(tail(run({}), (r) => r.capacity));
    expect(avgRuns({ support: true }, exitRate)).toBeGreaterThan(sqExit);
    expect(avgRuns({ support: true }, (r) => r.socialCost)).toBeLessThan(sqCost * 0.9);
  }, 60_000);

  it('all four together bring at-risk gambling well below the status quo', () => {
    expect(avgRuns(ALL)).toBeLessThan(sqRisk * 0.6);
  }, 30_000);
});

describe('timing', () => {
  it('the ad ban phases out stage by stage and a shorter phase-out removes ads sooner', () => {
    const fast = run({ adBan: true, adBanYears: 1 }, 30), slow = run({ adBan: true, adBanYears: 5 }, 30);
    const stages = fast.events.filter((e) => e.text.startsWith('Ad ban')).map((e) => e.month);
    expect(stages.length).toBe(4);
    expect(stages[3]).toBeLessThanOrEqual(13);
    expect(fast.history[24].adBanCoverage).toBeGreaterThan(0.95);
    expect(slow.history[24].adBanCoverage).toBeLessThan(0.6);
    expect(fast.history[24].marketing).toBeLessThan(slow.history[24].marketing);
  });

  it('switched-on interventions phase in through a delay', () => {
    const s = run({ campaign: true, support: true }, 24);
    expect(s.history[1].campaign).toBeLessThan(0.2);
    expect(s.history[18].campaign).toBeGreaterThan(0.9);
    expect(s.history[18].support).toBeGreaterThan(0.9);
  });

  it('replays the status quo until the policy year, then the interventions take effect', () => {
    const sq = run({}, 200, 9), late = run(ALL, 200, 9, 1500, 96), early = run(ALL, 200, 9, 1500, 0);
    expect(late.history.slice(0, 96).map((r) => r.target)).toEqual(sq.history.slice(0, 96).map((r) => r.target));
    expect(tail(late)).toBeLessThan(tail(sq));
    expect(tail(early)).toBeLessThan(tail(late)); // acting earlier helps more
  }, 30_000);
});
