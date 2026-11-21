/**
 * The four interventions the group proposes. Each is a switch; two have one setting.
 * (The type keeps the name `Levers` so the worker and batch code stay unchanged.)
 */
export interface Levers {
  adBan: boolean;
  adBanYears: number; // phase-out length: inducements → social media → broadcast → sponsorship
  campaign: boolean;
  affordability: boolean;
  affordabilityThreshold: number; // AUD lost per month that triggers a check
  support: boolean;
}

export const DEFAULT_LEVERS: Levers = {
  adBan: false,
  adBanYears: 3,
  campaign: false,
  affordability: false,
  affordabilityThreshold: 1000,
  support: false,
};

export type Evidence = 'high' | 'medium' | 'low';
export type InterventionKey = 'adBan' | 'campaign' | 'affordability' | 'support';

export interface InterventionMeta {
  key: InterventionKey;
  n: number;
  title: string;
  concept: string;
  /** Where it acts in the causal loop diagram. */
  acts: string;
  evidence: Evidence;
  evidenceNote: string;
  setting?: { key: 'adBanYears' | 'affordabilityThreshold'; label: string; options: { value: number; label: string }[] };
}

export const INTERVENTIONS: InterventionMeta[] = [
  {
    key: 'adBan', n: 1, title: 'Ban gambling ads',
    concept: 'Phase out all gambling advertising: inducements and social media first, then TV, radio and online ads, and sponsorship last. Fewer ads mean fewer people drawn into risky gambling.',
    acts: 'Marketing exposure ↓ → fewer people start gambling and fewer become at risk',
    evidence: 'medium',
    evidenceNote: 'Ad exposure is linked to more gambling (Bouguettaya et al. 2020 meta-analysis). The Murphy inquiry (2023) recommended a phased ban over three years; comprehensive bans worked for tobacco.',
    setting: { key: 'adBanYears', label: 'Phase-out over', options: [1, 2, 3, 4, 5].map((v) => ({ value: v, label: `${v} year${v > 1 ? 's' : ''}` })) },
  },
  {
    key: 'campaign', n: 2, title: 'Anti-gambling campaign',
    concept: 'Flip the "mates and footy" image to show the man who can no longer enjoy the game. Humour aimed at the industry, not the gambler, makes betting less cool and asking for help normal.',
    acts: 'Social acceptance ↓, awareness of harm ↑, help-seeking ↑',
    evidence: 'low',
    evidenceNote: 'Counter-marketing aimed at the industry cut youth smoking in the US "truth" campaign (Farrelly et al. 2005). Evidence for gambling campaigns is still thin, and norms move slowly.',
  },
  {
    key: 'affordability', n: 3, title: 'Affordability checks',
    concept: 'Once losses pass a monthly threshold, operators must verify a customer\'s income and ability to pay. If they cannot, deposits stop before the harm grows.',
    acts: 'Gambling losses ↓ → financial stress ↓ → less gambling to cope (weakens R3)',
    evidence: 'low',
    evidenceNote: 'Great Britain brought in light-touch financial risk checks in August 2024 (£500 of net deposits a month, lowered to £150 in 2025) and is piloting fuller assessments. Effects on harm are not yet measured, and cash play is not covered.',
    setting: { key: 'affordabilityThreshold', label: 'Check when losses pass', options: [500, 1000, 2000].map((v) => ({ value: v, label: `$${v.toLocaleString('en-AU')} / month` })) },
  },
  {
    key: 'support', n: 4, title: 'Recovery support programs',
    concept: 'A range of counselling services, helplines, and access to legal, financial and psychological support to help people recover from gambling-related harm.',
    acts: 'Government spend ↑ → treatment & counselling capacity ↑ → less harm, more exits; help-seeking ↑',
    evidence: 'medium',
    evidenceNote: 'CBT reduces gambling in the months after treatment (Cochrane review, though the evidence is low quality), and financial counselling eases debt. Only about 1 in 5 people with problem gambling ever seek help, so reach is the bottleneck.',
  },
];

export const isChanged = (a: Levers, b: Levers) => JSON.stringify(a) !== JSON.stringify(b);
