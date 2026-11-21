import { Simulation } from '../src/model/sim';
import { DEFAULT_LEVERS, type Levers } from '../src/model/levers';
// usage: tsx scripts/hilda.ts [key=value ...] [policy=adBan,campaign,affordability,support]
// Prints the status quo (or a policy from 2018) averaged over 6 seeds at 2018, 2022, 2030 and 2038.
const params: Record<string, number> = {};
let policy: Levers = { ...DEFAULT_LEVERS };
for (const a of process.argv.slice(2)) {
  const [k, v] = a.split('=');
  if (k === 'policy') { for (const key of v.split(',')) (policy as unknown as Record<string, boolean>)[key] = true; }
  else params[k] = Number(v);
}
const seeds = [1, 2, 3, 4, 5, 6], at = [0, 48, 144, 240];
const keys = ['lr', 'mr', 'pg', 'tx', 'g', 'share', 'tax', 'cost', 'ge', 'cap', 'acc', 'mkt', 'access', 'fs', 'iso', 'aw', 'reg', 'inflow', 'outflow'] as const;
const acc = at.map(() => Object.fromEntries(keys.map((k) => [k, 0])) as Record<(typeof keys)[number], number>);
for (const seed of seeds) {
  const sim = new Simulation({ n: 4000, seed, levers: DEFAULT_LEVERS, params });
  sim.setLevers(policy);
  for (let t = 0; t < 240; t++) sim.step();
  at.forEach((m, k) => {
    const rows = sim.history.slice(Math.max(0, m - 3), m + 4);
    for (const r of rows) {
      const w = 1 / rows.length / seeds.length, a = acc[k];
      a.lr += r.counts[2] * w; a.mr += r.counts[3] * w; a.pg += r.counts[4] * w; a.tx += r.counts[5] * w; a.g += r.participation * w;
      a.share += r.atRiskRevenueShare * w; a.tax += r.tax * 12 * w; a.cost += r.socialCost * 12 * w; a.ge += r.expenditure * 12 * w; a.cap += r.capacity * w;
      a.acc += r.acceptance * w; a.mkt += r.marketing * w; a.access += r.accessibility * w; a.fs += r.financialStress * w; a.iso += r.isolation * w;
      a.aw += r.awareness * w; a.reg += r.regulation * w; a.inflow += r.inflow * w; a.outflow += r.outflow * w;
    }
  });
}
const f = (x: number) => (x * 100).toFixed(2);
at.forEach((m, k) => {
  const a = acc[k];
  console.log(`${2018 + m / 12}: LR ${f(a.lr)} MR ${f(a.mr)} PG ${f(a.pg + a.tx)} | at-risk ${f(a.lr + a.mr + a.pg + a.tx)} | gamblers ${f(a.g)} | atRiskRev ${a.share.toFixed(2)} | spend ${(a.ge / 1e9).toFixed(1)}bn tax ${(a.tax / 1e9).toFixed(1)}bn cost ${(a.cost / 1e9).toFixed(1)}bn places ${(a.cap / 1e3).toFixed(1)}k`
    + ` | acc ${a.acc.toFixed(2)} mkt ${a.mkt.toFixed(2)} access ${a.access.toFixed(2)} stress ${a.fs.toFixed(2)} iso ${a.iso.toFixed(2)} aware ${a.aw.toFixed(2)} reg ${a.reg.toFixed(2)} | in ${(a.inflow / 1e3).toFixed(0)}k out ${(a.outflow / 1e3).toFixed(0)}k`);
});
