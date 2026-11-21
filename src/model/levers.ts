/**
 * Everything the player can change: the group's four interventions (switches) and one lever per variable
 * of the causal loop diagram. Every default reproduces the 2018 status quo, so moving a lever answers
 * "what happens if X increases?".
 */
export interface Levers {
  // our interventions
  adBan: boolean;
  adBanYears: number; // phase-out: inducements → social media → broadcast → sponsorship
  campaign: boolean;
  affordability: boolean;
  affordabilityThreshold: number; // AUD lost per month that triggers a check
  support: boolean;
  // market & social norms (0-100; defaults = 2018)
  acceptance: number;
  exposure: number;
  marketing: number;
  revenue: number;
  accessibility: number;
  participation: number;
  expenditure: number;
  // individual harm
  intensity: number;
  losses: number;
  stress: number;
  coping: number;
  harm: number;
  distress: number;
  conflict: number;
  isolation: number;
  // government & public response
  taxRate: number; // % of gambling losses
  govSpend: number; // % of gambling tax spent on harm services
  capacity: number;
  awareness: number;
  helpSeeking: number;
  pressure: number;
  regulation: number;
}

export const DEFAULT_LEVERS: Levers = {
  adBan: false, adBanYears: 3, campaign: false, affordability: false, affordabilityThreshold: 1000, support: false,
  acceptance: 60, exposure: 50, marketing: 50, revenue: 50, accessibility: 50, participation: 50, expenditure: 50,
  intensity: 50, losses: 50, stress: 50, coping: 50, harm: 50, distress: 50, conflict: 50, isolation: 50,
  taxRate: 30, govSpend: 4.2, capacity: 50, awareness: 30, helpSeeking: 50, pressure: 30, regulation: 30,
};

export type Evidence = 'high' | 'medium' | 'low';
export type InterventionKey = 'adBan' | 'campaign' | 'affordability' | 'support';
export const INTERVENTION_KEYS: InterventionKey[] = ['adBan', 'campaign', 'affordability', 'support'];

export interface LeverMeta {
  key: keyof Levers;
  label: string;
  group: 'Our interventions' | 'Market & social norms' | 'Individual harm' | 'Government & public response';
  kind: 'range' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  values?: number[];
  evidence: Evidence;
  tip: string;
}

const r = (key: keyof Levers, label: string, group: LeverMeta['group'], evidence: Evidence, tip: string, extra: Partial<LeverMeta> = {}): LeverMeta =>
  ({ key, label, group, kind: 'range', min: 0, max: 100, step: 1, evidence, tip, ...extra });

export const LEVER_META: LeverMeta[] = [
  r('acceptance', 'Social acceptance', 'Market & social norms', 'low', 'How normal gambling feels (cultural anchor). Actual acceptance is a slow stock (~5 years) pushed by participation (R1) and pulled down by public pressure.', { unit: '%' }),
  r('exposure', 'Exposure to gambling', 'Market & social norms', 'low', 'Everyday exposure: friends who bet, venues, sport. More exposure → more people start gambling and more become at risk.'),
  r('marketing', 'Marketing exposure', 'Market & social norms', 'medium', 'Base level of gambling advertising (50 = 2018). Raises starting and escalation, especially for young men.'),
  r('revenue', 'Operator revenue', 'Market & social norms', 'low', 'How much operator revenue is turned back into marketing (R2). Higher = a stronger marketing spiral as revenue grows.'),
  r('accessibility', 'Gambling accessibility', 'Market & social norms', 'medium', 'Ease of access: venues, pokies, online apps, betting speed (50 = 2018).'),
  r('participation', 'Gambling participation', 'Market & social norms', 'medium', 'How readily adults take up gambling (50 = 2018). More gamblers → more people who can become at risk.'),
  r('expenditure', 'Gambling expenditure', 'Market & social norms', 'medium', 'Average spend per gambler (50 = 2018, ~$28bn a year). Raises losses, tax and operator revenue.'),

  r('intensity', 'Gambling intensity', 'Individual harm', 'medium', 'How hard people gamble (fast products, in-play). Raises escalation low → moderate → high.'),
  r('losses', 'Gambling losses', 'Individual harm', 'medium', 'Losses per at-risk gambler (50 = 2018). Feeds financial stress.'),
  r('stress', 'Financial stress', 'Individual harm', 'low', 'How strongly losses turn into financial stress. Stress drives escalation to high risk.'),
  r('coping', 'Gambling as coping', 'Individual harm', 'low', 'How much people gamble to cope with stress and isolation (R3, R4).'),
  r('harm', 'Gambling-related harm', 'Individual harm', 'medium', 'Severity of harm per at-risk gambler (50 = Victorian 2023 weights). Raises social cost and awareness.'),
  r('distress', 'Emotional distress', 'Individual harm', 'low', 'How much harm turns into emotional distress.'),
  r('conflict', 'Family conflict', 'Individual harm', 'low', 'How much distress turns into family conflict.'),
  r('isolation', 'Social isolation', 'Individual harm', 'low', 'How much conflict turns into isolation. Isolation slows recovery and help-seeking.'),

  r('taxRate', 'Gambling tax revenue', 'Government & public response', 'high', 'Tax rate on gambling losses (states collect ~30%).', { max: 60, unit: '% of losses' }),
  r('govSpend', 'Government spend', 'Government & public response', 'medium', 'Share of gambling tax spent on harm services.', { max: 20, step: 0.2, unit: '% of tax' }),
  r('capacity', 'Treatment & counselling capacity', 'Government & public response', 'medium', 'Places per dollar of government spend (50 = 2018, ~19k places).'),
  r('awareness', 'Awareness of harm', 'Government & public response', 'low', 'Public awareness of gambling harm (30 = 2018). Builds over ~2 years.'),
  r('helpSeeking', 'Help-seeking', 'Government & public response', 'medium', 'How readily people at risk seek help (50 = 2018; only ~1 in 5 with problem gambling ever do).'),
  r('pressure', 'Public pressure to reform', 'Government & public response', 'low', 'Pressure on government to act (30 = 2018). Lowers social acceptance and funds services.'),
  r('regulation', 'Regulatory strength', 'Government & public response', 'medium', 'Strength of gambling regulation (30 = 2018). Builds over ~3 years and cuts accessibility.'),

  { key: 'adBan', label: '1 · Ban gambling ads', group: 'Our interventions', kind: 'toggle', evidence: 'medium',
    tip: 'Phase out all gambling advertising: inducements and social media first, sponsorship last. Cuts marketing exposure. Murphy inquiry (2023) recommended a 3-year phased ban.' },
  { key: 'adBanYears', label: 'Ad ban phase-out', group: 'Our interventions', kind: 'select', options: ['1 yr', '2 yrs', '3 yrs', '4 yrs', '5 yrs'], values: [1, 2, 3, 4, 5], evidence: 'medium',
    tip: 'How many years the ad ban takes, from inducements (now) to sponsorship (last).' },
  { key: 'campaign', label: '2 · Anti-gambling campaign', group: 'Our interventions', kind: 'toggle', evidence: 'low',
    tip: 'Flip the "mates and footy" image; humour aimed at the industry, not the gambler. Lowers social acceptance, raises awareness and help-seeking.' },
  { key: 'affordability', label: '3 · Affordability checks', group: 'Our interventions', kind: 'toggle', evidence: 'low',
    tip: 'Above the monthly loss threshold, operators verify ability to pay; if not, deposits stop. Cuts losses and financial stress.' },
  { key: 'affordabilityThreshold', label: 'Check when losses pass', group: 'Our interventions', kind: 'select', options: ['$500', '$1,000', '$2,000'], values: [500, 1000, 2000], evidence: 'low',
    tip: 'Monthly losses that trigger an affordability check.' },
  { key: 'support', label: '4 · Recovery support programs', group: 'Our interventions', kind: 'toggle', evidence: 'medium',
    tip: 'Counselling, helplines, legal, financial and psychological support ($150M a year). More treatment & counselling places, more help-seeking.' },
];

export const isChanged = (a: Levers, b: Levers) => JSON.stringify(a) !== JSON.stringify(b);
