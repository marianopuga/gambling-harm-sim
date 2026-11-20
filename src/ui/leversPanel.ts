import { LEVER_META, type LeverMeta, type Levers } from '../model/levers';

type OnChange = (l: Levers) => void;
type OnHover = (key: keyof Levers | null) => void;

/** Builds the grouped lever controls. Shows each lever's value and its change from the run's starting point. */
export class LeversPanel {
  private inputs = new Map<keyof Levers, { meta: LeverMeta; row: HTMLElement; sync: () => void }>();
  private tip: HTMLDivElement;
  levers!: Levers;
  start!: Levers;

  constructor(host: HTMLElement, private onChange: OnChange, private onHover: OnHover) {
    this.tip = document.createElement('div'); this.tip.className = 'tipbox'; this.tip.hidden = true; document.body.appendChild(this.tip);
    const groups = new Map<string, HTMLElement>();
    for (const m of LEVER_META) {
      if (!groups.has(m.group)) {
        const d = document.createElement('details'); d.className = 'group'; d.open = true;
        const s = document.createElement('summary'); s.textContent = m.group; d.appendChild(s);
        host.appendChild(d); groups.set(m.group, d);
      }
      groups.get(m.group)!.appendChild(this.build(m));
    }
  }

  private build(m: LeverMeta): HTMLElement {
    const row = document.createElement('div'); row.className = 'lever'; row.dataset.group = m.group;
    const id = `lv-${m.key}`;
    const top = document.createElement('div'); top.className = 'lever-top';
    const label = document.createElement('label'); label.htmlFor = id; label.textContent = m.label;
    const info = document.createElement('button'); info.type = 'button'; info.className = 'info'; info.textContent = 'i'; info.setAttribute('aria-label', `About ${m.label}: ${m.tip}`);
    const ev = document.createElement('span'); ev.className = `ev ${m.evidence}`; ev.textContent = `evidence: ${m.evidence}`;
    label.append(info);
    const right = document.createElement('span');
    const val = document.createElement('span'); val.className = 'val';
    const delta = document.createElement('span'); delta.className = 'delta';
    right.append(val, ' ', delta);
    top.append(label, right);
    row.append(top);
    const showTip = (e: MouseEvent | FocusEvent) => {
      this.tip.textContent = `${m.tip}${m.key === 'startDependency' ? ' (Initial condition: applies on Reset.)' : ''}`;
      this.tip.hidden = false;
      const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
      this.tip.style.left = `${Math.min(window.innerWidth - 320, r.right + 8)}px`; this.tip.style.top = `${Math.max(8, r.top - 8)}px`;
    };
    info.addEventListener('mouseenter', showTip); info.addEventListener('focus', showTip);
    info.addEventListener('mouseleave', () => (this.tip.hidden = true)); info.addEventListener('blur', () => (this.tip.hidden = true));
    row.addEventListener('mouseenter', () => this.onHover(m.key)); row.addEventListener('mouseleave', () => this.onHover(null));

    let sync: () => void;
    if (m.kind === 'range') {
      const input = document.createElement('input'); input.type = 'range'; input.id = id;
      input.min = String(m.min); input.max = String(m.max); input.step = String(m.step ?? 1);
      input.addEventListener('input', () => { (this.levers as unknown as Record<string, number>)[m.key] = Number(input.value); sync(); this.onChange({ ...this.levers }); });
      row.append(input);
      sync = () => {
        const v = this.levers[m.key] as number; input.value = String(v);
        val.textContent = `${v}${m.unit?.startsWith('%') ? '%' : ''}`;
        const d = v - (this.start[m.key] as number);
        delta.textContent = Math.abs(d) > 1e-9 ? `(${d > 0 ? '+' : ''}${+d.toFixed(1)})` : '';
        input.setAttribute('aria-valuetext', `${v}${m.unit ? ' ' + m.unit : ''}`);
      };
    } else if (m.kind === 'toggle') {
      const wrap = document.createElement('div'); wrap.className = 'toggle';
      const input = document.createElement('input'); input.type = 'checkbox'; input.id = id; input.setAttribute('role', 'switch');
      input.addEventListener('change', () => { (this.levers as unknown as Record<string, boolean>)[m.key] = input.checked; sync(); this.onChange({ ...this.levers }); });
      const txt = document.createElement('span'); txt.className = 'hint'; txt.style.margin = '0';
      wrap.append(input, txt); row.append(wrap);
      sync = () => {
        const v = this.levers[m.key] as boolean; input.checked = v; val.textContent = v ? 'On' : 'Off';
        delta.textContent = v !== this.start[m.key] ? '(changed)' : '';
      };
    } else {
      const seg = document.createElement('div'); seg.className = 'seg'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', m.label);
      const btns = (m.options ?? []).map((o, k) => {
        const b = document.createElement('button'); b.type = 'button'; b.textContent = o;
        b.addEventListener('click', () => { (this.levers as unknown as Record<string, number>)[m.key] = k; sync(); this.onChange({ ...this.levers }); });
        seg.appendChild(b); return b;
      });
      row.append(seg);
      sync = () => {
        const v = this.levers[m.key] as number; btns.forEach((b, k) => b.setAttribute('aria-pressed', String(k === v)));
        val.textContent = m.options?.[v] ?? ''; delta.textContent = v !== this.start[m.key] ? '(changed)' : '';
      };
    }
    row.append(ev);
    this.inputs.set(m.key, { meta: m, row, sync });
    return row;
  }

  set(levers: Levers, start: Levers) {
    this.levers = { ...levers }; this.start = { ...start };
    for (const v of this.inputs.values()) v.sync();
  }

  /** Lock every lever except those whose group or key is listed. */
  lock(allowed?: string[]) {
    for (const { meta, row } of this.inputs.values()) row.classList.toggle('locked', !!allowed && !allowed.includes(meta.group) && !allowed.includes(meta.key));
  }
}
