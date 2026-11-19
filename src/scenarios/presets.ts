import { DEFAULT_LEVERS, type Levers, type Scenario } from '../model/levers';

export const SCENARIOS: Scenario[] = [
  { id: 'status-quo', name: 'Status quo', description: 'A mid-regulated market: moderate marketing and availability, 20% tax, little support.', levers: {} },
  { id: 'liberalization', name: 'Online liberalization + sponsorship boom',
    description: 'Open online licensing, in-play everywhere, heavy sports sponsorship and bonuses.',
    levers: { availability: 85, marketing: 90, innovation: 90, taxRate: 15, acceptance: 70, enforcement: 40 } },
  { id: 'public-health', name: 'Public-health model',
    description: 'In the spirit of the Lancet Public Health Commission (2024): full ad ban, limits, affordability checks, self-exclusion, funded treatment.',
    levers: { availability: 30, marketing: 30, innovation: 30, adBan: 2, stakeLimits: true, depositLimits: true, affordability: true,
      selfExclusion: true, ageVerification: true, support: 70, levy: 10, enforcement: 60 } },
  { id: 'captured', name: 'Fiscally captured state',
    description: 'Gambling taxes are 10% of the budget and half are earmarked for sport and culture. Try to reform from here.',
    levers: { startDependency: 10, earmarking: 50, taxRate: 30, availability: 70, marketing: 70 } },
  { id: 'prohibition', name: 'Prohibition',
    description: 'All legal gambling banned, little enforcement. Watch the illegal channel.',
    levers: { prohibition: true, enforcement: 20 } },
  { id: 'integrated', name: 'Integrated addiction services',
    description: 'Gambling, alcohol and drug treatment delivered together, with more support and lower alcohol harm.',
    levers: { integratedServices: true, support: 60, levy: 6, alcohol: 7, drugs: 3 } },
];

export function scenarioLevers(id: string): Levers {
  const s = SCENARIOS.find((x) => x.id === id) ?? SCENARIOS[0];
  return { ...DEFAULT_LEVERS, ...s.levers };
}
