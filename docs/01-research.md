# Checkpoint 1 — Research summary

## What already exists
- **No published ABM uses PGSI categories as transition states.** The closest is a NetLogo community model, *Pathological Gambling and Social Influence* (theory of planned behaviour, social influence), which does not model recovery/relapse of ex-gamblers. This is a genuine gap, so our model is original and must be calibrated from longitudinal PGSI studies rather than copied.
- **No published System Dynamics model of gambling-policy feedback loops** was found. Adjacent work: Glasgow's macro-economic modelling of regulation (industry "black market" argument), Deloitte's 2025 Tasmania EGM reform scenarios, NHS Health Economics Unit demand/capacity model for treatment services, GambleAware's socio-ecological harm framework.

## What we adopt and why (≤10 points)
1. **PGSI states** (0 / 1–2 / 3–7 / 8+) + treatment + recovery — the standard everyone reports, so calibration data exists.
2. **High fluidity between at-risk states, stability for non-problem gamblers** — repeated PGSI studies show exactly this; >60% of low-risk gamblers move down or stop in the next wave (ANU 2023). → large downward hazards, small upward ones.
3. **High turnover of moderate+problem cases** — Swedish Swelogs: combined MR+PG prevalence ~2.2% vs. annual incidence ~1.4%, with >¾ new cases. → mean episode length ~1.5–2 years; natural recovery is the dominant exit, not treatment.
4. **Help-seeking is rare** — Bijker et al. 2022 meta-analysis: ~20.6% of people with problem gambling, ~3.7% of moderate-risk, ever sought help. → treatment is a weak lever unless help-seeking is raised.
5. **Revenue concentration** — at-risk gamblers (~12–14% of gamblers) supply ~43–49% of spend (GB study in *Int. Gambling Studies*; Roy Morgan/AGR 2024); Ontario ~35%. → spend multipliers per state reproduce ~40–50%.
6. **Comorbidity** — NESARC (Petry, Stinson & Grant 2005): 73.2% of pathological gamblers had an alcohol use disorder, 38.1% a drug use disorder. → bidirectional coupling, odds ratios ~4–6.
7. **Product risk gradient** — Lancet Commission 2024: gambling disorder in ~15.8% of adults who use online casino/slots vs ~8.9% of sports bettors; lottery is lowest-risk in revenue studies.
8. **Advertising** — positive, dose–response association with attitudes, intentions and behaviour (Bouguettaya et al. 2020; 2022 umbrella review), stronger for young people and those already at risk. Evidence strength: medium (mostly correlational).
9. **Prevention paradox** — Browne & Rockloff 2018: aggregate harm is larger across the low/moderate categories than in the problem category. Contested (Delfabbro & King) → shown in the UI as a toggleable harm-weighting.
10. **Fiscal dependency & channelization** — typical US state: gambling ≈ 2–2.5% of own-source revenue (Rockefeller Institute 2016), Massachusetts 2.23% (FY2025); Australian states 7–12%. Online channelization ~89% in moderate-tax Spain/Denmark vs 43–65% in France/Sweden/Netherlands (PwC for BGC — industry-commissioned, flagged as such); Spain's tax cut 25%→20% moved channelization 71%→76%.

## Calibration targets for the "Status quo" preset
| Metric | Target | Source / confidence |
|---|---|---|
| Moderate-risk prevalence (adults) | ~3.5% | Range across national surveys; medium |
| Problem gambling prevalence | ~1.2% | idem; medium |
| Past-year gamblers | ~65% of adults | ASSUMPTION, typical of AU/UK surveys; medium |
| Share of GGR from MR+PG | 40–50% | GB, AU studies; medium |
| PG ever sought help | ~20% | Bijker 2022; medium (high bias risk) |
| AUD among PG | ~70% (lifetime) | NESARC; high |
| Affected others per PG | ~4–6 | Goodwin et al. 2017; medium |
| Gambling tax / budget | 2.5% | US typical; high |
| Online channelization | ~85% | ASSUMPTION within 76–91% range; low |

## Sources
- NetLogo — Pathological Gambling and Social Influence: https://ccl.northwestern.edu/netlogo/models/community/Pathological%20Gambling%20and%20Social%20Influence
- NZ National Gambling Study, health correlates (PGSI transitions, multi-state Markov): https://health.govt.nz/system/files/2021-03/national-gambling-study-secondary-analysis-health-correlates-final-report-7sep20.pdf
- ANU 2023, Harm profiles associated with low-risk gambling: https://www.gamblingandracing.act.gov.au/__data/assets/pdf_file/0020/2316071/2023-Harm-profiles-associated-with-low-risk-gambling-Longitudinal-analysis-of-three-datasets-ANU-Research-Report.pdf
- Swelogs incidence (Int. Gambling Studies 2016): https://informahealthcare.com/doi/full/10.1080/14459795.2016.1209780
- Glasgow macro-economic modelling: https://www.gla.ac.uk/research/az/grg/ourprojects/macroeconomicmodelling
- NHS HEU gambling harm modelling: https://healtheconomicsunit.nhs.uk/case_study/modelling-gambling-harm-across-great-britain/
- Revenue concentration (GB): https://www.vixio.com/insights/gc-online-casino-depends-risk-problem-gamblers-uk-study-suggests
- Revenue concentration (AU, AGR/Roy Morgan): https://www.agr.org.au/agr-media-releases/gambling-industry-makes-almost-half-its-revenue-from-just-12%25-of-all-gamblers
- Orford, Wardle & Griffiths 2013: https://ideas.repec.org/a/taf/intgms/v13y2013i1p4-18.html
- Fiedler et al. 2019 (Gini of spend): https://boris.unibe.ch/147870/2/Fiedler_et_al_2019_Gambling_Preprint.pdf
- Lancet Public Health Commission on Gambling 2024: https://www.unsw.edu.au/news/2024/10/new-commission-calls-for-regulatory-reform-to-tackle-the-health
- Petry, Stinson & Grant 2005 (NESARC): https://pubmed.ncbi.nlm.nih.gov/15889941/
- Bijker et al. 2022 help-seeking meta-analysis: https://www.news-medical.net/news/20220714/Review-One-in-every-400-adults-has-sought-help-for-problem-gambling.aspx
- Goodwin et al. 2017, "A typical problem gambler affects six others": https://acquire.cqu.edu.au/articles/journal_contribution/A_typical_problem_gambler_affects_six_others/13397684
- Browne & Rockloff 2018, prevention paradox: https://pmc.ncbi.nlm.nih.gov/articles/PMC6174604
- Bouguettaya et al. 2020, advertising meta-analysis: https://acquire.cqu.edu.au/articles/journal_contribution/The_relationship_between_gambling_advertising_and_gambling_attitudes_intentions_and_behaviours_A_critical_and_meta-analytic_review/20289042
- Umbrella review on advertising 2022: https://www.pubmed.gov/36725155/
- Rockefeller Institute 2016 (state reliance): https://rockinst.org/wp-content/uploads/2018/02/2016-04-12-Blinken_Report_Three.pdf
- Tax Policy Center: https://taxpolicycenter.org/briefing-book/how-do-taxes-lotteries-casinos-sports-betting-and-other-types-state-sanctioned
- MassBudget 2025: https://massbudget.org/2025/09/15/payouts-and-risks-ma-gambling-revenue/
- Australian state dependence (IBISWorld): https://www.ibisworld.com/blog/gambling-contribution-state-territory-government-revenue/61/1126/
- PwC channelisation study (industry-commissioned): https://next.io/news/regulation/pwc-study-higher-taxes-black-market-growth/
- Germany illegal share: https://igamingbusiness.com/legal-compliance/regulation/germanys-unlicensed-online-gambling-market-466-million-2023/
