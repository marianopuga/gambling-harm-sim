import { STATE_NAMES } from '../model/sim';
import { cssVar } from './charts';

export interface AgentLayout { n: number; cols: number; rows: number; longLinks: Int32Array }

/** NetLogo-style view: one dot per agent on a lattice, colored by state, with overlays. */
export class AgentsView {
  private layout: AgentLayout | null = null;
  private buf: Uint8Array | null = null;
  private prevBuf: Uint8Array | null = null;
  private flash: Float32Array | null = null;
  overlays = { sud: true, illegal: true, links: true };
  private colors: string[] = [];

  constructor(private canvas: HTMLCanvasElement, private tip: HTMLElement) {
    canvas.addEventListener('mousemove', (e) => this.onHover(e));
    canvas.addEventListener('mouseleave', () => { this.tip.hidden = true; });
    this.refreshColors();
  }
  refreshColors() { this.colors = [0, 1, 2, 3, 4, 5, 6].map((k) => cssVar(`--s${k}`)); }
  setLayout(l: AgentLayout) { this.layout = l; this.flash = new Float32Array(l.n); this.prevBuf = null; }
  setBuffer(b: Uint8Array) {
    if (this.prevBuf && this.flash && this.prevBuf.length === b.length) {
      for (let i = 0; i < b.length; i++) if ((b[i] & 7) !== (this.prevBuf[i] & 7) && (b[i] & 7) > (this.prevBuf[i] & 7) && (b[i] & 7) >= 3 && (b[i] & 7) <= 4) this.flash[i] = 1;
    }
    this.buf = b;
    this.prevBuf = b.slice();
  }

  private geom() {
    const l = this.layout!; const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    const cell = Math.min(w / l.cols, h / l.rows);
    const ox = (w - cell * l.cols) / 2, oy = (h - cell * l.rows) / 2;
    return { cell, ox, oy, w, h };
  }

  draw() {
    if (!this.layout || !this.buf) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const c = this.canvas, w = c.clientWidth, h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr); }
    const ctx = c.getContext('2d')!; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
    const { cell, ox, oy } = this.geom(); const l = this.layout, b = this.buf;
    const pos = (i: number) => [ox + (i % l.cols + 0.5) * cell, oy + (Math.floor(i / l.cols) + 0.5) * cell];
    // long-range ties
    if (this.overlays.links) {
      ctx.strokeStyle = cssVar('--muted'); ctx.globalAlpha = 0.12; ctx.lineWidth = 0.6; ctx.beginPath();
      for (let k = 0; k < l.longLinks.length; k += 2) { const [x1, y1] = pos(l.longLinks[k]); const [x2, y2] = pos(l.longLinks[k + 1]); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    const r = Math.max(1.2, cell * 0.36);
    // dots grouped by color for speed
    for (let s = 0; s < 7; s++) {
      ctx.fillStyle = this.colors[s]; ctx.beginPath();
      const rr = s >= 3 && s <= 4 ? r * 1.15 : s === 0 ? r * 0.75 : r;
      for (let i = 0; i < l.n; i++) if ((b[i] & 7) === s) { const [x, y] = pos(i); ctx.moveTo(x + rr, y); ctx.arc(x, y, rr, 0, Math.PI * 2); }
      ctx.fill();
    }
    if (this.overlays.sud) {
      ctx.strokeStyle = cssVar('--ink'); ctx.globalAlpha = 0.55; ctx.lineWidth = Math.max(0.6, cell * 0.08); ctx.beginPath();
      for (let i = 0; i < l.n; i++) if (b[i] & 16) { const [x, y] = pos(i); ctx.moveTo(x + r * 1.45, y); ctx.arc(x, y, r * 1.45, 0, Math.PI * 2); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (this.overlays.illegal) {
      ctx.fillStyle = cssVar('--canvas'); ctx.beginPath();
      for (let i = 0; i < l.n; i++) { const s = b[i] & 7; if (b[i] & 8 && s >= 1 && s <= 4) { const [x, y] = pos(i); ctx.rect(x - r * 0.35, y - r * 0.35, r * 0.7, r * 0.7); } }
      ctx.fill();
    }
    // flashes for new escalations
    if (this.flash) {
      ctx.strokeStyle = cssVar('--s4'); ctx.lineWidth = 1.2;
      for (let i = 0; i < l.n; i++) {
        const f = this.flash[i]; if (f <= 0.02) continue;
        const [x, y] = pos(i); ctx.globalAlpha = f; ctx.beginPath(); ctx.arc(x, y, r * (1.5 + (1 - f) * 2.5), 0, Math.PI * 2); ctx.stroke();
        this.flash[i] *= 0.85;
      }
      ctx.globalAlpha = 1;
    }
  }

  private onHover(e: MouseEvent) {
    if (!this.layout || !this.buf) return;
    const rect = this.canvas.getBoundingClientRect(); const { cell, ox, oy } = this.geom();
    const cx = Math.floor((e.clientX - rect.left - ox) / cell), cy = Math.floor((e.clientY - rect.top - oy) / cell);
    const i = cy * this.layout.cols + cx;
    if (cx < 0 || cy < 0 || cx >= this.layout.cols || i >= this.layout.n) { this.tip.hidden = true; return; }
    const v = this.buf[i];
    const bits = [STATE_NAMES[v & 7]];
    if (v & 16) bits.push('alcohol/drug disorder'); if (v & 8 && (v & 7) >= 1 && (v & 7) <= 4) bits.push('illegal operator'); if (v & 32) bits.push('waiting for treatment');
    this.tip.textContent = bits.join(' · ');
    this.tip.hidden = false;
    const parent = this.canvas.parentElement!.getBoundingClientRect();
    this.tip.style.left = `${e.clientX - parent.left + 12}px`; this.tip.style.top = `${e.clientY - parent.top + 12}px`;
  }
}
