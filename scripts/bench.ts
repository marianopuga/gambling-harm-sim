import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
import { monteCarlo } from '../src/model/batch';
for (const n of [3000, 5000]) {
  let t0 = performance.now(); const sim = new Simulation({ n, seed: 1, levers: DEFAULT_LEVERS }); const init = performance.now() - t0;
  t0 = performance.now(); for (let i = 0; i < 240; i++) sim.step(); const ms = (performance.now() - t0) / 240;
  console.log(`n=${n}: init+burn-in ${init.toFixed(0)} ms, ${ms.toFixed(2)} ms/step`);
}
const t0 = performance.now(); monteCarlo(DEFAULT_LEVERS, DEFAULT_LEVERS, { seeds: 20, months: 240, n: 1500, network: 'smallworld' });
console.log(`Monte Carlo 20 seeds × 240 months (n=1500): ${((performance.now() - t0) / 1000).toFixed(1)} s`);
