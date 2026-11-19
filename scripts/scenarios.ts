import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
import { SCENARIOS, scenarioLevers } from '../src/scenarios/presets';
for (const s of SCENARIOS) {
  // start from status quo, then switch policy at month 0 (as a user would)
  const sim = new Simulation({ n: 4000, seed: 7, levers: { ...DEFAULT_LEVERS, startDependency: scenarioLevers(s.id).startDependency, earmarking: scenarioLevers(s.id).earmarking } });
  sim.setLevers(scenarioLevers(s.id));
  for (let t = 0; t < 240; t++) sim.step();
  const at = (m: number) => sim.history[m];
  const f = (r: any) => `${(r.target * 100).toFixed(2)}% tax ${(r.tax / 1e6).toFixed(0)}M ill ${(r.illegalShare * 100).toFixed(0)}% A ${r.acceptance.toFixed(2)} R ${r.resistance.toFixed(2)} bal ${(r.budgetBalance / 1e9).toFixed(2)}B`;
  console.log(s.id.padEnd(15), '| m0', f(at(0)), '| m60', f(at(60)), '| m240', f(at(240)));
  console.log('   events:', sim.events.map((e) => `${e.month}:${e.kind}`).join(' '));
}
