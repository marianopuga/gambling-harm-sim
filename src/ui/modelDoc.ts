import { PARAMS, type ParamKey } from '../params';
import { LOOPS } from './cld';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const SOURCES: [string, string][] = [
  ['Lancet Public Health Commission on Gambling (Wardle et al., 2024)', 'https://www.unsw.edu.au/news/2024/10/new-commission-calls-for-regulatory-reform-to-tackle-the-health'],
  ['Petry, Stinson & Grant (2005), NESARC comorbidity', 'https://pubmed.ncbi.nlm.nih.gov/15889941/'],
  ['Bijker et al. (2022), global help-seeking meta-analysis', 'https://www.news-medical.net/news/20220714/Review-One-in-every-400-adults-has-sought-help-for-problem-gambling.aspx'],
  ['Browne & Rockloff (2018), prevention paradox', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6174604'],
  ['Goodwin et al. (2017), a typical problem gambler affects six others', 'https://acquire.cqu.edu.au/articles/journal_contribution/A_typical_problem_gambler_affects_six_others/13397684'],
  ['Bouguettaya et al. (2020), advertising meta-analysis', 'https://acquire.cqu.edu.au/articles/journal_contribution/The_relationship_between_gambling_advertising_and_gambling_attitudes_intentions_and_behaviours_A_critical_and_meta-analytic_review/20289042'],
  ['ANU (2023), low-risk gambling transitions', 'https://www.gamblingandracing.act.gov.au/__data/assets/pdf_file/0020/2316071/2023-Harm-profiles-associated-with-low-risk-gambling-Longitudinal-analysis-of-three-datasets-ANU-Research-Report.pdf'],
  ['Swelogs incidence study (Int. Gambling Studies, 2016)', 'https://informahealthcare.com/doi/full/10.1080/14459795.2016.1209780'],
  ['Revenue concentration, Great Britain (via Vixio)', 'https://www.vixio.com/insights/gc-online-casino-depends-risk-problem-gamblers-uk-study-suggests'],
  ['Revenue concentration, Australia (AGR / Roy Morgan, 2024)', 'https://www.agr.org.au/agr-media-releases/gambling-industry-makes-almost-half-its-revenue-from-just-12%25-of-all-gamblers'],
  ['Rockefeller Institute (2016), state reliance on gambling revenue', 'https://rockinst.org/wp-content/uploads/2018/02/2016-04-12-Blinken_Report_Three.pdf'],
  ['Channelisation & tax (PwC for BGC — industry-commissioned)', 'https://next.io/news/regulation/pwc-study-higher-taxes-black-market-growth/'],
  ['NetLogo community model: Pathological Gambling and Social Influence', 'https://ccl.northwestern.edu/netlogo/models/community/Pathological%20Gambling%20and%20Social%20Influence'],
];

export function renderModelDoc(host: HTMLElement) {
  const rows = (Object.keys(PARAMS) as ParamKey[]).map((k) => {
    const p = PARAMS[k];
    return `<tr><td><code>${k}</code></td><td>${p.value}</td><td>${esc(p.unit)}</td><td>${p.range[0]} – ${p.range[1]}</td><td>${esc(p.source)}</td><td class="conf-${p.confidence}">${p.confidence}</td></tr>`;
  }).join('');
  host.innerHTML = `
  <h3>What this is</h3>
  <p>A hybrid model: <b>agents</b> (adults on a small-world social network) move between PGSI risk states each month, while <b>aggregate stocks</b> — social acceptance, public awareness, industry influence, fiscal dependency, political resistance, treatment capacity and the illegal channel — evolve with explicit delays and feed back on every agent's transition hazards.</p>
  <h3>How an agent changes state</h3>
  <p>For every possible transition, <code>rate = base × Π(multipliers)</code> and <code>p = 1 − exp(−rate × 1 month)</code>. Multipliers come from levers (log-linear, centred so the status quo = 1), the agent's vulnerability, Pathways subtype, alcohol/drug disorder, product mix, debt, legal vs illegal channel, and the share of gambling and at-risk peers scaled by social pressure. Transitions go both up and down: natural recovery is the most common exit from problem gambling.</p>
  <h3>Policy delays and resistance</h3>
  <p>Each lever reaches the system through a third-order delay (~9 months). Changes that reduce harm are attenuated by up to 70% × political resistance, which rises with fiscal dependency, industry influence, earmarking and budget crises.</p>
  <h3>Calibration</h3>
  <p>Base hazards were solved so that a status-quo run settles near 3.5% moderate risk, 1.2% problem gambling, ~65% past-year gamblers, 40–50% of spend from at-risk gamblers, ~20% of problem-gambling exits through treatment and a gambling-tax share of ~2.5% of the budget. Automated tests check this after a 10-year burn-in.</p>
  <h3>Feedback loops</h3>
  <ul>${LOOPS.map((l) => `<li><b>${l.id} ${esc(l.name)}</b> — ${esc(l.explain)}</li>`).join('')}</ul>
  <h3>Limitations</h3>
  <ul>
    <li>Adults only (18+); youth gambling and loot boxes are not modelled.</li>
    <li>Alcohol and drug use are binary (disorder / no disorder), not graded.</li>
    <li>Effect sizes for levers are directional evidence plus assumptions; the sensitivity tab shows which ones drive results.</li>
    <li>The illegal-market response is contested, and the main channelisation estimates are industry-funded.</li>
    <li>Prevention-paradox weighting follows Browne & Rockloff; others (Delfabbro & King) dispute it.</li>
  </ul>
  <h3>Parameters</h3>
  <div class="tbl"><table><thead><tr><th>Key</th><th>Value</th><th>Unit</th><th>Range</th><th>Source / assumption</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h3>Sources</h3>
  <ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>`;
}
