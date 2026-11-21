# Gambling Harm Systems Lab · Australia

An interactive, NetLogo-style simulation for a *Nature of Systems* course, centred on Australia (2018 → 2038) and **built on the group's causal loop diagram**: every variable in the model is a box in that diagram, plus the social cost of harm. You switch on four interventions and watch what they do to the number of Australians at risk from gambling (low, moderate and high risk).

## Problem statement
The prevalence of at-risk gambling among Australian adults increased from **7.3% in 2018 to 9.8% in 2022** across low-, moderate- and high-risk categories (HILDA: 3.7 → 4.9% low, 2.5 → 3.1% moderate, 1.1 → 1.8% high). Gambling also generates substantial revenue for operators and state and territory governments. The challenge is to prevent people progressing into higher-risk categories while reducing harm across **all** levels of risk.

**The stock** is *at-risk gamblers* (PGSI 1+). Its **inflow** is *entering at-risk gambling* (PGSI 0 → 1+); its **outflow** is *exit from risk* (PGSI 1+ → 0). Three goals:
1. **Fewer adults entering risk** (the inflow).
2. **Less harm, for current and new at-risk adults** (the social cost of harm).
3. **More people recovering** (the outflow, as a share of the stock).

## The four interventions
Each is a tag you switch on; the evidence rating and its sources sit under each one.

| # | Intervention | Acts on (in the diagram) | Evidence |
|---|---|---|---|
| 1 | **Ban gambling ads**: phased out over 1-5 years (inducements → social media → TV, radio and online → sponsorship) | Marketing exposure ↓ | medium |
| 2 | **Anti-gambling campaign**: humour aimed at the industry, not the gambler | Social acceptance ↓, awareness ↑, help-seeking ↑ | low |
| 3 | **Affordability checks**: deposits stop when losses pass $500 / $1,000 / $2,000 a month and the person cannot afford it | Gambling losses ↓ → financial stress ↓ | low |
| 4 | **Recovery support programs**: counselling, helplines, legal, financial and psychological support ($150M a year) | Government spend ↑ → treatment & counselling capacity ↑ | medium |

Results in 2038 with interventions from 2018 (average of 6 runs):

| | At risk 2038 | Social cost / yr |
|---|---|---|
| None ("as is") | 15.2% | $119bn |
| 1 · Ad ban (3 years) | 8.3% | $50bn |
| 2 · Campaign | 13.2% | $102bn |
| 3 · Affordability checks | 15.5% | $115bn (spending −26%) |
| 4 · Recovery support | 12.9% | $71bn |
| All four | 4.8% | $15bn |

Affordability checks mainly protect the heaviest losers' money: they move people from high to moderate risk rather than out of risk, and the tax they take away also shrinks the budget for harm services.

## Interventions from 2018, 2022 or 2026
The run always starts in January 2018. **Interventions from** (top bar) sets when your interventions switch on. With 2022 or 2026 the run opens in that January with history already played (no interventions, calibrated to HILDA), and every change is measured against that year. A hidden "as is" run with the same seed shows the impact of your interventions in the stock panel and the three goals.

## What you see
- **The stock panel**: live inflow and outflow, the stock split into low/moderate/high, and the three goals against "as is" and against the start year.
- **Indicators**: the diagram's variables (social acceptance, marketing exposure, gambling expenditure, tax → government spend, financial stress, treatment & counselling, public pressure → regulation) plus the social cost of harm.
- **Map of Australia**: each dot ≈ 7,000 adults placed where Australians live; a heat map shows where at-risk gambling concentrates.
- **Charts**: the stock vs HILDA 2018/2022, flows, market & social norms, individual harm, who pays, public response, treatment & counselling, your interventions in effect, and harm by risk group.
- **Causal loops**: the group's diagram, with delays marked ‖ and six loops you can trace one at a time.

> **Educational model, not a forecast.** It combines published estimates with clearly labelled assumptions to explore feedback, delays and trade-offs.

## Model
**Hybrid agent-based + system dynamics.** 1 tick = 1 month; month 0 = January 2018; horizon 20 years after a hidden 10-year burn-in. 500–5,000 agents on a map of Australia, each linked to nearby people plus a few long-range ties; each agent represents `20,800,000 / n` adults.

- **Agents** move between PGSI states (non-gambler · no risk · low · moderate · high · in treatment · in recovery). Each carries the diagram's individual-harm variables: gambling intensity and losses, financial stress (losses relative to income), gambling as coping, emotional distress, family conflict and social isolation.
- **System variables** follow the diagram: social acceptance (R1, B1), exposure, marketing exposure (R2), accessibility, participation, expenditure, operator revenue, tax revenue, government spend, treatment & counselling capacity, awareness of harm, help-seeking, public pressure and regulatory strength (B1, B2).
- **Transitions**: `rate = base × Π multipliers`, `p = 1 − exp(−rate·dt)`, with multipliers from the diagram's variables centred so the 2018 status quo = 1.
- **Delays** (marked ‖ in the diagram): social acceptance ≈ 5 years, awareness ≈ 2 years, regulation ≈ 3 years, budget cycle and capacity building ≈ 1 year each, isolation ≈ 1 year.
- **Social cost** = harm units (1 low : 3 moderate : 10 high) × $8,100 a year (Victoria 2023 social-cost study, scaled nationally).

### Calibration
| Target | Model (status quo, 6 seeds) | Source |
|---|---|---|
| 2018: low 3.7%, moderate 2.5%, high 1.1% (7.3%) | ≈ 3.7 / 2.4 / 1.1 (7.3%) | HILDA via AIHW (Wilkins et al. 2024) |
| 2022: 9.8% | ≈ 10.1% | idem |
| Gambling losses ≈ $25-30bn/yr | ≈ $28bn (2018) | QGSO Australian Gambling Statistics |
| At-risk share of spending 40–55% | ≈ 55% | AU and GB revenue-concentration studies |
| Social cost ≫ tax | ≈ $37bn vs $8.5bn (2018) | Victoria 2023 study, scaled |

The default seed (58) tracks HILDA closely in a single run (7.3% → 9.9%). Every constant is in [`src/params.ts`](src/params.ts) with unit, range, source (or `ASSUMPTION`) and confidence.

## Run, test, deploy
```bash
npm install
npm run dev        # http://localhost:5173
npm test           # invariants, one directional test per intervention, timing, calibration
npm run build      # static site in dist/
```
The diagram in the Causal loops tab is generated from [`scripts/cld/build_map.py`](scripts/cld/build_map.py) (`python3 -I scripts/cld/build_map.py page.html --ts src/ui/cldDiagram.ts`). Deployed on Vercel as a static Vite site; every push to `main` redeploys.

## Limitations
Adults only (no youth or loot boxes) · most arrow strengths combine directional evidence with assumptions (see the sensitivity tab) · social cost depends only on risk level · the offshore market, alcohol and drugs and the politics of gambling revenue are outside this version of the diagram · the prevention-paradox weighting is disputed.

## Main sources
- AIHW / HILDA (Wilkins et al. 2024): PGSI categories 2018 and 2022
- *The social costs of gambling to Victoria* (2023)
- House of Representatives inquiry *You win some, you lose more* (Murphy inquiry, 2023)
- Bouguettaya et al. (2020), advertising and gambling meta-analysis
- Farrelly et al. (2005), the "truth" anti-smoking campaign, *AJPH*
- Gambling Commission (Great Britain), financial risk checks
- Cowlishaw et al., Cochrane review of psychological therapies for problem gambling
- Bijker et al. (2022), help-seeking meta-analysis; Browne & Rockloff (2018), prevention paradox

Full links are in the app's **Model & sources** tab.

## Getting help
If gambling is causing harm to you or someone close to you: [Gambling Help Online](https://www.gamblinghelponline.org.au) · 1800 858 858 (free, 24/7, Australia).
