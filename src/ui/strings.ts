/** All interface strings. Add a `es` block with the same keys to translate the UI. */
export const STRINGS = {
  en: {
    tagline: 'Australia 2018 → 2038. Stop people becoming at risk, stop escalation, reduce harm — without breaking the system.',
    scenario: 'Scenario', play: 'Play', pause: 'Pause', step: 'Step', reset: 'Reset', speed: 'Speed', settings: 'Settings',
    agents: 'Agents', seed: 'Seed', network: 'Network', compareWith: 'Compare with', share: 'Copy link', csv: 'Export CSV', theme: 'Toggle theme',
    levers: 'Levers', hide: 'Hide', show: 'Show',
    leverHint: 'Every run starts in January 2018 (HILDA: 7.3% of adults at risk). Changes phase in through ~9-month implementation delays, and political resistance can water down harm-reducing reforms.',
    population: 'Population', ovSud: 'Alcohol/drug disorder ring', ovIllegal: 'Offshore operator (hollow)', ovLinks: 'Long-range social ties',
    why: 'Why did that happen?', noEvents: 'Press Play. Notable events will be explained here as they emerge.',
    tabCharts: 'Charts', tabCld: 'Causal loops', tabAnalysis: 'Uncertainty & sensitivity', tabMissions: 'Missions', tabModel: 'Model & sources',
    mcTitle: 'Monte Carlo (20 seeds)', mcHint: 'Runs your current policy 20 times from the same start with different random seeds. The band shows the 5th–95th percentile of at-risk gambling (low + moderate + high).',
    sensTitle: 'Sensitivity (tornado)', sensHint: 'Each uncertain parameter is moved ±25% while everything else stays fixed. Bars show the resulting at-risk share after 10 years under your current policy (5 seeds each, common random numbers). Lever sensitivities (b_…) only matter once you move levers away from the status quo.',
    run: 'Run', running: 'Running…',
    disclaimerTitle: 'Educational model, not a forecast.',
    disclaimer: 'Calibrated to HILDA (2018, 2022), Australian gambling statistics and the Victorian social-cost study, plus stated assumptions (see Model & sources). Use it to explore system behaviour — feedback, delays and trade-offs — not to forecast Australia.',
    helpline: 'If gambling is causing harm to you or someone close to you, help is free and confidential, 24/7: <a href="https://www.gamblinghelponline.org.au" target="_blank" rel="noopener">Gambling Help Online</a> · 1800 858 858 (Australia).',
    kTarget: 'At-risk gamblers', kProblem: 'High risk (PGSI 8+)', kTax: 'Tax revenue / yr', kIllegal: 'Illegal channel',
    kBudget: 'Fiscal reserve', kResistance: 'Political resistance', kQueue: 'Treatment queue', kAffected: 'Affected others',
    goal: 'Goal: below 2018 (7.3%) for 24 months', won: 'Goal reached — 24 months below the 2018 level, no crisis',
    month: 'Month', year: 'Year',
  },
};
export type StringKey = keyof typeof STRINGS.en;
let lang: keyof typeof STRINGS = 'en';
export const t = (k: StringKey): string => STRINGS[lang][k] ?? k;
export function applyStrings(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n as StringKey); });
  root.querySelectorAll<HTMLElement>('[data-i18n-html]').forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml as StringKey); });
}
