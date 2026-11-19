import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
const esc = Number(process.argv[2] ?? 1), rec = Number(process.argv[3] ?? 1), pgs = Number(process.argv[4] ?? 0.45);
let o = [0, 0, 0, 0, 0, 0, 0], share = 0, dep = 0, sud = 0; const seeds = [1, 2, 3];
for (const seed of seeds) {
  const sim = new Simulation({ n: 4000, seed, levers: DEFAULT_LEVERS, params: { escalationScale: esc, recoveryScale: rec, pgScale: pgs } });
  for (let t = 0; t < 120; t++) sim.step();
  const rows = sim.history.slice(-60);
  for (const r of rows) { r.counts.forEach((c, k) => (o[k] += c / rows.length / seeds.length)); share += r.atRiskRevenueShare / rows.length / seeds.length; dep += r.dependency / rows.length / seeds.length; sud += r.sudAmongPG / rows.length / seeds.length; }
}
console.log(`esc=${esc} rec=${rec} pg=${pgs}`, o.map((x) => (x * 100).toFixed(2)).join(' '), `| MR+PG ${((o[3] + o[4]) * 100).toFixed(2)} share ${share.toFixed(2)} dep ${(dep * 100).toFixed(2)} sudPG ${sud.toFixed(2)}`);
