/// <reference lib="webworker" />
import { Simulation, type NetworkKind } from './model/sim';
import type { Levers } from './model/levers';
import { monteCarlo, sensitivity } from './model/batch';

export type ToWorker =
  | { type: 'init'; n: number; seed: number; levers: Levers; network: NetworkKind; policyStart: number }
  | { type: 'levers'; levers: Levers }
  | { type: 'step'; count: number }
  | { type: 'mc'; initial: Levers; policy: Levers; seeds: number; months: number; n: number; network: NetworkKind; policyStart: number }
  | { type: 'sens'; initial: Levers; policy: Levers; months: number; n: number; network: NetworkKind; policyStart: number };

let sim: Simulation | null = null;
let rowsSent = 0, eventsSent = 0;
const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (ev: MessageEvent<ToWorker>) => {
  const m = ev.data;
  switch (m.type) {
    case 'init': {
      sim = new Simulation({ n: m.n, seed: m.seed, levers: m.levers, network: m.network, policyStart: m.policyStart });
      // history before the policy year has already happened: fast-forward so the run opens in that January
      for (let t = 0; t < m.policyStart; t++) sim.step();
      rowsSent = sim.history.length; eventsSent = sim.events.length;
      ctx.postMessage({
        type: 'ready', n: sim.n, px: sim.px, py: sim.py, region: sim.region, scale: sim.scale,
        longLinks: sim.longLinks, nbrStart: sim.nbrStart, nbr: sim.nbr,
        history: sim.history, events: sim.events, buffer: sim.renderBuffer(),
      });
      break;
    }
    case 'levers': sim?.setLevers(m.levers); break;
    case 'step': {
      if (!sim) return;
      for (let i = 0; i < m.count; i++) sim.step();
      const rows = sim.history.slice(rowsSent); rowsSent = sim.history.length;
      const events = sim.events.slice(eventsSent); eventsSent = sim.events.length;
      ctx.postMessage({ type: 'tick', rows, events, buffer: sim.renderBuffer() });
      break;
    }
    case 'mc': {
      const t0 = performance.now();
      const res = monteCarlo(m.initial, m.policy, m, (done) => ctx.postMessage({ type: 'progress', job: 'mc', done, total: m.seeds }));
      ctx.postMessage({ type: 'mcResult', result: res, ms: performance.now() - t0 });
      break;
    }
    case 'sens': {
      const res = sensitivity(m.initial, m.policy, { months: m.months, n: m.n, seeds: 5, network: m.network, policyStart: m.policyStart },
        (done, total) => ctx.postMessage({ type: 'progress', job: 'sens', done, total }));
      ctx.postMessage({ type: 'sensResult', result: res });
      break;
    }
  }
};
