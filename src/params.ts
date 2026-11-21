/**
 * Every constant of the model lives here, with unit, plausible range, source and confidence.
 * The model's variables are the ones in the group's causal loop diagram; these constants say how strongly
 * each arrow pushes. "ASSUMPTION" means no direct empirical estimate was found; the value was chosen to be
 * plausible and to reproduce the calibration targets (HILDA 2018 and 2022).
 */
export type Confidence = 'high' | 'medium' | 'low';
export interface Param {
  value: number;
  unit: string;
  range: [number, number];
  source: string;
  confidence: Confidence;
  note?: string;
}

const p = (value: number, unit: string, range: [number, number], source: string, confidence: Confidence, note?: string): Param =>
  ({ value, unit, range, source, confidence, note });

const CAL = 'Calibrated: status quo reproduces HILDA 2018 (3.7% low, 2.5% moderate, 1.1% high risk)';

export const PARAMS = {
  // ---------- Time & scale ----------
  burnInMonths: p(120, 'months', [60, 240], 'Modelling choice', 'high'),
  horizonMonths: p(240, 'months', [120, 360], 'Modelling choice', 'high'),
  adultPopulation: p(20_800_000, 'adults', [19e6, 22e6], 'ABS: Australian adults 18+, ~2018-2022', 'high'),
  trendPerYear: p(12, 'index points / year', [0, 20], 'Calibrated: HILDA at-risk 7.3% (2018) → 9.8% (2022): the online and sports-betting boom raises accessibility and marketing', 'medium'),
  trendYears: p(4, 'years', [4, 20], 'ASSUMPTION: the boom grows until 2022 (online betting surge), then plateaus', 'low'),

  // ---------- Base monthly transition hazards (status quo) ----------
  h_NG_NR: p(0.011, '1/month', [0.005, 0.02], CAL + '; ~62% of adults gamble', 'medium'),
  h_NR_NG: p(0.006, '1/month', [0.003, 0.012], CAL, 'medium'),
  h_NR_LR: p(0.0049, '1/month', [0.003, 0.012], CAL + ' (entering at-risk gambling)', 'medium'),
  h_LR_NR: p(0.055, '1/month', [0.03, 0.08], 'ANU 2023: >60% of low-risk gamblers move down or stop by the next wave', 'medium'),
  h_LR_NG: p(0.006, '1/month', [0.003, 0.012], CAL, 'low'),
  h_LR_MR: p(0.030, '1/month', [0.008, 0.03], CAL, 'medium'),
  h_MR_LR: p(0.045, '1/month', [0.025, 0.07], 'Swelogs: high turnover, mean moderate-risk episode ~18 months', 'medium'),
  h_MR_PG: p(0.008, '1/month', [0.004, 0.015], CAL, 'medium'),
  h_MR_TX: p(0.0012, '1/month', [0.0005, 0.003], 'Bijker 2022: ~3.7% of moderate-risk gamblers ever sought help', 'medium'),
  h_PG_MR: p(0.022, '1/month', [0.012, 0.04], 'Natural recovery dominates exits (longitudinal PGSI studies)', 'medium'),
  h_PG_TX: p(0.0055, '1/month', [0.002, 0.01], 'Bijker 2022: ~20.6% of problem gamblers ever sought help', 'medium'),
  h_TX_RC: p(0.12, '1/month', [0.06, 0.2], 'ASSUMPTION: ~6-8 month treatment episode', 'low'),
  h_TX_PG: p(0.04, '1/month', [0.02, 0.08], 'ASSUMPTION: dropout', 'low'),
  h_RC_PG: p(0.012, '1/month', [0.005, 0.03], 'ASSUMPTION: relapse', 'low'),
  h_RC_MR: p(0.010, '1/month', [0.005, 0.03], 'ASSUMPTION: partial relapse', 'low'),
  h_RC_NG: p(0.025, '1/month', [0.01, 0.05], 'ASSUMPTION: stable abstinence', 'low'),

  // ---------- Market & social norms (arrow strengths) ----------
  b_accessibility: p(0.9, 'log-mult per unit accessibility', [0.3, 1.5], 'Availability/exposure theory; direction high, size ASSUMPTION', 'medium'),
  b_marketing: p(0.6, 'log-mult per unit marketing exposure', [0.2, 1.2], 'Bouguettaya et al. 2020 meta-analysis (dose-response)', 'medium'),
  b_exposure: p(1.2, 'log-mult per unit exposure', [0.4, 2.0], 'ASSUMPTION: social-norms literature', 'low'),
  b_peerStart: p(1.5, 'log-mult per unit share of friends who gamble', [0.5, 4], 'ASSUMPTION; NetLogo social-influence model', 'low'),
  acceptanceAnchor: p(0.6, 'index 0-1', [0.4, 0.8], 'ASSUMPTION: gambling is widely accepted in Australia', 'low'),
  a_participation: p(0.4, 'acceptance per unit participation', [0.1, 1], 'ASSUMPTION (R1: more people gambling makes it feel normal)', 'low'),
  a_pressure: p(0.5, 'acceptance per unit public pressure', [0.1, 1], 'ASSUMPTION (public pressure lowers acceptance)', 'low'),
  tau_acceptance: p(60, 'months', [24, 120], 'ASSUMPTION: cultural norms move slowly', 'low'),
  m_revenue: p(0.1, 'elasticity of marketing to operator revenue', [0, 1], 'ASSUMPTION (R2: operators reinvest revenue in marketing)', 'low'),
  tau_marketing: p(6, 'months', [2, 12], 'ASSUMPTION: marketing budgets follow revenue within a year', 'low'),
  a_regulation: p(1.3, 'accessibility per unit regulatory strength', [0.2, 1.5], 'ASSUMPTION (B1: stronger regulation cuts access)', 'low'),
  b_youngMenMarketing: p(1.0, 'log-mult per unit marketing (men 18-34)', [0.3, 2], 'Sports-betting marketing targets young men (AIHW 2023; Murphy inquiry 2023)', 'low'),
  maleRisk: p(1.4, '× escalation', [1.1, 2], 'HILDA: men ~2× more likely than women to be at moderate/high risk', 'medium'),
  femaleRisk: p(0.62, '× escalation', [0.4, 0.9], 'idem', 'medium'),
  youngMenRisk: p(1.3, '× escalation, men 18-34', [1, 2], 'HILDA / AIHW: young men are the highest-risk group', 'medium'),

  // ---------- Individual harm (per person) ----------
  incomeMedian: p(5200, 'AUD / month after tax', [3500, 7000], 'ABS: median personal income ~$62k/yr', 'medium'),
  stressScale: p(0.3, 'losses / income giving stress 0.63', [0.05, 0.3], 'ASSUMPTION', 'low'),
  copingIntensity: p(0.6, '× intensity per unit coping', [0.3, 2], 'ASSUMPTION (R3: gambling to cope means gambling harder)', 'low'),
  b_coping: p(1.0, 'log-mult on escalation per unit coping', [0.3, 2], 'ASSUMPTION (coping motives predict escalation)', 'low'),
  b_isolation: p(1.2, 'log-mult on exits per unit isolation', [0.3, 2.5], 'ASSUMPTION (social isolation slows recovery)', 'low'),
  b_stress: p(1.5, 'log-mult per unit financial stress', [0.2, 1.5], 'ASSUMPTION (debt and stress drive chasing losses)', 'low'),
  tau_stress: p(3, 'months', [1, 6], 'ASSUMPTION', 'low'),
  tau_coping: p(3, 'months', [1, 6], 'ASSUMPTION', 'low'),
  tau_distress: p(3, 'months', [1, 6], 'ASSUMPTION', 'low'),
  tau_conflict: p(6, 'months', [2, 12], 'ASSUMPTION', 'low'),
  tau_isolation: p(12, 'months', [6, 24], 'ASSUMPTION: isolation builds over a year', 'low'),

  // ---------- Money ----------
  baseSpend: p(85, 'AUD / month', [40, 150], 'Calibrated: Australian gambling losses ≈ $25bn/yr (QGSO Australian Gambling Statistics)', 'medium'),
  spend_NR: p(1, '× baseSpend', [1, 1], 'Reference', 'high'),
  spend_LR: p(3, '× baseSpend', [2, 5], 'Calibrated: at-risk share of losses 40-55% (GB, AU studies)', 'medium'),
  spend_MR: p(8, '× baseSpend', [5, 12], 'Calibrated (idem)', 'medium'),
  spend_PG: p(25, '× baseSpend', [15, 40], 'Calibrated (idem); Orford et al. 2013', 'medium'),
  taxRate: p(0.3, 'share of gambling losses', [0.2, 0.4], 'States collect ~30% of gambling losses as tax', 'medium'),
  servicesShare: p(0.042, 'share of gambling tax spent on harm services', [0.01, 0.1], 'ASSUMPTION: ~$300M/yr on gambling help services nationally', 'low'),
  costPerPlace: p(1500, 'AUD / month per treatment & counselling place', [500, 4000], 'ASSUMPTION', 'low'),
  govSpendElasticity: p(0.5, 'elasticity of harm-service spending to tax revenue', [0, 1], 'ASSUMPTION: budgets are sticky; they follow revenue only partly', 'low'),
  tau_govSpend: p(12, 'months', [6, 24], 'Budget cycle', 'medium'),
  tau_capacity: p(12, 'months', [6, 24], 'ASSUMPTION: hiring and training counsellors', 'low'),
  pressureCapacity: p(1.0, 'capacity per unit public pressure', [0, 2], 'ASSUMPTION (pressure wins funding for services)', 'low'),
  k_coverage: p(0.4, 'extra de-escalation per unit extra coverage', [0.1, 1], 'ASSUMPTION (treatment & counselling lowers harm)', 'low'),

  // ---------- Public response ----------
  tau_awareness: p(24, 'months', [6, 48], 'ASSUMPTION: awareness of harm builds slowly', 'low'),
  tau_pressure: p(12, 'months', [6, 24], 'ASSUMPTION', 'low'),
  tau_regulation: p(36, 'months', [12, 60], 'ASSUMPTION: laws take years to pass and enforce', 'low'),
  b_awarenessHelp: p(1.5, 'log-mult per unit awareness', [0.5, 3], 'Bijker 2022: stigma and denial are the main barriers to help', 'low'),

  // ---------- Harm & social cost (kept from the original model) ----------
  harm_LR: p(1, 'harm units', [0.5, 2], 'Browne & Rockloff 2018 (prevention paradox)', 'medium'),
  harm_MR: p(3, 'harm units', [2, 5], 'idem', 'medium'),
  harm_PG: p(10, 'harm units', [6, 15], 'idem', 'medium'),
  costPerHarmUnit: p(8100, 'AUD / year per harm unit', [5000, 12000], 'Victoria 2023 social cost $14.1bn ÷ at-risk Victorians weighted 1:3:10 (low:moderate:high)', 'medium'),

  // ---------- The four interventions ----------
  policyDelay: p(6, 'months (3rd-order delay)', [3, 18], 'ASSUMPTION: time to set up a campaign, a rule or a programme', 'low'),
  adBanResidual: p(0.15, 'share of marketing exposure left after a full ban', [0.05, 0.4], 'ASSUMPTION: offshore ads, word of mouth, in-venue promotion', 'low'),
  campaignAcceptance: p(0.08, 'drop in social acceptance', [0.02, 0.15], 'ASSUMPTION: counter-marketing in the style of the US "truth" campaign', 'low'),
  campaignHelp: p(0.3, 'extra help-seeking', [0.1, 0.6], 'ASSUMPTION: makes asking for help normal', 'low'),
  campaignAwareness: p(0.1, 'extra awareness of harm', [0.02, 0.2], 'ASSUMPTION', 'low'),
  campaignCost: p(20e6, 'AUD / year', [5e6, 50e6], 'ASSUMPTION: national media campaign', 'low'),
  affordabilityCoverage: p(0.7, 'share of play covered', [0.4, 0.9], 'ASSUMPTION: online accounts and carded venue play; cash play is not checked', 'low'),
  affordableShare: p(0.1, 'share of income a person can afford to lose', [0.05, 0.2], 'ASSUMPTION', 'low'),
  supportBudget: p(150e6, 'AUD / year', [50e6, 400e6], 'ASSUMPTION: national counselling, helplines, legal and financial support', 'low'),
  supportBreadth: p(0.15, 'extra de-escalation and treatment success', [0.05, 0.4], 'ASSUMPTION: legal, financial and psychological support beyond treatment', 'low'),
  supportHelplines: p(0.3, 'extra help-seeking', [0.1, 0.6], 'ASSUMPTION', 'low'),
  supportStress: p(0.25, 'drop in financial stress for people in services', [0.1, 0.5], 'ASSUMPTION: financial counselling', 'low'),

  // ---------- Calibration constants ----------
  escalationScale: p(0.85, '×', [0.5, 1.5], 'Calibration constant (tests/calibration.test.ts)', 'medium'),
  pgScale: p(0.95, '× MR→PG hazard', [0.3, 1.5], 'Calibration constant (heterogeneity correction)', 'medium'),
  recoveryScale: p(1.0, '×', [0.5, 1.5], 'Calibration constant', 'medium'),
} satisfies Record<string, Param>;

export type ParamKey = keyof typeof PARAMS;
export type ParamValues = Record<ParamKey, number>;

export function defaultParamValues(): ParamValues {
  const out = {} as ParamValues;
  for (const k of Object.keys(PARAMS) as ParamKey[]) out[k] = PARAMS[k].value;
  return out;
}

/** HILDA (Wilkins et al. 2024, via AIHW): PGSI categories among Australian adults. */
export const HILDA = {
  2018: { low: 0.037, moderate: 0.025, high: 0.011, total: 0.073 },
  2022: { low: 0.049, moderate: 0.031, high: 0.018, total: 0.098 },
};
export const CALIBRATION_TARGETS = {
  low: HILDA[2018].low,
  moderate: HILDA[2018].moderate,
  problem: HILDA[2018].high,
  atRisk2022: HILDA[2022].total,
  gamblers: 0.62,
  atRiskRevenueShare: [0.38, 0.58] as [number, number],
};
