# Gambling Harm Systems Lab · Australia

An interactive, NetLogo-style simulation for a *Nature of Systems* course, centred on Australia (2018 → 2038). You play the policymaker: pull market, fiscal, health and regulatory levers to **reduce the number of Australians at risk from gambling (low, moderate and high risk)** — without triggering a budget crisis, an offshore-market surge or a political backlash.

## Problem statement
The prevalence of at-risk gambling among Australian adults increased from **7.3% in 2018 to 9.8% in 2022** across low-, moderate- and high-risk categories (HILDA: 3.7 → 4.9% low, 2.5 → 3.1% moderate, 1.1 → 1.8% high). Gambling also generates substantial revenue for operators and state and territory governments, creating competing incentives between maintaining gambling activity and implementing harm reduction. The challenge is to prevent people progressing into higher-risk categories while reducing harm across **all** levels of risk.

**The stock** is *at-risk gamblers* (PGSI 1+). Its **inflow** is adults who start being at risk; its **outflow** is adults who leave risk (natural recovery, early detection, support, treatment, quitting). Three prevention goals:
1. **Prevent escalation** (low → moderate → high) — early detection, early support.
2. **Reduce severity** for those already at moderate/high risk — mandatory loss limits, affordability checks (licensed channels only).
3. **Prevent people becoming at risk at all** — the tobacco playbook: advertising bans, age verification.

## What you see
- **The stock panel**: live inflow and outflow, the stock split into low/moderate/high, and the three goals measured against 2018.
- **Map of Australia**: each dot ≈ 7,000 adults placed where Australians live; dots light up and turn orange/red as people move into risk, and a heat map shows where at-risk gambling concentrates. Each state shows its live at-risk share (pokies density differs by state).
- **Charts**: the stock vs HILDA 2018/2022, flows in and out, men 18-34 vs everyone else, social cost vs tax revenue, harm by risk group, slow stocks & politics.

> **Educational model, not a forecast.** It combines published estimates with clearly labelled assumptions to explore feedback, delays and trade-offs. It does not predict any real country.

## What students should discover
1. Interventions act with delays; naive policies can oscillate or backfire.
2. A state that depends on gambling revenue resists harm-reduction policy (Policy Resistance / Shifting the Burden).
3. Prohibition without enforcement pushes play to unregulated channels (Fixes that Fail).
4. Most total harm sits in the many low/moderate-risk gamblers (prevention paradox), so population-level measures can beat treatment-only strategies.
5. Gambling harm is entangled with alcohol and drug use.
6. Social norms are slow-moving stocks that amplify or dampen every other lever.

## Model
**Hybrid agent-based + system dynamics.** 1 tick = 1 month; month 0 = January 2018; horizon 20 years after a hidden 10-year burn-in. 500–5,000 agents placed on a map of Australia (capital cities and regional towns by population), each linked to their nearest neighbours plus a few long-range ties; each agent represents `20,800,000 / n` adults. An exogenous online/sports-betting boom (to ~2023) reproduces HILDA's 2018 → 2022 rise.

### Agents
- PGSI state: non-gambler · no risk (0) · low (1–2) · moderate (3–7) · problem (8+) · in treatment · in recovery
- Pathways subtype (behaviourally conditioned 70%, emotionally vulnerable 20%, antisocial-impulsive 10%)
- Age (18–85, generational turnover), lognormal vulnerability, alcohol and drug disorder (binary), product taste over lottery / sports / in-play / online casino / EGMs, legal vs illegal channel, debt, treatment queue

### Transitions
For every transition: `rate = base × Π multipliers`, `p = 1 − exp(−rate·dt)`. Multipliers are log-linear in centred levers (status quo = 1) and include vulnerability, subtype, comorbidity, product risk, debt, channel, and the share of gambling / at-risk peers × social pressure. Transitions go both ways; natural recovery is the main exit.

### Aggregate stocks (first-order smoothing unless noted)
| Stock | Driven by | τ |
|---|---|---|
| Social acceptance | cultural anchor, marketing, participation, − awareness | 60 mo |
| Public awareness | visible harm, campaigns | 24 mo |
| Industry influence | operator profit | 36 mo |
| Fiscal dependency | tax ÷ public budget | 12 mo |
| Political resistance | dependency, influence, earmarking, budget crisis | 6 mo |
| Treatment capacity | levy × tax + state support | 12 mo |
| Illegal channel | tax above 20%, limits, bans, prohibition, − enforcement | 18 mo |
| Effective lever values | every lever, 3rd-order delay; harm-reducing changes attenuated by up to 70% × resistance | 9 mo |

### Causal loops
R1 Peer contagion · R2 Normalization · R3 Fiscal capture · R4 Lobbying · R5 Dual addiction · B1 Harm visibility · B2 Treatment · B3 Funded protection (Shifting the Burden) · F1 Fixes that Fail. See the **Causal loops** tab for the interactive diagram.

### Calibration (status quo, tested in `tests/calibration.test.ts`)
| Target | Model | Source |
|---|---|---|
| 2018: low 3.7%, moderate 2.5%, high 1.1% (7.3%) | ≈ 3.8 / 2.6 / 1.2 (7.5%) | HILDA via AIHW (Wilkins et al. 2024) |
| 2022: 9.8% at risk | ≈ 9.1% | idem |
| Gambling losses ≈ $25bn/yr (2018) | ≈ $25bn | QGSO Australian Gambling Statistics |
| Gambling tax ≈ $7-10bn/yr, ~7.5% of state tax | ≈ $7bn → $11bn, 7.5% | IBISWorld; state budgets |
| Social cost ≫ tax | ≈ $40-50bn/yr (≈ 5× tax) | Victoria 2023 social-cost study ($14.1bn), scaled |
| At-risk share of spend 40–50% | ≈ 43% | AU revenue-concentration studies |

Every constant is in [`src/params.ts`](src/params.ts) with unit, range, source (or `ASSUMPTION`) and confidence.

## Scenario presets
Australia today (status quo) · Boom unchecked · Tobacco playbook: full ad ban (goal 3) · Catch it early (goal 1) · Mandatory loss limits (goal 2) · Public-health package (all goals) · Revenue-dependent state · Prohibition · Integrated addiction services. Every run starts in January 2018 and the preset phases in, so delays are visible.

20-year results (at-risk share in 2038, one seed): status quo ≈ 15%, boom unchecked ≈ 23%, full ad ban ≈ 7.6%, catch it early ≈ 14%, loss limits ≈ 14% (but offshore share ≈ 27%), public-health package ≈ 3.4%, prohibition ≈ 9% (100% offshore).

## Counterintuitive behaviours the model produces
1. **Prohibition barely moves harm** (≈ −15% after 20 years) while sending ~100% of play to unprotected illegal operators and tax to zero.
2. **The public-health package works but triggers a budget crisis** if introduced all at once: tax falls faster than the state can rebase its budget (τ ≈ 3 years). Phasing reforms avoids it.
3. **Expensive good policy can raise political resistance:** the integrated-services scenario's costs drain the fiscal reserve, the crisis adds resistance, and later reforms get watered down.
4. **A levy-funded treatment system shrinks as it succeeds** (B3, Shifting the Burden).
5. **Prevention paradox:** low- and moderate-risk gamblers carry more aggregate harm than problem gamblers.
6. **Under the status quo, lever effect sizes barely matter** in the tornado chart — they only bite once levers move. Base transition rates dominate status-quo uncertainty.

## Run, test, deploy
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # invariants, directional effects, scenario distinctness, calibration
npm run build      # static site in dist/
```
Deployed on Vercel as a static Vite site; every push to `main` redeploys.

## Limitations
Adults only (no youth or loot boxes) · binary alcohol/drug disorder · lever effect sizes combine directional evidence with assumptions · illegal-market response is contested and the main channelisation estimates are industry-funded · the prevention-paradox weighting is disputed.

## Main sources
- Wardle et al. (2024), *Lancet Public Health* Commission on gambling
- Petry, Stinson & Grant (2005), NESARC comorbidity, *J Clin Psychiatry*
- Bijker et al. (2022), global help-seeking meta-analysis, *Addiction*
- Browne & Rockloff (2018), prevention paradox, *J Behav Addict*
- Goodwin et al. (2017), *A typical problem gambler affects six others*, *Int Gambling Studies*
- Bouguettaya et al. (2020), advertising and gambling meta-analysis
- ANU (2023) longitudinal low-risk transitions; Swelogs (2016) incidence
- Rockefeller Institute (2016); MassBudget (2025); PwC for BGC (channelisation, industry-commissioned)
- NetLogo community model *Pathological Gambling and Social Influence*

Full links are in the app's **Model & sources** tab and in `docs/01-research.md`.

## Getting help
If gambling is causing harm to you or someone close to you: [Gambling Help Online](https://www.gamblinghelponline.org.au) · 1800 858 858 (free, 24/7, Australia).
