import type { Row } from '../model/sim';
import type { Levers } from '../model/levers';

type Kind = 'lever' | 'stock' | 'var';
interface Node { id: string; label: string; x: number; y: number; kind: Kind; value?: (r: Row) => number }
interface Link { from: string; to: string; sign: '+' | '−'; bend?: number }
export interface Loop { id: string; type: 'R' | 'B' | 'F'; name: string; path: string[]; explain: string }

const N: Node[] = [
  { id: 'L_mkt', label: 'Marketing', x: 90, y: 70, kind: 'lever' },
  { id: 'L_inno', label: 'Product innovation', x: 90, y: 150, kind: 'lever' },
  { id: 'L_avail', label: 'Availability', x: 90, y: 230, kind: 'lever' },
  { id: 'L_press', label: 'Social pressure', x: 90, y: 310, kind: 'lever' },
  { id: 'L_sup', label: 'State support / levy', x: 90, y: 400, kind: 'lever' },
  { id: 'L_tax', label: 'Tax rate', x: 90, y: 490, kind: 'lever' },
  { id: 'L_enf', label: 'Enforcement', x: 90, y: 580, kind: 'lever' },
  { id: 'L_reg', label: 'Limits, bans, self-exclusion', x: 960, y: 640, kind: 'lever' },
  { id: 'L_ear', label: 'Earmarking', x: 520, y: 650, kind: 'lever' },
  { id: 'ACC', label: 'Social acceptance', x: 310, y: 90, kind: 'stock', value: (r) => r.acceptance },
  { id: 'INT', label: 'Betting intensity', x: 310, y: 190, kind: 'var' },
  { id: 'PART', label: 'Participation', x: 520, y: 230, kind: 'var', value: (r) => 1 - r.counts[0] - r.counts[5] - r.counts[6] },
  { id: 'CONT', label: 'Peer contagion', x: 520, y: 330, kind: 'var' },
  { id: 'ESC', label: 'Moderate + problem risk', x: 740, y: 190, kind: 'stock', value: (r) => r.target },
  { id: 'SUD', label: 'Alcohol / drug disorder', x: 960, y: 80, kind: 'stock', value: (r) => r.sudAmongPG },
  { id: 'HARM', label: 'Harm & affected others', x: 960, y: 230, kind: 'var', value: (r) => r.harm },
  { id: 'AWARE', label: 'Public awareness', x: 960, y: 370, kind: 'stock', value: (r) => r.awareness },
  { id: 'HELP', label: 'Help-seeking & treatment', x: 740, y: 340, kind: 'stock', value: (r) => r.capacity },
  { id: 'GGR', label: 'Legal GGR', x: 520, y: 440, kind: 'var', value: (r) => r.ggrLegal },
  { id: 'TAX', label: 'Tax revenue', x: 310, y: 470, kind: 'var', value: (r) => r.tax },
  { id: 'DEP', label: 'Fiscal dependency', x: 310, y: 580, kind: 'stock', value: (r) => r.dependency },
  { id: 'LOBBY', label: 'Industry influence', x: 520, y: 550, kind: 'stock', value: (r) => r.influence },
  { id: 'RES', label: 'Political resistance', x: 740, y: 580, kind: 'stock', value: (r) => r.resistance },
  { id: 'POLICY', label: 'Effective reform', x: 740, y: 460, kind: 'var' },
  { id: 'ILL', label: 'Illegal channel', x: 960, y: 520, kind: 'stock', value: (r) => r.illegalShare },
];

const LINKS: Link[] = [
  { from: 'L_mkt', to: 'ACC', sign: '+' }, { from: 'L_mkt', to: 'INT', sign: '+' }, { from: 'L_inno', to: 'INT', sign: '+' },
  { from: 'L_avail', to: 'PART', sign: '+' }, { from: 'L_press', to: 'CONT', sign: '+' },
  { from: 'ACC', to: 'PART', sign: '+' }, { from: 'PART', to: 'ACC', sign: '+', bend: 30 },
  { from: 'PART', to: 'CONT', sign: '+', bend: 25 }, { from: 'CONT', to: 'PART', sign: '+', bend: 25 },
  { from: 'INT', to: 'ESC', sign: '+' }, { from: 'PART', to: 'ESC', sign: '+' },
  { from: 'ESC', to: 'SUD', sign: '+', bend: 18 }, { from: 'SUD', to: 'ESC', sign: '+', bend: 18 },
  { from: 'ESC', to: 'HARM', sign: '+' }, { from: 'HARM', to: 'AWARE', sign: '+' }, { from: 'AWARE', to: 'ACC', sign: '−', bend: -120 },
  { from: 'AWARE', to: 'HELP', sign: '+' }, { from: 'L_sup', to: 'HELP', sign: '+', bend: -40 }, { from: 'HELP', to: 'ESC', sign: '−' },
  { from: 'PART', to: 'GGR', sign: '+' }, { from: 'ESC', to: 'GGR', sign: '+' }, { from: 'GGR', to: 'TAX', sign: '+' },
  { from: 'L_tax', to: 'TAX', sign: '+' }, { from: 'TAX', to: 'DEP', sign: '+' }, { from: 'DEP', to: 'RES', sign: '+', bend: 40 },
  { from: 'GGR', to: 'LOBBY', sign: '+' }, { from: 'LOBBY', to: 'RES', sign: '+' }, { from: 'L_ear', to: 'RES', sign: '+' },
  { from: 'RES', to: 'POLICY', sign: '−' }, { from: 'L_reg', to: 'POLICY', sign: '+' }, { from: 'POLICY', to: 'ESC', sign: '−', bend: 30 },
  { from: 'POLICY', to: 'INT', sign: '−', bend: 40 }, { from: 'TAX', to: 'HELP', sign: '+', bend: -30 },
  { from: 'POLICY', to: 'ILL', sign: '+' }, { from: 'L_tax', to: 'ILL', sign: '+', bend: 60 }, { from: 'L_enf', to: 'ILL', sign: '−', bend: 80 },
  { from: 'ILL', to: 'GGR', sign: '−' }, { from: 'ILL', to: 'ESC', sign: '+', bend: -60 },
];

export const LOOPS: Loop[] = [
  { id: 'R1', type: 'R', name: 'Peer contagion', path: ['PART', 'CONT', 'PART'], explain: 'More people gambling → more gambling friends → more people start.' },
  { id: 'R2', type: 'R', name: 'Normalization', path: ['ACC', 'PART', 'ACC'], explain: 'Widespread participation makes gambling feel normal, which draws more people in.' },
  { id: 'R3', type: 'R', name: 'Fiscal capture', path: ['GGR', 'TAX', 'DEP', 'RES', 'POLICY', 'ESC', 'GGR'], explain: 'The more the budget relies on gambling tax, the harder it is to pass reforms that shrink it (Policy Resistance).' },
  { id: 'R4', type: 'R', name: 'Lobbying', path: ['GGR', 'LOBBY', 'RES', 'POLICY', 'ESC', 'GGR'], explain: 'Profits fund political influence that weakens regulation, which protects profits.' },
  { id: 'R5', type: 'R', name: 'Dual addiction', path: ['ESC', 'SUD', 'ESC'], explain: 'Gambling problems and alcohol/drug disorders feed each other.' },
  { id: 'B1', type: 'B', name: 'Harm visibility', path: ['ESC', 'HARM', 'AWARE', 'ACC', 'PART', 'ESC'], explain: 'Visible harm erodes social acceptance — slowly (5-year time constant).' },
  { id: 'B2', type: 'B', name: 'Treatment', path: ['ESC', 'HARM', 'AWARE', 'HELP', 'ESC'], explain: 'Harm raises awareness and help-seeking; treatment pulls people out — but only ~20% ever seek help.' },
  { id: 'B3', type: 'B', name: 'Funded protection (Shifting the Burden)', path: ['ESC', 'GGR', 'TAX', 'HELP', 'ESC'], explain: 'A levy funds treatment from gambling tax — so success shrinks its own budget.' },
  { id: 'F1', type: 'F', name: 'Fixes that Fail', path: ['POLICY', 'ILL', 'ESC'], explain: 'Strict rules, high taxes or prohibition push play to illegal operators with no limits or protection.' },
];

const LEVER_NODE: Partial<Record<keyof Levers, string>> = {
  marketing: 'L_mkt', adBan: 'L_mkt', innovation: 'L_inno', inPlayBan: 'L_reg', availability: 'L_avail', socialPressure: 'L_press',
  support: 'L_sup', levy: 'L_sup', integratedServices: 'L_sup', taxRate: 'L_tax', enforcement: 'L_enf', earmarking: 'L_ear',
  stakeLimits: 'L_reg', depositLimits: 'L_reg', affordability: 'L_reg', selfExclusion: 'L_reg', ageVerification: 'L_reg', prohibition: 'L_reg',
  acceptance: 'ACC', alcohol: 'SUD', drugs: 'SUD', startDependency: 'DEP',
};

const W = 1080, H = 690, NW = 150, NH = 38;
const svgNS = 'http://www.w3.org/2000/svg';
const el = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}) => {
  const e = document.createElementNS(svgNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  return e;
};

export class CLD {
  private svg: SVGSVGElement;
  private nodeEls = new Map<string, SVGGElement>();
  private linkEls: { link: Link; path: SVGPathElement; pol: SVGTextElement }[] = [];
  private pinned: string[] | null = null;
  private caption: HTMLParagraphElement;

  constructor(host: HTMLElement) {
    this.svg = el('svg', { viewBox: `0 0 ${W} ${H}`, class: 'cld', role: 'img', 'aria-label': 'Causal loop diagram of the gambling harm system' }) as SVGSVGElement;
    const defs = el('defs');
    const marker = el('marker', { id: 'arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 9, markerHeight: 9, markerUnits: 'userSpaceOnUse', orient: 'auto-start-reverse' });
    marker.appendChild(el('path', { d: 'M0,0 L10,5 L0,10 z', fill: 'var(--muted)' }));
    defs.appendChild(marker); this.svg.appendChild(defs);
    const byId = new Map(N.map((n) => [n.id, n]));
    for (const l of LINKS) {
      const a = byId.get(l.from)!, b = byId.get(l.to)!;
      const { d, mx, my } = this.pathFor(a, b, l.bend ?? 0);
      const path = el('path', { d, class: 'cld-link', 'marker-end': 'url(#arrow)' }) as SVGPathElement;
      const pol = el('text', { x: mx, y: my, class: 'cld-pol', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }) as SVGTextElement;
      pol.textContent = l.sign;
      this.svg.append(path, pol);
      this.linkEls.push({ link: l, path, pol });
    }
    for (const n of N) {
      const g = el('g', { class: `cld-node ${n.kind}`, transform: `translate(${n.x - NW / 2},${n.y - NH / 2})`, tabindex: 0 }) as SVGGElement;
      g.appendChild(el('rect', { width: NW, height: NH, rx: 8 }));
      const tx = el('text', { x: NW / 2, y: NH / 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle' });
      tx.textContent = n.label; g.appendChild(tx);
      g.addEventListener('mouseenter', () => this.highlightDownstream(n.id));
      g.addEventListener('focus', () => this.highlightDownstream(n.id));
      g.addEventListener('mouseleave', () => this.clear());
      g.addEventListener('blur', () => this.clear());
      this.svg.appendChild(g); this.nodeEls.set(n.id, g);
    }
    host.appendChild(this.svg);
    const loops = document.createElement('div'); loops.className = 'loops';
    for (const lp of LOOPS) {
      const b = document.createElement('button'); b.className = `btn small ${lp.type}`; b.textContent = `${lp.id} · ${lp.name}`;
      b.addEventListener('click', () => { this.pinned = this.pinned === lp.path ? null : lp.path; this.pinned ? this.highlightPath(lp.path, lp) : this.clear(); });
      b.addEventListener('mouseenter', () => this.highlightPath(lp.path, lp));
      b.addEventListener('mouseleave', () => (this.pinned ? this.highlightPath(this.pinned) : this.clear()));
      loops.appendChild(b);
    }
    host.appendChild(loops);
    this.caption = document.createElement('p'); this.caption.className = 'hint';
    this.caption.textContent = 'Hover a node or a lever to trace its effects. R = reinforcing, B = balancing, F = side-effect. Animated links speed up when their source is above its starting level.';
    host.appendChild(this.caption);
  }

  private pathFor(a: Node, b: Node, bend: number) {
    // start/end on rectangle edges
    const edge = (n: Node, tx: number, ty: number) => {
      const dx = tx - n.x, dy = ty - n.y; const s = Math.min(Math.abs((NW / 2 + 4) / (dx || 1e-6)), Math.abs((NH / 2 + 4) / (dy || 1e-6)));
      return [n.x + dx * s, n.y + dy * s];
    };
    const mx0 = (a.x + b.x) / 2, my0 = (a.y + b.y) / 2;
    const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / len, ny = (b.x - a.x) / len;
    const cx = mx0 + nx * bend, cy = my0 + ny * bend;
    const [x1, y1] = edge(a, cx, cy), [x2, y2] = edge(b, cx, cy);
    const mx = 0.25 * x1 + 0.5 * cx + 0.25 * x2, my = 0.25 * y1 + 0.5 * cy + 0.25 * y2;
    return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, mx: mx + nx * 10, my: my + ny * 10 };
  }

  highlightLever(key: keyof Levers | null) { const id = key ? LEVER_NODE[key] : undefined; id ? this.highlightDownstream(id) : this.clear(); }

  private highlightDownstream(id: string) {
    const seen = new Set([id]); let frontier = [id];
    for (let depth = 0; depth < 3; depth++) {
      const next: string[] = [];
      for (const f of frontier) for (const l of LINKS) if (l.from === f && !seen.has(l.to)) { seen.add(l.to); next.push(l.to); }
      frontier = next;
    }
    this.apply((l) => seen.has(l.from) && seen.has(l.to) && l.from !== l.to && this.reachableEdge(l, id, seen), seen);
  }
  private reachableEdge(l: Link, _root: string, seen: Set<string>) { return seen.has(l.from); }

  private highlightPath(path: string[], loop?: Loop) {
    const nodes = new Set(path); const edges = new Set<string>();
    for (let i = 0; i < path.length - 1; i++) edges.add(path[i] + '>' + path[i + 1]);
    this.apply((l) => edges.has(l.from + '>' + l.to), nodes);
    if (loop) this.caption.textContent = `${loop.id} · ${loop.name}: ${loop.explain}`;
  }
  private apply(edgeOn: (l: Link) => boolean, nodes: Set<string>) {
    this.svg.classList.add('dim');
    for (const { link, path, pol } of this.linkEls) { const on = edgeOn(link); path.classList.toggle('hl', on); pol.classList.toggle('hl', on); }
    for (const [id, g] of this.nodeEls) g.classList.toggle('hl', nodes.has(id));
  }
  clear() {
    if (this.pinned) return;
    this.svg.classList.remove('dim');
    for (const { path, pol } of this.linkEls) { path.classList.remove('hl'); pol.classList.remove('hl'); }
    for (const g of this.nodeEls.values()) g.classList.remove('hl');
  }

  /** Animate links by how far their source variable is from its starting level. */
  update(row: Row | undefined, row0: Row | undefined) {
    if (!row || !row0) return;
    const byId = new Map(N.map((n) => [n.id, n]));
    for (const { link, path } of this.linkEls) {
      const src = byId.get(link.from)!;
      if (!src.value) { path.classList.remove('flow'); continue; }
      const v0 = src.value(row0), v = src.value(row);
      const ratio = v0 > 0 ? Math.min(3, Math.max(0.2, v / v0)) : 1;
      path.classList.add('flow');
      path.style.setProperty('--speed', `${(2.4 / ratio).toFixed(2)}s`);
      path.style.strokeWidth = (1 + 0.8 * ratio).toFixed(2);
    }
  }
}
