import { CLD_SVG, LOOP_INFO } from './cldDiagram';

/** The group's causal loop diagram: every model variable and arrow, with delays and named loops. */
export const LOOPS = LOOP_INFO.map((l) => ({ ...l, type: l.id[0] === 'R' ? 'reinforcing' : 'balancing' }));

const DEFAULT_NOTE = 'Pick a loop to trace it through the diagram. A loop with an even number of − links reinforces itself (R); an odd number balances it (B). ‖ marks a delay.';

/** Renders the diagram with loop chips; picking a loop highlights its arrows and fades the rest. */
export class CLD {
  private svg: SVGSVGElement;
  private note: HTMLElement;
  private chips: HTMLButtonElement[];
  private active = '';

  constructor(host: HTMLElement) {
    const chips = ['<button type="button" class="chip" data-loop="" aria-pressed="true">All loops</button>',
      ...LOOPS.map((l) => `<button type="button" class="chip" data-loop="${l.id}" aria-pressed="false"><b>${l.id}</b> ${l.name}</button>`)].join('');
    host.innerHTML = `<div class="cld-head"><nav class="loop-chips" aria-label="Trace a loop">${chips}</nav><p class="hint cld-note" aria-live="polite"></p></div>
      <div class="cld-frame">${CLD_SVG}</div>
      <p class="hint">Same diagram as the group's causal loop diagram. Every box is a variable in the simulation; the four interventions act on marketing exposure (ad ban), social acceptance and help-seeking (campaign), gambling losses (affordability checks) and government spend on treatment &amp; counselling (recovery support).</p>`;
    this.svg = host.querySelector('svg')!;
    this.note = host.querySelector('.cld-note')!;
    this.note.textContent = DEFAULT_NOTE;
    this.chips = Array.from(host.querySelectorAll<HTMLButtonElement>('.chip'));
    this.chips.forEach((c) => c.addEventListener('click', () => this.select(c.dataset.loop ?? '')));
    this.svg.querySelectorAll<SVGGElement>('.lp').forEach((g) => {
      g.addEventListener('click', () => this.select(g.dataset.loops ?? ''));
      g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.select(g.dataset.loops ?? ''); } });
    });
  }

  select(id: string) {
    this.active = id && id !== this.active ? id : '';
    this.svg.classList.toggle('focus', Boolean(this.active));
    this.svg.querySelectorAll<SVGElement>('[data-loops]').forEach((el) => el.classList.toggle('on', Boolean(this.active) && (el.dataset.loops ?? '').split(' ').includes(this.active)));
    this.chips.forEach((c) => c.setAttribute('aria-pressed', String((c.dataset.loop ?? '') === this.active)));
    const loop = LOOPS.find((l) => l.id === this.active);
    if (!loop) { this.note.textContent = DEFAULT_NOTE; return; }
    const b = document.createElement('strong'); b.textContent = `${loop.id} · ${loop.name}. `;
    this.note.replaceChildren(b, document.createTextNode(loop.text));
  }
}
