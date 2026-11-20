/** Minimal, fast canvas charts (line, stacked area, band, tornado) that follow the CSS theme tokens. */
export const cssVar = (name: string): string => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export interface Series { label: string; color: string; data: number[]; dash?: number[]; width?: number; fill?: boolean }
export interface ChartOpts {
  stacked?: boolean;
  yMin?: number; yMax?: number;
  yFmt?: (v: number) => string;
  goal?: { value: number; label: string };
  band?: { lo: number[]; hi: number[]; color: string };
  markers?: number[]; // x positions (months) of events
  points?: { x: number; y: number; label: string }[]; // reference observations (e.g. HILDA waves)
  vline?: { x: number; label: string }; // e.g. the month policies start
  xLabel?: (m: number) => string;
}

function setup(canvas: HTMLCanvasElement) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = canvas.clientWidth, h = canvas.clientHeight;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

const niceMax = (v: number) => { if (v <= 0) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); const f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e; };

export class LineChart {
  hover: number | null = null;
  constructor(public canvas: HTMLCanvasElement, public opts: ChartOpts = {}) {
    canvas.addEventListener('mousemove', (e) => { const r = canvas.getBoundingClientRect(); this.hoverX = e.clientX - r.left; this.dirty = true; });
    canvas.addEventListener('mouseleave', () => { this.hoverX = null; this.dirty = true; });
  }
  private hoverX: number | null = null;
  dirty = true;
  draw(series: Series[], months: number[]) {
    const { ctx, w, h } = setup(this.canvas);
    const o = this.opts;
    const padL = 46, padR = 10, padT = 10, padB = 22;
    const pw = w - padL - padR, ph = h - padT - padB;
    const n = months.length;
    if (n === 0) return;
    const xMax = Math.max(12, months[n - 1]);
    let yMax = o.yMax ?? 0;
    const yMin = o.yMin ?? 0;
    if (o.yMax === undefined) {
      if (o.stacked) for (let i = 0; i < n; i++) { let s = 0; for (const se of series) s += se.data[i] ?? 0; yMax = Math.max(yMax, s); }
      else for (const se of series) for (const v of se.data) if (Number.isFinite(v)) yMax = Math.max(yMax, v);
      if (o.band) for (const v of o.band.hi) yMax = Math.max(yMax, v);
      if (o.goal) yMax = Math.max(yMax, o.goal.value * 1.2);
      if (o.points) for (const p of o.points) yMax = Math.max(yMax, p.y * 1.15);
      yMax = niceMax(yMax * 1.05);
    }
    const X = (m: number) => padL + (m / xMax) * pw;
    const Y = (v: number) => padT + ph - ((v - yMin) / (yMax - yMin)) * ph;
    const muted = cssVar('--muted'), line = cssVar('--line'), ink = cssVar('--ink');
    // grid
    ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = muted; ctx.strokeStyle = line; ctx.lineWidth = 1;
    for (let k = 0; k <= 4; k++) {
      const v = yMin + (yMax - yMin) * k / 4, y = Y(v);
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText((o.yFmt ?? String)(v), padL - 6, y);
    }
    const yearStep = pw < 300 ? (xMax > 120 ? 96 : 48) : xMax > 180 ? 48 : xMax > 60 ? 24 : 12;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    for (let m = 0; m <= xMax; m += yearStep) { ctx.textAlign = X(m) > w - padR - 14 ? 'right' : 'center'; ctx.fillText(o.xLabel ? o.xLabel(m) : String(2018 + Math.floor(m / 12)), Math.min(X(m), w - 2), h - padB + 6); }
    // event markers
    if (o.markers) { ctx.strokeStyle = cssVar('--warn'); ctx.globalAlpha = .35; ctx.setLineDash([2, 3]); for (const m of o.markers) { ctx.beginPath(); ctx.moveTo(X(m), padT); ctx.lineTo(X(m), padT + ph); ctx.stroke(); } ctx.setLineDash([]); ctx.globalAlpha = 1; }
    // policy start line
    if (o.vline && o.vline.x > 0 && o.vline.x <= xMax) {
      const x = X(o.vline.x); ctx.strokeStyle = cssVar('--accent'); ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]);
      ctx.beginPath(); ctx.moveTo(x, padT); ctx.lineTo(x, padT + ph); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--accent'); ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText(o.vline.label, x + 4, padT + 2);
    }
    // band
    if (o.band) {
      ctx.fillStyle = o.band.color; ctx.globalAlpha = .22; ctx.beginPath();
      o.band.hi.forEach((v, i) => (i ? ctx.lineTo(X(months[i]), Y(v)) : ctx.moveTo(X(months[i]), Y(v))));
      for (let i = o.band.lo.length - 1; i >= 0; i--) ctx.lineTo(X(months[i]), Y(o.band.lo[i]));
      ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1;
    }
    // series
    if (o.stacked) {
      const base = new Array(n).fill(0);
      for (const se of series) {
        ctx.beginPath();
        for (let i = 0; i < n; i++) { const y = Y(base[i] + (se.data[i] ?? 0)); i ? ctx.lineTo(X(months[i]), y) : ctx.moveTo(X(months[i]), y); }
        for (let i = n - 1; i >= 0; i--) ctx.lineTo(X(months[i]), Y(base[i]));
        ctx.closePath(); ctx.fillStyle = se.color; ctx.globalAlpha = .85; ctx.fill(); ctx.globalAlpha = 1;
        for (let i = 0; i < n; i++) base[i] += se.data[i] ?? 0;
      }
    } else {
      for (const se of series) {
        ctx.beginPath(); ctx.strokeStyle = se.color; ctx.lineWidth = se.width ?? 2; ctx.setLineDash(se.dash ?? []);
        let started = false;
        for (let i = 0; i < se.data.length; i++) { const v = se.data[i]; if (!Number.isFinite(v)) continue; const x = X(months[i] ?? i), y = Y(v); started ? ctx.lineTo(x, y) : (ctx.moveTo(x, y), started = true); }
        ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // goal
    if (o.goal) {
      const y = Y(o.goal.value); ctx.strokeStyle = cssVar('--good'); ctx.setLineDash([5, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(w - padR, y); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = cssVar('--good'); ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText(o.goal.label, w - padR - 2, y - 2);
    }
    // reference points
    if (o.points) {
      for (const p of o.points) {
        if (p.x > xMax) continue;
        const x = X(p.x), y = Y(p.y);
        ctx.fillStyle = cssVar('--panel'); ctx.strokeStyle = ink; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x, y - 6); ctx.lineTo(x + 6, y); ctx.lineTo(x, y + 6); ctx.lineTo(x - 6, y); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = ink; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = x > w - 90 ? 'right' : 'left'; ctx.textBaseline = 'bottom';
        ctx.fillText(p.label, x + (x > w - 90 ? -8 : 8), y - 6);
      }
    }
    // hover readout
    if (this.hoverX !== null && this.hoverX > padL) {
      const m = Math.round(((this.hoverX - padL) / pw) * xMax);
      const i = months.indexOf(Math.min(m, months[n - 1]));
      if (i >= 0) {
        ctx.strokeStyle = ink; ctx.globalAlpha = .4; ctx.beginPath(); ctx.moveTo(X(months[i]), padT); ctx.lineTo(X(months[i]), padT + ph); ctx.stroke(); ctx.globalAlpha = 1;
        const mo = months[i]; const lines = [`${2018 + Math.floor(mo / 12)}-${String((mo % 12) + 1).padStart(2, '0')}`, ...series.map((s) => `${s.label}: ${(o.yFmt ?? String)(s.data[i] ?? NaN)}`)];
        const bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 14, bh = lines.length * 15 + 8;
        let bx = X(months[i]) + 8; if (bx + bw > w) bx = X(months[i]) - bw - 8;
        ctx.fillStyle = ink; ctx.globalAlpha = .92; ctx.fillRect(bx, padT, bw, bh); ctx.globalAlpha = 1;
        ctx.fillStyle = cssVar('--bg'); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        lines.forEach((l, k) => ctx.fillText(l, bx + 7, padT + 5 + k * 15));
      }
    }
    this.dirty = false;
  }
}

export function drawTornado(canvas: HTMLCanvasElement, rows: { label: string; low: number; high: number; base: number }[], fmt: (v: number) => string) {
  const { ctx, w, h } = setup(canvas);
  if (!rows.length) return;
  const padL = 150, padR = 60, padT = 18, rowH = Math.min(26, (h - padT - 10) / rows.length);
  const base = rows[0].base;
  let lo = base, hi = base;
  for (const r of rows) { lo = Math.min(lo, r.low, r.high); hi = Math.max(hi, r.low, r.high); }
  const span = Math.max(1e-6, hi - lo) * 1.1, c = (lo + hi) / 2;
  const X = (v: number) => padL + ((v - (c - span / 2)) / span) * (w - padL - padR);
  ctx.font = '11.5px Inter, system-ui, sans-serif';
  rows.forEach((r, i) => {
    const y = padT + i * rowH;
    ctx.fillStyle = cssVar('--muted'); ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(r.label, padL - 8, y + rowH / 2);
    const bar = (v: number, col: string) => { ctx.fillStyle = col; const x0 = X(base), x1 = X(v); ctx.fillRect(Math.min(x0, x1), y + 4, Math.abs(x1 - x0), rowH - 8); };
    bar(r.low, cssVar('--s1')); bar(r.high, cssVar('--s4'));
  });
  ctx.strokeStyle = cssVar('--ink'); ctx.beginPath(); ctx.moveTo(X(base), padT - 6); ctx.lineTo(X(base), padT + rows.length * rowH); ctx.stroke();
  ctx.fillStyle = cssVar('--ink'); ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; ctx.fillText(`base ${fmt(base)}`, X(base), padT - 6);
  ctx.textAlign = 'left'; ctx.fillStyle = cssVar('--s1'); ctx.textBaseline = 'bottom';
  ctx.fillText('■ −25%', w - padR + 6, padT + 12); ctx.fillStyle = cssVar('--s4'); ctx.fillText('■ +25%', w - padR + 6, padT + 28);
}
