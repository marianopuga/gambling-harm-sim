export type AdBan = 0 | 1 | 2; // none / partial / full

export interface Levers {
  availability: number; // 0-100
  marketing: number; // 0-100
  innovation: number; // 0-100
  taxRate: number; // 0-60 (%)
  startDependency: number; // 0-15 (% of budget) — initial condition
  earmarking: number; // 0-100 (% of tax to good causes)
  levy: number; // 0-20 (% of tax to treatment & prevention)
  alcohol: number; // 0-30 (% adults with alcohol use disorder)
  drugs: number; // 0-15 (% adults with drug use disorder)
  integratedServices: boolean;
  earlyDetection: boolean;
  socialPressure: number; // 0-100
  acceptance: number; // 0-100 — cultural anchor of social acceptance
  support: number; // 0-100 — state support for gamblers
  adBan: AdBan;
  stakeLimits: boolean;
  depositLimits: boolean;
  affordability: boolean;
  selfExclusion: boolean;
  ageVerification: boolean; // strong age verification
  inPlayBan: boolean;
  enforcement: number; // 0-100
  prohibition: boolean;
}

export const DEFAULT_LEVERS: Levers = {
  availability: 50,
  marketing: 50,
  innovation: 50,
  taxRate: 30,
  startDependency: 7.5,
  earmarking: 0,
  levy: 2,
  alcohol: 10,
  drugs: 4,
  integratedServices: false,
  earlyDetection: false,
  socialPressure: 50,
  acceptance: 60,
  support: 20,
  adBan: 0,
  stakeLimits: false,
  depositLimits: false,
  affordability: false,
  selfExclusion: false,
  ageVerification: false,
  inPlayBan: false,
  enforcement: 30,
  prohibition: false,
};

export type Evidence = 'high' | 'medium' | 'low';

export interface LeverMeta {
  key: keyof Levers;
  label: string;
  group: 'Market & industry' | 'Fiscal' | 'Health & social' | 'Regulation';
  kind: 'range' | 'toggle' | 'select';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  options?: string[];
  evidence: Evidence;
  tip: string;
  /** +1 if raising the lever is expected to reduce harm (subject to political resistance) */
  reformSign: 1 | -1 | 0;
}

export const LEVER_META: LeverMeta[] = [
  { key: 'availability', label: 'Availability', group: 'Market & industry', kind: 'range', min: 0, max: 100, step: 1, evidence: 'medium', reformSign: -1,
    tip: 'Density of venues and gaming machines plus ease of online access. Raises the chance of starting, escalating and relapsing (availability/exposure theory).' },
  { key: 'marketing', label: 'Marketing', group: 'Market & industry', kind: 'range', min: 0, max: 100, step: 1, evidence: 'medium', reformSign: -1,
    tip: 'Advertising volume, sports sponsorship, bonuses and free bets. Feeds social acceptance and raises starting and escalation (dose-response evidence, mostly correlational).' },
  { key: 'innovation', label: 'Product innovation', group: 'Market & industry', kind: 'range', min: 0, max: 100, step: 1, evidence: 'medium', reformSign: -1,
    tip: 'In-play betting, faster events, mobile UX, micro-betting. Shifts the product mix toward fast, continuous, higher-risk products.' },
  { key: 'taxRate', label: 'Gambling tax rate', group: 'Fiscal', kind: 'range', min: 0, max: 60, step: 1, unit: '% of GGR', evidence: 'low', reformSign: 0,
    tip: 'Tax on legal gambling losses (GGR). Australian states collect roughly $10bn a year. Above ~30% some play moves to offshore operators (channelization evidence is contested and partly industry-funded).' },
  { key: 'startDependency', label: 'Initial fiscal dependency', group: 'Fiscal', kind: 'range', min: 0, max: 15, step: 0.5, unit: '% of state tax', evidence: 'high', reformSign: 0,
    tip: 'Share of state tax revenue that comes from gambling at the start (Australia ~7.5%; NSW ~7%, WA ~2%). Dependency then evolves with tax revenue and fuels political resistance to reform.' },
  { key: 'earmarking', label: 'Earmarking for good causes', group: 'Fiscal', kind: 'range', min: 0, max: 100, step: 5, unit: '% of tax', evidence: 'low', reformSign: 0,
    tip: 'Share of gambling tax tied to sport, culture or charities. Creates constituencies that defend gambling revenue, adding political resistance.' },
  { key: 'levy', label: 'Harm-reduction levy', group: 'Fiscal', kind: 'range', min: 0, max: 20, step: 0.5, unit: '% of tax', evidence: 'medium', reformSign: 1,
    tip: 'Share of gambling tax ring-fenced for treatment and prevention. Funds treatment capacity, but its budget shrinks when gambling shrinks (Shifting the Burden).' },
  { key: 'alcohol', label: 'Alcohol use disorder', group: 'Health & social', kind: 'range', min: 0, max: 30, step: 0.5, unit: '% adults', evidence: 'high', reformSign: -1,
    tip: 'Prevalence of alcohol use disorder. In NESARC, 73% of people with pathological gambling had a lifetime alcohol use disorder; it raises escalation and slows recovery.' },
  { key: 'drugs', label: 'Drug use disorder', group: 'Health & social', kind: 'range', min: 0, max: 15, step: 0.5, unit: '% adults', evidence: 'high', reformSign: -1,
    tip: 'Prevalence of drug use disorder (38% lifetime among pathological gamblers in NESARC). Coupled both ways with gambling escalation.' },
  { key: 'integratedServices', label: 'Integrated addiction services', group: 'Health & social', kind: 'toggle', evidence: 'low', reformSign: 1,
    tip: 'Treat gambling, alcohol and drugs together. Raises treatment success and removes the comorbidity dropout penalty.' },
  { key: 'earlyDetection', label: 'Early detection (low → moderate)', group: 'Health & social', kind: 'toggle', evidence: 'low', reformSign: 1,
    tip: 'Screen for early warning signs (PGSI, account data, GP visits) and offer brief help before low risk becomes moderate. Slows escalation, speeds de-escalation and doubles early help-seeking. Costs ~$72M a year.' },
  { key: 'socialPressure', label: 'Social pressure', group: 'Health & social', kind: 'range', min: 0, max: 100, step: 1, evidence: 'low', reformSign: -1,
    tip: 'How strongly people copy their peers. Scales contagion through the social network.' },
  { key: 'acceptance', label: 'Cultural acceptance', group: 'Health & social', kind: 'range', min: 0, max: 100, step: 1, evidence: 'low', reformSign: -1,
    tip: 'The cultural anchor for social acceptance of gambling. Actual acceptance is a slow stock (~5-year time constant) pushed by marketing and participation, pulled down by visible harm.' },
  { key: 'support', label: 'Early support access', group: 'Health & social', kind: 'range', min: 0, max: 100, step: 1, evidence: 'medium', reformSign: 1,
    tip: 'Treatment capacity, helplines and awareness campaigns, paid from the general budget. Raises help-seeking and treatment slots. Only ~20% of people with problem gambling ever seek help.' },
  { key: 'adBan', label: 'Gambling advertising ban', group: 'Regulation', kind: 'select', options: ['None', 'Partial', 'Full'], evidence: 'medium', reformSign: 1,
    tip: 'The tobacco playbook: partial ban (e.g. no ads around live sport) halves effective marketing; a full ban (Murphy inquiry 2023 recommendation) cuts it by 90% — and also blunts the online-wagering boom. Works mainly by stopping new people becoming at-risk, so it is slow.' },
  { key: 'stakeLimits', label: 'Mandatory loss limits', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'Caps how much can be lost per day/month on pokies and online accounts. Lowers spend and escalation — but only in licensed channels; a little play moves offshore.' },
  { key: 'depositLimits', label: 'Mandatory deposit limits', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'Players must set a deposit limit. Lowers spend and escalation; raises de-escalation.' },
  { key: 'affordability', label: 'Affordability checks', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'Operators must verify that heavy spend is affordable. Strongly cuts spend and debt for at-risk players; some move to illegal operators.' },
  { key: 'selfExclusion', label: 'National self-exclusion registry', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'One registration blocks all licensed operators. Raises help-seeking and recovery, lowers relapse — but not for illegal operators.' },
  { key: 'ageVerification', label: 'Strong age verification', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'Strict ID checks. Lowers gambling uptake among 18-24 year-olds (and blocks underage play, which is outside this adult model).' },
  { key: 'inPlayBan', label: 'Ban in-play betting', group: 'Regulation', kind: 'toggle', evidence: 'low', reformSign: 1,
    tip: 'Removes in-play betting from the legal product mix. Part of the demand moves to illegal operators.' },
  { key: 'enforcement', label: 'Enforcement vs illegal operators', group: 'Regulation', kind: 'range', min: 0, max: 100, step: 1, evidence: 'low', reformSign: 1,
    tip: 'Blocking, payment controls and prosecution. Pulls play back from the illegal channel; costs budget.' },
  { key: 'prohibition', label: 'Prohibition', group: 'Regulation', kind: 'toggle', evidence: 'medium', reformSign: 1,
    tip: 'Bans all legal gambling. Tax revenue goes to zero and much of the remaining demand moves to unregulated operators with no protections.' },
];

export interface Scenario {
  id: string;
  name: string;
  description: string;
  levers: Partial<Levers>;
}
