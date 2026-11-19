/**
 * Every constant of the model lives here, with unit, plausible range, source and confidence.
 * "ASSUMPTION" means no direct empirical estimate was found; the value was chosen to be
 * plausible and to reproduce the calibration targets in docs/01-research.md.
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

const CAL = 'Calibrated: Markov steady state matches status-quo targets (docs/02-design.md)';

export const PARAMS = {
  // ---------- Time & scale ----------
  burnInMonths: p(120, 'months', [60, 240], 'Modelling choice', 'high'),
  horizonMonths: p(240, 'months', [120, 360], 'Modelling choice', 'high'),
  adultPopulation: p(10_000_000, 'adults', [1e6, 300e6], 'ASSUMPTION (mid-size country)', 'high'),

  // ---------- Base monthly hazards (status quo) ----------
  h_NG_NR: p(0.011, '1/month', [0.005, 0.02], CAL + '; ~66% past-year gamblers', 'medium'),
  h_NR_NG: p(0.006, '1/month', [0.003, 0.012], CAL, 'medium'),
  h_NR_LR: p(0.012, '1/month', [0.006, 0.02], CAL, 'medium'),
  h_LR_NR: p(0.055, '1/month', [0.03, 0.08], 'ANU 2023: >60% of low-risk move down/stop by next wave', 'medium'),
  h_LR_NG: p(0.006, '1/month', [0.003, 0.012], CAL, 'low'),
  h_LR_MR: p(0.016, '1/month', [0.008, 0.03], CAL, 'medium'),
  h_MR_LR: p(0.045, '1/month', [0.025, 0.07], 'Swelogs: high turnover, mean MR episode ~18 months', 'medium'),
  h_MR_PG: p(0.008, '1/month', [0.004, 0.015], CAL, 'medium'),
  h_MR_TX: p(0.0012, '1/month', [0.0005, 0.003], 'Bijker 2022: ~3.7% of moderate-risk ever sought help', 'medium'),
  h_PG_MR: p(0.024, '1/month', [0.012, 0.04], 'Natural recovery dominates exits (longitudinal PGSI studies)', 'medium'),
  h_PG_TX: p(0.0055, '1/month', [0.002, 0.01], 'Bijker 2022: ~20.6% of problem gamblers ever sought help', 'medium'),
  h_TX_RC: p(0.12, '1/month', [0.06, 0.2], 'ASSUMPTION: ~6-8 month treatment episode', 'low'),
  h_TX_PG: p(0.04, '1/month', [0.02, 0.08], 'ASSUMPTION: dropout', 'low'),
  h_RC_PG: p(0.012, '1/month', [0.005, 0.03], 'ASSUMPTION: relapse', 'low'),
  h_RC_MR: p(0.010, '1/month', [0.005, 0.03], 'ASSUMPTION: partial relapse', 'low'),
  h_RC_NG: p(0.025, '1/month', [0.01, 0.05], 'ASSUMPTION: stable abstinence', 'low'),

  // ---------- Lever sensitivities (log-multiplier betas, per unit of centred lever) ----------
  b_availability: p(0.9, 'log-mult / full range', [0.3, 1.5], 'Availability/exposure theory; direction high, size ASSUMPTION', 'medium'),
  b_marketing: p(0.7, 'log-mult / full range', [0.2, 1.2], 'Bouguettaya 2020; 2022 umbrella review (dose-response)', 'medium'),
  b_innovation: p(0.8, 'log-mult / full range', [0.2, 1.4], 'Lancet Commission 2024: fast continuous products riskier', 'medium'),
  b_acceptance: p(1.2, 'log-mult per unit acceptance', [0.4, 2.0], 'ASSUMPTION: social-norms literature', 'low'),
  b_peerStart: p(1.5, 'log-mult per unit peer share × pressure', [0.5, 4], 'ASSUMPTION; NetLogo social-influence model', 'low'),
  b_peerRisk: p(0.8, 'log-mult per unit at-risk peer share × pressure', [0.5, 6], 'ASSUMPTION', 'low'),
  b_product: p(1.0, 'elasticity on product risk', [0.5, 1.5], 'Lancet Commission 2024 product gradient', 'medium'),
  b_awarenessHelp: p(1.5, 'log-mult per unit awareness', [0.5, 3], 'Bijker 2022: stigma and denial are main barriers', 'low'),
  b_supportHelp: p(1.2, 'log-mult / full range', [0.4, 2], 'ASSUMPTION', 'low'),

  // ---------- Comorbidity ----------
  alc_escalation: p(2.2, '×', [1.5, 4], 'NESARC (Petry 2005) ORs ~4-6 for SUD; halved for incidence', 'medium'),
  alc_recovery: p(0.6, '×', [0.4, 0.9], 'ASSUMPTION', 'low'),
  drug_escalation: p(2.5, '×', [1.5, 4], 'NESARC (Petry 2005)', 'medium'),
  drug_recovery: p(0.5, '×', [0.3, 0.9], 'ASSUMPTION', 'low'),
  gamblingToSud: p(2.0, '× SUD onset when MR/PG', [1, 4], 'Bidirectional association, NESARC', 'medium'),
  sudExitRate: p(1 / 36, '1/month', [1 / 72, 1 / 12], 'ASSUMPTION: ~3-year disorder episode', 'low'),
  integratedTxBoost: p(1.3, '× treatment success', [1, 1.6], 'ASSUMPTION', 'low'),

  // ---------- Product risk coefficients ----------
  risk_lottery: p(0.3, 'relative risk', [0.1, 0.6], 'Lowest at-risk revenue share (GB study)', 'medium'),
  risk_sports: p(0.8, 'relative risk', [0.5, 1.2], 'ASSUMPTION', 'low'),
  risk_inplay: p(1.4, 'relative risk', [1, 2], 'Lancet 2024: ~8.9% GD among sports bettors', 'medium'),
  risk_casino: p(1.8, 'relative risk', [1.2, 2.5], 'Lancet 2024: ~15.8% GD among online casino/slot gamblers', 'medium'),
  risk_egm: p(1.6, 'relative risk', [1.2, 2.2], 'Ontario: ~60% of machine revenue from PG', 'medium'),

  // ---------- Economics ----------
  baseSpend: p(40, 'currency / month', [10, 100], 'ASSUMPTION', 'low'),
  spend_NR: p(1, '× baseSpend', [1, 1], 'Reference', 'high'),
  spend_LR: p(3, '× baseSpend', [2, 5], 'Calibrated: at-risk share of GGR 40-50% (GB, AU studies)', 'medium'),
  spend_MR: p(8, '× baseSpend', [5, 12], 'Calibrated (idem)', 'medium'),
  spend_PG: p(25, '× baseSpend', [15, 40], 'Calibrated (idem); Orford et al. 2013', 'medium'),
  publicBudgetMonthly: p(4.4e9, 'currency / month', [1e9, 2e10], 'Set so gambling tax ≈ 2.5% of budget (Rockefeller Inst. 2016)', 'high'),
  treatmentCostPerSlot: p(1500, 'currency / month', [500, 4000], 'ASSUMPTION', 'low'),
  enforcementCostFull: p(25e6, 'currency / month at 100', [5e6, 1e8], 'ASSUMPTION', 'low'),
  campaignCostFull: p(15e6, 'currency / month at 100 support', [5e6, 5e7], 'ASSUMPTION', 'low'),
  supportBudgetFull: p(60e6, 'currency / month at 100 support', [1e7, 1e8], 'ASSUMPTION', 'low'),

  // ---------- Illegal channel ----------
  illegalBase: p(0.15, 'share of play', [0.05, 0.3], 'Online channelization 76-91% (PwC/BGC — industry-commissioned; UKGC)', 'low'),
  illegalTaxSlope: p(0.8, 'share per unit tax above 20%', [0.3, 1.5], 'Spain 25%→20% tax: 71%→76% channelization', 'low'),
  illegalRisk: p(1.3, '× escalation', [1, 2], 'ASSUMPTION: no protections', 'low'),
  illegalTau: p(18, 'months', [6, 36], 'ASSUMPTION', 'low'),

  // ---------- Slow stocks: time constants ----------
  tau_acceptance: p(60, 'months', [24, 120], 'ASSUMPTION: cultural norms move slowly', 'low'),
  tau_awareness: p(24, 'months', [6, 48], 'ASSUMPTION', 'low'),
  tau_influence: p(36, 'months', [12, 60], 'ASSUMPTION', 'low'),
  tau_dependency: p(12, 'months', [6, 24], 'Budget cycle', 'medium'),
  tau_resistance: p(6, 'months', [3, 12], 'ASSUMPTION', 'low'),
  tau_budgetAdapt: p(36, 'months', [12, 72], 'ASSUMPTION: governments restructure budgets over ~3 years', 'low'),
  tau_capacity: p(12, 'months', [6, 24], 'ASSUMPTION: hiring/training', 'low'),
  policyDelay: p(9, 'months (3rd-order delay)', [3, 24], 'ASSUMPTION: implementation lag', 'low'),
  resistanceAttenuation: p(0.7, 'max fraction of reform blocked', [0.3, 0.9], 'ASSUMPTION', 'low'),

  // ---------- Harm ----------
  affected_LR: p(1, 'people', [0, 2], 'Goodwin et al. 2017 (low-risk ~1)', 'medium'),
  affected_MR: p(3, 'people', [1, 4], 'Goodwin et al. 2017 (moderate ~3)', 'medium'),
  affected_PG: p(5, 'people', [4, 6], 'Goodwin et al. 2017 (problem 4-6)', 'medium'),
  harm_LR: p(1, 'harm units', [0.5, 2], 'Browne & Rockloff 2018 (prevention paradox)', 'medium'),
  harm_MR: p(3, 'harm units', [2, 5], 'idem', 'medium'),
  harm_PG: p(10, 'harm units', [6, 15], 'idem', 'medium'),
  // Global scaling factors used to re-centre the heterogeneous ABM on the Markov targets
  escalationScale: p(0.85, '×', [0.5, 1.5], 'Calibration constant (tests/calibration.test.ts)', 'medium'),
  pgScale: p(0.45, '× MR→PG hazard', [0.3, 1.5], 'Calibration constant (heterogeneity correction)', 'medium'),
  recoveryScale: p(1.0, '×', [0.5, 1.5], 'Calibration constant', 'medium'),
} satisfies Record<string, Param>;

export type ParamKey = keyof typeof PARAMS;
export type ParamValues = Record<ParamKey, number>;

export function defaultParamValues(): ParamValues {
  const out = {} as ParamValues;
  for (const k of Object.keys(PARAMS) as ParamKey[]) out[k] = PARAMS[k].value;
  return out;
}

export const CALIBRATION_TARGETS = {
  moderate: 0.036,
  problem: 0.012,
  gamblers: 0.66,
  atRiskRevenueShare: [0.4, 0.5] as [number, number],
  dependency: 0.025,
};
