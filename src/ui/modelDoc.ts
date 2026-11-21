import { PARAMS, type ParamKey } from '../params';
import { INTERVENTIONS } from '../model/levers';
import { LOOPS } from './cld';

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!));

const SOURCES: [string, string][] = [
  ['AIHW: Gambling in Australia (HILDA 2018 & 2022 PGSI categories, Wilkins et al. 2024)', 'https://www.aihw.gov.au/reports/australias-welfare/gambling'],
  ['The social costs of gambling to Victoria, 2023 ($14.1bn)', 'https://files.justice.vic.gov.au/2025-06/The-social-costs-of-gambling-to-Victoria-2023.pdf'],
  ['Queensland Government Statistician: Australian Gambling Statistics (39th ed.)', 'https://qgso.qld.gov.au/issues/2646/australian-gambling-statistics-39th-edn-1997-98-2022-23.pdf'],
  ['Parliamentary Library quick guide: "You win some, you lose more" (Murphy inquiry into online gambling, 2023)', 'https://aph.gov.au/About_Parliament/Parliamentary_departments/Parliamentary_Library/Research/Quick_Guides/2023-24/YouWinSomeYouLoseMorereportononlinegamblingharm'],
  ['Bouguettaya et al. (2020), gambling advertising meta-analysis', 'https://acquire.cqu.edu.au/articles/journal_contribution/The_relationship_between_gambling_advertising_and_gambling_attitudes_intentions_and_behaviours_A_critical_and_meta-analytic_review/20289042'],
  ['Farrelly et al. (2005), "truth" anti-smoking campaign and youth smoking (AJPH)', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC1449196'],
  ['Gambling Commission (Great Britain): financial risk checks update', 'https://www.gamblingcommission.gov.uk/about-us/freedomofinformation/financial-risk-checks-update'],
  ['Cochrane review: psychological therapies for pathological and problem gambling (Cowlishaw et al.)', 'https://www.cochrane.org/evidence/CD008937_psychological-therapies-pathological-and-problem-gambling'],
  ['Bijker et al. (2022), global help-seeking meta-analysis', 'https://www.news-medical.net/news/20220714/Review-One-in-every-400-adults-has-sought-help-for-problem-gambling.aspx'],
  ['Lancet Public Health Commission on Gambling (Wardle et al., 2024)', 'https://www.unsw.edu.au/news/2024/10/new-commission-calls-for-regulatory-reform-to-tackle-the-health'],
  ['Browne & Rockloff (2018), prevention paradox', 'https://pmc.ncbi.nlm.nih.gov/articles/PMC6174604'],
  ['University of Melbourne Pursuit: high-risk gambling 1.1% → 1.8%', 'https://pursuit.unimelb.edu.au/articles/its-getting-easier-to-become-a-problem-gambler-in-australia'],
  ['ANU (2023), low-risk gambling transitions', 'https://www.gamblingandracing.act.gov.au/__data/assets/pdf_file/0020/2316071/2023-Harm-profiles-associated-with-low-risk-gambling-Longitudinal-analysis-of-three-datasets-ANU-Research-Report.pdf'],
  ['Swelogs incidence study (Int. Gambling Studies, 2016)', 'https://informahealthcare.com/doi/full/10.1080/14459795.2016.1209780'],
  ['Revenue concentration, Australia (AGR / Roy Morgan, 2024)', 'https://www.agr.org.au/agr-media-releases/gambling-industry-makes-almost-half-its-revenue-from-just-12%25-of-all-gamblers'],
  ['NetLogo community model: Pathological Gambling and Social Influence', 'https://ccl.northwestern.edu/netlogo/models/community/Pathological%20Gambling%20and%20Social%20Influence'],
];

const VARIABLES: [string, string, string][] = [
  ['Market & social norms', 'Social acceptance', 'A slow stock (≈5-year time constant). Rises when more people gamble (R1); falls with public pressure and the anti-gambling campaign.'],
  ['Market & social norms', 'Exposure to gambling', 'Social acceptance plus each person\'s share of friends who gamble (their links on the social network).'],
  ['Market & social norms', 'Marketing exposure', 'Grows with the 2018-22 online boom and with operator revenue (R2: revenue buys marketing). The ad ban removes it stage by stage.'],
  ['Market & social norms', 'Operator revenue', 'Gambling expenditure minus tax.'],
  ['Market & social norms', 'Gambling accessibility', 'Online and fast betting grew 2018-22; stronger regulation cuts it (B1).'],
  ['Market & social norms', 'Gambling participation', 'Share of adults who gamble. People start more with more exposure, marketing and accessibility.'],
  ['Market & social norms', 'Gambling expenditure', 'Sum of everyone\'s losses. At-risk gamblers spend much more, so the stock drives expenditure.'],
  ['Individual harm', 'Gambling intensity, gambling losses', 'Each person loses a multiple of the base spend by risk level, more if they gamble to cope. Affordability checks cap losses above the threshold.'],
  ['Individual harm', 'Financial stress', 'Losses relative to the person\'s income. Raises escalation to high risk and slows stepping down.'],
  ['Individual harm', 'Gambling as coping', 'Driven by financial stress and social isolation; makes people gamble harder (R3) and escalate.'],
  ['Individual harm', 'Gambling-related harm', 'Harm units by risk level (1 low : 3 moderate : 10 high). Social cost = harm units × $8,100 a year (Victoria 2023 study).'],
  ['Individual harm', 'Emotional distress → family conflict → social isolation', 'Each follows the one before with a delay. Isolation slows exits and help-seeking, and feeds coping (R4).'],
  ['Government & public response', 'Gambling tax revenue', '30% of gambling expenditure.'],
  ['Government & public response', 'Government spend', 'A share of tax revenue spent on harm services (it follows revenue only partly, after a budget delay), plus the recovery support budget.'],
  ['Government & public response', 'Treatment & counselling capacity', 'Places funded by government spend, plus more when public pressure is high; takes about a year to build. Admits people from the waiting list and speeds stepping down.'],
  ['Government & public response', 'Awareness of harm', 'Follows gambling-related harm with a ~2-year delay; the campaign adds to it.'],
  ['Government & public response', 'Help-seeking', 'Rises with awareness, the campaign and helplines; isolated people seek less help.'],
  ['Government & public response', 'Public pressure to reform', 'Follows awareness. Lowers social acceptance and wins funding for services.'],
  ['Government & public response', 'Regulatory strength', 'Follows public pressure with a ~3-year delay (laws take time) and cuts accessibility.'],
];

export function renderModelDoc(host: HTMLElement) {
  const rows = (Object.keys(PARAMS) as ParamKey[]).map((k) => {
    const p = PARAMS[k];
    return `<tr><td><code>${k}</code></td><td>${p.value}</td><td>${esc(p.unit)}</td><td>${p.range[0]} – ${p.range[1]}</td><td>${esc(p.source)}</td><td class="conf-${p.confidence}">${p.confidence}</td></tr>`;
  }).join('');
  const vars = VARIABLES.map(([zone, name, how]) => `<tr><td>${esc(zone)}</td><td><b>${esc(name)}</b></td><td>${esc(how)}</td></tr>`).join('');
  const ivs = INTERVENTIONS.map((m) => `<li><b>${m.n}. ${esc(m.title)}</b> (evidence: ${m.evidence}). ${esc(m.concept)} <i>In the model:</i> ${esc(m.acts)}. ${esc(m.evidenceNote)}</li>`).join('');
  host.innerHTML = `
  <h3>Built on the group's causal loop diagram</h3>
  <p>Every variable in the simulation is a box in the group's causal loop diagram (see the Causal loops tab). The only extra quantity is the <b>social cost of harm</b>, calculated as before.</p>
  <h3>The central stock</h3>
  <p><b>At-risk gamblers</b>: every Australian adult scoring PGSI 1 or more (low, moderate and high risk, plus people in treatment). It has one inflow, <b>entering at-risk gambling</b> (PGSI 0 → 1+), and one outflow, <b>exit from risk</b> (PGSI 1+ → 0, through natural recovery, help-seeking and treatment). Inside the stock people can escalate (low → moderate → high) or step down.</p>
  <p>The three goals map to the three places you can act: <b>Goal 1</b> fewer adults entering risk (the inflow), <b>Goal 2</b> less harm for everyone at risk (the social cost of harm), <b>Goal 3</b> more people recovering (the outflow, as a share of the stock).</p>
  <h3>The variables</h3>
  <div class="tbl"><table><thead><tr><th>Part of the diagram</th><th>Variable</th><th>How the model calculates it</th></tr></thead><tbody>${vars}</tbody></table></div>
  <h3>The four interventions</h3>
  <ul>${ivs}</ul>
  <p>All four start in the year chosen in “Interventions from”. The campaign, affordability checks and recovery support phase in over about six months. The ad ban follows its phase-out: inducements first, then social media at one third of the period, TV, radio and online ads at two thirds, and sponsorship at the end.</p>
  <h3>Delays</h3>
  <p>The diagram marks the slow links with ‖. In the model: social acceptance moves over about 5 years; awareness of harm builds over about 2 years; regulation follows public pressure over about 3 years; government spend follows tax revenue after a budget cycle (1 year); treatment & counselling places take about a year to build; social isolation builds over about a year after family conflict.</p>
  <h3>How a person changes state</h3>
  <p>Each adult is an agent with a home on the map of Australia, a sex, an age, an income and a social network of nearby people plus a few long-range ties. For every possible transition, <code>rate = base × Π(multipliers)</code> and <code>p = 1 − exp(−rate × 1 month)</code>. Multipliers come from the diagram's variables (marketing exposure, accessibility, exposure, coping, financial stress, isolation, help-seeking, treatment & counselling coverage), centred so the 2018 status quo equals 1. Transitions go both up and down: natural recovery is the most common way out of risk.</p>
  <h3>Calibration</h3>
  <p>Base rates were set so that 2018 matches HILDA (3.7% low, 2.5% moderate, 1.1% high risk) with about $28bn of gambling losses a year and about half of all spending coming from at-risk gamblers. The 2018-22 online and sports-betting boom (rising accessibility and marketing) was then tuned so that 2022 lands near HILDA's 9.8%. Automated tests check both. After 2022 the boom levels off; the status quo keeps rising for a few years because the stock takes time to catch up, then public pressure and regulation slowly bend it down.</p>
  <h3>Feedback loops</h3>
  <ul>${LOOPS.map((l) => `<li><b>${l.id} ${esc(l.name)}</b> (${l.type}): ${esc(l.text)}</li>`).join('')}</ul>
  <h3>Limitations</h3>
  <ul>
    <li>Adults only (18+); youth gambling and loot boxes are not modelled.</li>
    <li>Most arrow strengths are directional evidence plus assumptions; the sensitivity tab shows which ones drive the results.</li>
    <li>Social cost depends only on risk level, so interventions reduce it by moving people to lower risk, not by reducing harm within a level.</li>
    <li>The offshore market, alcohol and drugs, and the politics of gambling revenue are outside this version of the diagram.</li>
    <li>Prevention-paradox weighting follows Browne & Rockloff; others (Delfabbro & King) dispute it.</li>
  </ul>
  <h3>Parameters</h3>
  <div class="tbl"><table><thead><tr><th>Key</th><th>Value</th><th>Unit</th><th>Range</th><th>Source / assumption</th><th>Confidence</th></tr></thead><tbody>${rows}</tbody></table></div>
  <h3>Sources</h3>
  <ul>${SOURCES.map(([t, u]) => `<li><a href="${u}" target="_blank" rel="noopener">${esc(t)}</a></li>`).join('')}</ul>`;
}
