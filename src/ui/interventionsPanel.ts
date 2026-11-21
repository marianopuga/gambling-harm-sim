import { INTERVENTIONS, type InterventionKey, type InterventionMeta, type Levers } from '../model/levers';

type OnChange = (l: Levers) => void;

/** The four interventions as tags you switch on, each with its concept, where it acts and the evidence behind it. */
export class InterventionsPanel {
  private cards = new Map<InterventionKey, { meta: InterventionMeta; card: HTMLElement; sync: () => void }>();
  levers!: Levers;

  constructor(host: HTMLElement, private onChange: OnChange) {
    for (const m of INTERVENTIONS) host.appendChild(this.build(m));
  }

  private build(m: InterventionMeta): HTMLElement {
    const card = document.createElement('article'); card.className = 'iv'; card.dataset.key = m.key;
    const tag = document.createElement('button'); tag.type = 'button'; tag.className = 'iv-tag'; tag.id = `iv-${m.key}`;
    tag.innerHTML = `<span class="iv-n">${m.n}</span><span class="iv-title">${m.title}</span><span class="iv-state"></span>`;
    tag.addEventListener('click', () => { (this.levers as unknown as Record<string, boolean>)[m.key] = !this.levers[m.key]; sync(); this.onChange({ ...this.levers }); });
    const concept = document.createElement('p'); concept.className = 'iv-concept'; concept.textContent = m.concept;
    const acts = document.createElement('p'); acts.className = 'iv-acts'; acts.innerHTML = `<b>In the model:</b> ${m.acts}`;
    card.append(tag, concept);
    let select: HTMLSelectElement | null = null;
    if (m.setting) {
      const lab = document.createElement('label'); lab.className = 'iv-setting';
      lab.append(document.createTextNode(`${m.setting.label} `));
      select = document.createElement('select'); select.id = `iv-${m.setting.key}`;
      for (const o of m.setting.options) select.add(new Option(o.label, String(o.value)));
      const key = m.setting.key;
      select.addEventListener('change', () => { (this.levers as unknown as Record<string, number>)[key] = Number(select!.value); this.onChange({ ...this.levers }); });
      lab.append(select); card.append(lab);
    }
    const ev = document.createElement('p'); ev.className = 'iv-ev';
    ev.innerHTML = `<span class="ev ${m.evidence}">evidence: ${m.evidence}</span> ${m.evidenceNote}`;
    card.append(acts, ev);
    const sync = () => {
      const on = this.levers[m.key];
      card.classList.toggle('on', on);
      tag.setAttribute('aria-pressed', String(on));
      (tag.querySelector('.iv-state') as HTMLElement).textContent = on ? 'On' : 'Off';
      if (select && m.setting) select.value = String(this.levers[m.setting.key]);
    };
    this.cards.set(m.key, { meta: m, card, sync });
    return card;
  }

  set(levers: Levers) {
    this.levers = { ...levers };
    for (const v of this.cards.values()) v.sync();
  }

  /** Lock every intervention except the listed ones (missions). */
  lock(allowed?: InterventionKey[]) {
    for (const [k, { card }] of this.cards) card.classList.toggle('locked', !!allowed && !allowed.includes(k));
  }
}
