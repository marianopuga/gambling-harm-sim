import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS } from '../src/model/levers';
// usage: tsx scripts/hilda.ts key=value ...   (param overrides)
const params: Record<string, number> = {};
for (const a of process.argv.slice(2)) { const [k, v] = a.split('='); params[k] = Number(v); }
const seeds = [1, 2, 3], at = [0, 48, 144, 240];
const acc = at.map(() => ({ lr: 0, mr: 0, pg: 0, tx: 0, g: 0, ym: 0, oth: 0, share: 0, dep: 0, tax: 0, cost: 0, ggr: 0 }));
for (const seed of seeds) {
  const sim = new Simulation({ n: 4000, seed, levers: DEFAULT_LEVERS, params });
  for (let t = 0; t < 240; t++) sim.step();
  at.forEach((m, k) => {
    const rows = sim.history.slice(Math.max(0, m - 3), m + 4);
    for (const r of rows) {
      const w = 1 / rows.length / seeds.length, a = acc[k];
      a.lr += r.counts[2] * w; a.mr += r.counts[3] * w; a.pg += r.counts[4] * w; a.tx += r.counts[5] * w; a.g += (r.counts[1] + r.counts[2] + r.counts[3] + r.counts[4]) * w;
      a.ym += r.youngMenAtRisk * w; a.oth += r.othersAtRisk * w; a.share += r.atRiskRevenueShare * w; a.dep += r.dependency * w; a.tax += r.tax * 12 * w; a.cost += r.socialCost * 12 * w; a.ggr += (r.ggrLegal + r.ggrIllegal) * 12 * w;
    }
  });
}
const f = (x: number) => (x * 100).toFixed(2);
at.forEach((m, k) => { const a = acc[k];
  console.log(`${2018 + m / 12}: LR ${f(a.lr)} MR ${f(a.mr)} PG ${f(a.pg + a.tx)} | at-risk ${f(a.lr + a.mr + a.pg + a.tx)} | gamblers ${f(a.g)} | youngMen ${f(a.ym)} others ${f(a.oth)} | atRiskRev ${a.share.toFixed(2)} dep ${f(a.dep)} | GGR ${(a.ggr / 1e9).toFixed(1)}bn tax ${(a.tax / 1e9).toFixed(1)}bn cost ${(a.cost / 1e9).toFixed(1)}bn`); });
