/** All interface strings. Add a `es` block with the same keys to translate the UI. */
export const STRINGS = {
  en: {
    tagline: 'Pull the levers. Bring moderate and high-risk gambling down — without breaking the system.',
    scenario: 'Scenario', play: 'Play', pause: 'Pause', step: 'Step', reset: 'Reset', speed: 'Speed', settings: 'Settings',
    agents: 'Agents', seed: 'Seed', network: 'Network', compareWith: 'Compare with', share: 'Copy link', csv: 'Export CSV', theme: 'Toggle theme',
    levers: 'Levers', hide: 'Hide', show: 'Show',
    leverHint: 'Every run starts from today\'s status quo. Changes phase in through ~9-month implementation delays, and political resistance can water down harm-reducing reforms.',
    population: 'Population', ovSud: 'Alcohol/drug disorder ring', ovIllegal: 'Illegal channel', ovLinks: 'Long-range social ties',
    why: 'Why did that happen?', noEvents: 'Press Play. Notable events will be explained here as they emerge.',
    tabCharts: 'Charts', tabCld: 'Causal loops', tabAnalysis: 'Uncertainty & sensitivity', tabMissions: 'Missions', tabModel: 'Model & sources',
    mcTitle: 'Monte Carlo (20 seeds)', mcHint: 'Runs your current policy 20 times from the same start with different random seeds. The band shows the 5th–95th percentile of moderate + problem gambling.',
    sensTitle: 'Sensitivity (tornado)', sensHint: 'Each uncertain parameter is moved ±25% while everything else stays fixed. Bars show the resulting moderate + problem share after 10 years under your current policy (5 seeds each, common random numbers). Lever sensitivities (b_…) only matter once you move levers away from the status quo.',
    run: 'Run', running: 'Running…',
    disclaimerTitle: 'Educational model, not a forecast.',
    disclaimer: 'Parameters combine published estimates with stated assumptions (see Model & sources). Use it to explore system behaviour — feedback, delays and trade-offs — not to predict a real country.',
    helpline: 'If gambling is causing harm to you or someone close to you, help is free and confidential: <a href="https://www.gamblingtherapy.org" target="_blank" rel="noopener">GamblingTherapy.org</a> (international), 1-800-GAMBLER (US), National Gambling Helpline 0808 8020 133 (UK).',
    kTarget: 'Moderate + problem', kProblem: 'Problem gambling', kTax: 'Tax revenue / yr', kIllegal: 'Illegal channel',
    kBudget: 'Fiscal reserve', kResistance: 'Political resistance', kQueue: 'Treatment queue', kAffected: 'Affected others',
    goal: 'Goal: < 3.0% for 24 months', won: 'Goal reached — 24 months below 3% without a crisis',
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
