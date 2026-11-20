import { DEFAULT_LEVERS, type Levers, type Scenario } from '../model/levers';

export const SCENARIOS: Scenario[] = [
  { id: 'status-quo', name: 'Australia today (status quo)',
    description: 'Calibrated to HILDA 2018 (7.3% at risk). The online and sports-betting boom grows until ~2023; existing rules, little early support. Warning labels only.', levers: {} },
  { id: 'liberalization', name: 'Boom unchecked',
    description: 'Even more sports-betting sponsorship, in-play and micro-betting, more venues and online access.',
    levers: { availability: 70, marketing: 85, innovation: 85, acceptance: 70, enforcement: 25 } },
  { id: 'ad-ban', name: 'Tobacco playbook: full ad ban',
    description: 'Goal 3 — stop people falling into risk at all. Comprehensive gambling-advertising ban (Murphy inquiry 2023) plus strong age verification.',
    levers: { adBan: 2, marketing: 30, ageVerification: true } },
  { id: 'early-help', name: 'Catch it early',
    description: 'Goal 1 — stop escalation. Early detection of low-risk gamblers plus easy access to early support, funded by a levy.',
    levers: { earlyDetection: true, support: 55, levy: 6 } },
  { id: 'loss-limits', name: 'Mandatory loss limits',
    description: 'Goal 2 — reduce severity. Loss and deposit limits on pokies and online accounts, affordability checks — but only licensed channels are covered.',
    levers: { stakeLimits: true, depositLimits: true, affordability: true, selfExclusion: true } },
  { id: 'public-health', name: 'Public-health package',
    description: 'All three goals at once, in the spirit of the Lancet Public Health Commission (2024) and the Murphy inquiry: ad ban, limits, early detection, funded support.',
    levers: { availability: 35, marketing: 30, innovation: 35, adBan: 2, stakeLimits: true, depositLimits: true, affordability: true,
      selfExclusion: true, ageVerification: true, earlyDetection: true, support: 70, levy: 10, enforcement: 60 } },
  { id: 'captured', name: 'Revenue-dependent state',
    description: 'Gambling is 12% of state tax revenue (like the highest-dependency states) and half is earmarked for clubs and community. Try to reform from here.',
    levers: { startDependency: 12, earmarking: 50, taxRate: 35, availability: 70, marketing: 70 } },
  { id: 'prohibition', name: 'Prohibition',
    description: 'All legal gambling banned, little enforcement. Watch the offshore channel.',
    levers: { prohibition: true, enforcement: 20 } },
  { id: 'integrated', name: 'Integrated addiction services',
    description: 'Gambling, alcohol and drug treatment delivered together, with more support and lower alcohol harm.',
    levers: { integratedServices: true, support: 60, levy: 6, alcohol: 7, drugs: 3 } },
];

export function scenarioLevers(id: string): Levers {
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
  return { ...DEFAULT_LEVERS, ...s.levers };
}
