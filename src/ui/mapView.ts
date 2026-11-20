import { STATE_NAMES } from '../model/sim';
import { ASPECT, BORDERS, MAINLAND, REGIONS, REGION_LABEL, REGION_NAMES, TASMANIA, project, type LonLat } from '../geo/australia';
import { cssVar } from './charts';

export interface MapLayout { n: number; px: Float32Array; py: Float32Array; region: Uint8Array; longLinks: Int32Array }

const CITIES: [string, LonLat][] = [['Sydney', [151.2, -33.87]], ['Melbourne', [144.96, -37.81]], ['Brisbane', [153.03, -27.47]], ['Perth', [115.86, -31.95]],
  ['Adelaide', [138.6, -34.93]], ['Hobart', [147.33, -42.88]], ['Canberra', [149.13, -35.28]], ['Darwin', [130.84, -12.46]]];

const HEAT_W = 120;

/**
 * Australia map: every dot is ~7,000 adults living where Australians live. Dots light up as people
 * start gambling and turn orange/red as they move into risk; a heat layer shows where at-risk
 * gambling concentrates. State labels show each state's at-risk share.
 */
export class MapView {
  private layout: MapLayout | null = null;
  private buf: Uint8Array | null = null;
  private prevBuf: Uint8Array | null = null;
  private flash: Float32Array | null = null;
  private regionStats: number[] = [];
  private regionStats0: number[] = [];
  overlays = { sud: false, illegal: true, links: false, heat: true, young: false };
  private colors: string[] = [];
  private heat = document.createElement('canvas');
  private heatGrid = new Float32Array(0);
  private heatDirty = true;
  private land: Path2D[] = [];
  private geomCache = { w: 0, h: 0, ox: 0, oy: 0, mw: 0, mh: 0 };

  constructor(private canvas: HTMLCanvasElement, private tip: HTMLElement) {
    canvas.addEventListener('mousemove', (e) => this.onHover(e));
    canvas.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    this.refreshColors();
  }
  refreshColors() { this.colors = [0, 1, 2, 3, 4, 5, 6].map((k) => cssVar(`--s${k}`)); this.heatDirty = true; }
  setLayout(l: MapLayout) { this.layout = l; this.flash = new Float32Array(l.n); this.prevBuf = null; this.heatDirty = true; }
  setRegionStats(now: number[], start: number[]) { this.regionStats = now; this.regionStats0 = start; }
  setBuffer(b: Uint8Array) {
    if (this.prevBuf && this.flash && this.prevBuf.length === b.length) {
      for (let i = 0; i < b.length; i++) {
        const s = b[i] & 7, p = this.prevBuf[i] & 7;
        if (s !== p && s > p && s >= 2 && s <= 4) this.flash[i] = 1;
      }
    }
    this.buf = b; this.prevBuf = b.slice(); this.heatDirty = true;
  }

  private geom() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    let mw = w, mh = w / ASPECT;
    if (mh > h) { mh = h; mw = h * ASPECT; }
    const ox = (w - mw) / 2, oy = (h - mh) / 2;
    if (w !== this.geomCache.w || h !== this.geomCache.h) {
      this.geomCache = { w, h, ox, oy, mw, mh };
      const toPath = (poly: LonLat[]) => { const p = new Path2D(); poly.forEach((ll, k) => { const [x, y] = project(ll); const X = ox + x * mw, Y = oy + y * mh; k ? p.lineTo(X, Y) : p.moveTo(X, Y); }); p.closePath(); return p; };
      this.land = [toPath(MAINLAND), toPath(TASMANIA)];
    }
    return this.geomCache;
  }
  private xy(i: number): [number, number] { const g = this.geomCache, l = this.layout!; return [g.ox + l.px[i] * g.mw, g.oy + l.py[i] * g.mh]; }
  private ll(p: LonLat): [number, number] { const g = this.geomCache; const [x, y] = project(p); return [g.ox + x * g.mw, g.oy + y * g.mh]; }

  private buildHeat() {
    const l = this.layout!, b = this.buf!;
    const W = HEAT_W, H = Math.round(HEAT_W / ASPECT);
    if (this.heatGrid.length !== W * H) this.heatGrid = new Float32Array(W * H);
    const g = this.heatGrid; g.fill(0);
    for (let i = 0; i < l.n; i++) {
      const s = b[i] & 7;
      const w = s === 2 ? 1 : s === 3 ? 2.2 : s === 4 || s === 5 ? 3.5 : 0;
      if (!w) continue;
      const x = Math.min(W - 1, Math.floor(l.px[i] * W)), y = Math.min(H - 1, Math.floor(l.py[i] * H));
      g[y * W + x] += w;
    }
    // two box-blur passes ≈ gaussian
    const tmp = new Float32Array(W * H);
    for (let pass = 0; pass < 2; pass++) {
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let d = -2; d <= 2; d++) { const xx = x + d; if (xx >= 0 && xx < W) s += g[y * W + xx]; } tmp[y * W + x] = s / 5; }
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let s = 0; for (let d = -2; d <= 2; d++) { const yy = y + d; if (yy >= 0 && yy < H) s += tmp[yy * W + x]; } g[y * W + x] = s / 5; }
    }
    // fixed scale so the map visibly "fills up" as the stock grows (≈ calibrated to 3,000 agents)
    const ref = 0.9 * (l.n / 3000);
    this.heat.width = W; this.heat.height = H;
    const ctx = this.heat.getContext('2d')!; const img = ctx.createImageData(W, H);
    for (let k = 0; k < W * H; k++) {
      const v = Math.min(1, g[k] / ref); if (v < 0.03) continue;
      // ramp: warm yellow → orange → deep red
      const r = 255, gg = Math.round(200 - 170 * v), bb = Math.round(60 - 50 * v);
      img.data[k * 4] = r; img.data[k * 4 + 1] = gg; img.data[k * 4 + 2] = bb; img.data[k * 4 + 3] = Math.round(220 * Math.pow(v, 0.7));
    }
    ctx.putImageData(img, 0, 0);
    this.heatDirty = false;
  }

  draw() {
    if (!this.layout || !this.buf) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const g = this.geom(); const l = this.layout, b = this.buf;
    const unit = g.mw / 600; // scale for dot sizes

    // sea glow + land
    ctx.fillStyle = cssVar('--land'); ctx.strokeStyle = cssVar('--coast'); ctx.lineWidth = 1.2;
    for (const p of this.land) { ctx.fill(p); ctx.stroke(p); }
    // state borders
    ctx.strokeStyle = cssVar('--coast'); ctx.globalAlpha = 0.6; ctx.setLineDash([3, 3]); ctx.lineWidth = 0.8; ctx.beginPath();
    for (const line of BORDERS) line.forEach((p, k) => { const [x, y] = this.ll(p); k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;

    // heat
    if (this.overlays.heat) {
      if (this.heatDirty) this.buildHeat();
      ctx.save(); ctx.globalCompositeOperation = cssVar('--heat-blend') === 'screen' ? 'screen' : 'multiply';
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.heat, g.ox, g.oy, g.mw, g.mh); ctx.restore();
    }
    // long-range ties
    if (this.overlays.links) {
      ctx.strokeStyle = cssVar('--muted'); ctx.globalAlpha = 0.18; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let k = 0; k < l.longLinks.length; k += 2) { const [x1, y1] = this.xy(l.longLinks[k]); const [x2, y2] = this.xy(l.longLinks[k + 1]); const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - Math.hypot(x2 - x1, y2 - y1) * 0.2; ctx.moveTo(x1, y1); ctx.quadraticCurveTo(mx, my, x2, y2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    // dots, drawn from least to most severe so at-risk people sit on top
    const order = [0, 6, 1, 5, 2, 3, 4];
    const size = [0.9, 1.25, 1.7, 2.1, 2.5, 2.3, 1.4].map((s) => Math.max(0.7, s * unit));
    const alpha = [0.35, 0.75, 0.85, 0.95, 1, 1, 0.8];
    for (const s of order) {
      ctx.fillStyle = this.colors[s]; ctx.globalAlpha = alpha[s]; ctx.beginPath();
      const r = size[s];
      for (let i = 0; i < l.n; i++) if ((b[i] & 7) === s) { const [x, y] = this.xy(i); ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    if (this.overlays.young) {
      ctx.strokeStyle = cssVar('--accent'); ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < l.n; i++) { const s = b[i] & 7; if (b[i] & 64 && s >= 2 && s <= 5) { const [x, y] = this.xy(i); const r = size[s] + 1.6; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); } }
      ctx.stroke();
    }
    if (this.overlays.sud) {
      ctx.strokeStyle = cssVar('--ink'); ctx.globalAlpha = 0.5; ctx.lineWidth = 0.8; ctx.beginPath();
      for (let i = 0; i < l.n; i++) if (b[i] & 16 && (b[i] & 7) >= 2) { const [x, y] = this.xy(i); const r = size[b[i] & 7] + 1.2; ctx.moveTo(x + r, y); ctx.arc(x, y, r, 0, Math.PI * 2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (this.overlays.illegal) {
      ctx.fillStyle = cssVar('--canvas'); ctx.beginPath();
      for (let i = 0; i < l.n; i++) { const s = b[i] & 7; if (b[i] & 8 && s >= 2 && s <= 4) { const [x, y] = this.xy(i); const r = size[s] * 0.45; ctx.rect(x - r, y - r, 2 * r, 2 * r); } }
      ctx.fill();
    }
    // escalation flashes
    if (this.flash) {
      ctx.strokeStyle = this.colors[4]; ctx.lineWidth = 1.2;
      for (let i = 0; i < l.n; i++) {
        const f = this.flash[i]; if (f <= 0.02) continue;
        const [x, y] = this.xy(i); ctx.globalAlpha = f; ctx.beginPath(); ctx.arc(x, y, (2 + (1 - f) * 7) * unit * 1.5, 0, Math.PI * 2); ctx.stroke();
        this.flash[i] *= 0.88;
      }
      ctx.globalAlpha = 1;
    }
    // cities
    const fs = Math.max(9, Math.min(12, 11 * unit));
    ctx.font = `500 ${fs}px Inter, system-ui, sans-serif`; ctx.fillStyle = cssVar('--muted'); ctx.textBaseline = 'middle';
    for (const [name, p] of CITIES) {
      const [x, y] = this.ll(p); const left = p[0] > 150 || name === 'Hobart';
      ctx.textAlign = left ? 'left' : 'right'; ctx.fillText(name, x + (left ? 8 : -8), y);
    }
    // state labels with at-risk share
    if (this.regionStats.length) {
      const big = Math.max(11, Math.min(15, 14 * unit));
      REGIONS.forEach((code, k) => {
        if (code === 'ACT') return;
        const [x, y] = this.ll(REGION_LABEL[k]);
        const v = this.regionStats[k], v0 = this.regionStats0[k] ?? v;
        ctx.textAlign = 'center';
        ctx.font = `600 ${big}px Inter, system-ui, sans-serif`; ctx.fillStyle = cssVar('--ink'); ctx.globalAlpha = 0.85; ctx.fillText(code, x, y - big * 0.7);
        ctx.font = `600 ${big}px 'JetBrains Mono', monospace`; ctx.fillStyle = v > v0 * 1.05 ? cssVar('--bad') : v < v0 * 0.95 ? cssVar('--good') : cssVar('--ink');
        ctx.fillText(`${(v * 100).toFixed(1)}%`, x, y + big * 0.55); ctx.globalAlpha = 1;
      });
    }
  }

  private onHover(e: MouseEvent) {
    if (!this.layout || !this.buf) return;
    const rect = this.canvas.getBoundingClientRect(); const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    let best = -1, bd = 64;
    for (let i = 0; i < this.layout.n; i++) { const [x, y] = this.xy(i); const d = (x - mx) ** 2 + (y - my) ** 2; if (d < bd) { bd = d; best = i; } }
    if (best < 0) { this.tip.hidden = true; return; }
    const v = this.buf[best];
    const bits = [STATE_NAMES[v & 7], REGION_NAMES[this.layout.region[best]]];
    if (v & 64) bits.push('man aged 18-34');
    if (v & 16) bits.push('alcohol/drug disorder'); if (v & 8 && (v & 7) >= 1 && (v & 7) <= 4) bits.push('offshore operator'); if (v & 32) bits.push('waiting for treatment');
    this.tip.textContent = bits.join(' · ');
    this.tip.hidden = false;
    const parent = this.canvas.parentElement!.getBoundingClientRect();
    this.tip.style.left = `${Math.min(e.clientX - parent.left + 12, parent.width - 220)}px`; this.tip.style.top = `${e.clientY - parent.top + 12}px`;
  }
}
