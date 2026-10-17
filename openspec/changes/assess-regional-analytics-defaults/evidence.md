# Regional analytics assessment

Checked 17 October 2026 against main `7b68989021d85e8b1613aee48c21f19821f583d2`. This is an engineering preparation using official sources, not a legal opinion, provider-account audit or production consent certification.

## Decision and scope

The current Firebase Analytics, optional Sentry performance/logs/metrics and RevenueCat purchase/ad-measurement bundle remains opt-in worldwide. **No region is approved for default-on operation.** Several laws potentially allow narrower processing without express opt-in; the missing item is an app-specific purpose/configuration assessment, not the owner's authorization to investigate.

This matrix covers selected potential markets and different legal models. All other supported countries remain unassessed and consent-first. It is not a complete 50-state US, province-by-province Canadian or global legal review.

| Jurisdiction | Official-source finding | Yify decision and missing evidence |
| --- | --- | --- |
| US | Nonsensitive first-party analytics can have routes without general opt-in. State applicability and sale/sharing/targeted-ad rules differ. California requires relevant collection notices and covered sale/sharing opt-outs, including GPC; Colorado and Connecticut also recognize applicable universal opt-out mechanisms. [California AG](https://oag.ca.gov/privacy/ccpa), [Colorado AG](https://coag.gov/opt-out/), [Connecticut AG](https://portal.ct.gov/ag/sections/privacy/the-connecticut-data-privacy-act). | No approval: assess state scope, actual provider roles/contracts, sensitive data, ad/purchase linkage and opt-out propagation. No explicit GPC handling was found in the searched client/instrumentation source; this does not establish provider behavior. |
| Canada, including Quebec | PIPEDA's meaningful-consent analysis distinguishes sensitivity, expectations and risk. Quebec restricts default activation of identification, location and profiling functions. [OPC](https://www.priv.gc.ca/en/privacy-topics/privacy-for-businesses/appropriate-handling-of-personal-information/collecting-personal-information-and-consent/consent/gl_omc_201805/), [Quebec Act, sections 8.1 and 9.1](https://www.legisquebec.gouv.qc.ca/en/document/cs/p-39.1). | No nationwide default-on approval: verify provincial scope, functional classification and purposes. Implied-consent possibilities elsewhere do not approve the bundled SDK collection. |
| Australia | Where the APPs apply, collection, disclosure, transparency, sensitive information and overseas handling have different conditions. Tracking is not subject to a universal opt-in rule for every datum. [OAIC tracking guidance](https://www.oaic.gov.au/privacy/privacy-guidance-for-organisations-and-government-agencies/organisations/tracking-pixels-and-privacy-obligations). | No approval: establish entity/territorial coverage, necessity, payload sensitivity, purpose limits, transfers and applicable marketing opt-outs. |
| Singapore | Business-improvement provisions concern specified uses of lawfully collected data. Deemed consent by notification has assessment, notice and opportunity-to-opt-out conditions. [PDPC Key Concepts, sections 12.20–12.25 and 12.71 onward](https://www.pdpc.gov.sg/-/media/Files/PDPC/PDF-Files/Advisory-Guidelines/AG-on-Key-Concepts/Advisory-Guidelines-on-Key-Concepts-in-the-PDPA-1-Oct-2021.pdf?la=en). | No approval: establish the collection ground and exception conditions; do not apply a business-improvement label to new bundled tracking. Indexed official excerpts were available; direct PDF retrieval encountered an access challenge. |
| Japan | APPI distinguishes personal and personal-related information, recipient linking and foreign transfers. Relevant Article 31 confirmations and Article 28 transfer routes need assessment. [PPC Q&A, Q8-1 and Q12-1](https://www.ppc.go.jp/personalinfo/faq/APPI_QA/), [PPC guidelines](https://www.ppc.go.jp/personalinfo/legal/guidelines_tsusoku/). | No approval: verify provider classification/linking, destinations, safeguards and relevant external-transmission disclosure obligations. |
| EEA | Device-access consent and GDPR grounds are separate. Narrow national audience-measurement exceptions require specific conditions; there is no single blanket exemption for common analytics offerings. [CNIL analytics guidance](https://cnil.fr/en/sheet-ndeg16-use-analytics-your-websites-and-applications), [CNIL cookie FAQ, questions 9–11](https://cnil.fr/fr/cookies-et-autres-traceurs/regles/cookies/FAQ). | Current bundle stays opt-in. No verified country-specific exemption, aggregation, retention, provider-purpose or transfer assessment. Pseudonymous identifiers are not proof of anonymous statistics. |
| UK | The statistical-purpose exception is in force and can cover sole service-improvement statistics with clear information and easy free objection. It excludes advertising purposes and does not automatically cover retained individual tracking. [ICO exceptions](https://ico.org.uk/for-organisations/direct-marketing-and-privacy-and-electronic-communications/guidance-on-the-use-of-storage-and-access-technologies/what-are-the-exceptions/), [statutory schedule as commenced 5 February 2026](https://www.legislation.gov.uk/ukpga/2025/18/schedules/2026-02-05?timeline=false). | Current bundle stays opt-in. A separate aggregate-only path could be assessed after proving processing limits, third-party roles, retention and the UK GDPR ground. |
| Switzerland | Cookie requirements emphasize information and objection; they are not identical to EU rules. FADP duties, consent-dependent processing and incorporated product policies still matter. [FDPIC March 2026 factsheet](https://www.edoeb.admin.ch/en/factsheet-cookies). | No approval: verify purpose/risk, profiling, vendor uses, transfers and objection handling. Google advertising policy remains a separate constraint. |
| India and India-based processing | Core DPDP duties have phased commencement on 13 May 2027. That timetable does not establish permission under existing law or contracts. Consent/specified legitimate uses differ from GDPR grounds. [MeitY commencement notification](https://www.meity.gov.in/static/uploads/2025/11/c56ceae6c383460ca69577428d36828b.pdf), [DPDP Act](https://www.meity.gov.in/static/uploads/2024/02/Digital-Personal-Data-Protection-Act-2023.pdf). | Current bundle stays opt-in. Include the operator's India-based processing in the assessment rather than treating foreign user geography as an automatic exclusion. |

Google's [EU user-consent policy](https://www.google.com/about/company/user-consent-policy/) and [publisher CMP requirements](https://support.google.com/adsense/answer/13554116?hl=en) impose separate advertising conditions for the EEA, UK and Switzerland. The [Play User Data policy](https://support.google.com/googleplay/android-developer/answer/10144311?hl=en) applies to included SDKs and disclosed purposes, while recognizing other lawful grounds where applicable. Do not turn those policies into a claim that every datum everywhere always requires consent.

## Verified application baseline

- Global off defaults and invalid-receipt rejection: `domain/entities/PrivacyChoices.ts`, `data/services/PrivacyPreferencesImpl.ts`.
- Adult-plus-analytics gate and Firebase collection/withdrawal: `data/services/optionalAnalytics.ts`, `data/datasources/analytics/FirebaseAnalyticsSink.ts` and `.web.ts`; native pre-JavaScript defaults in `firebase.json`.
- Optional Sentry queue revisions: `instrumentation/optional-telemetry.ts`; errors remain active separately in `instrumentation/sentry-config.ts`.
- Current notice includes ad/purchase measurement: `presentation/components/privacy-gate.tsx`. Public policy promises optional analytics remains off until enabled: `public/privacy.html`.
- Streaming-region fallback/manual choice: `presentation/movies/components/watchRegion.ts`, `WatchRegionPicker.tsx`; opt-in location lookup in `data/services/CountryLocationImpl.ts` and `.web.ts` is for viewing-country detection.
- The processing register records proposed grounds and pending operational-error necessity/legal-basis assessment. Always-active code does not establish necessity or legality.

Existing AdMob UMP handling is independent. The web AdSense adapter relies on Google runtime/configuration for regional behavior; this assessment did not establish the live CMP behavior. That remains a verification prerequisite, not a finding that ads violate policy.

## Checks and review

The read-only baseline QA passed **226/226**, with no failures or skips:

```sh
node --test tests/privacy-preferences.test.cjs tests/privacy-gate.test.cjs tests/privacy-bootstrap.test.cjs tests/privacy-analytics.test.cjs tests/sentry-consent.test.cjs tests/sentry-privacy.test.cjs tests/youtube-consent.test.cjs tests/player-consent.test.cjs tests/player-surface-consent.test.cjs tests/journal-analytics.test.cjs tests/revenuecat-purchases.test.cjs tests/revenuecat-web-purchases.test.cjs tests/diagnostics-purchase-auth.test.cjs
```

This checks current mocked behavior, not the proposed policy, live vendor requests or legal compliance. No code changed; repeating the app suite or exports would not validate a new regional configuration.

Source-only privacy and UX reviews found the legacy-refusal migration risk and recommended preserving current runtime behavior while preparing this specification. Both accepted planning commit `5537e6327b73708f7248d4636b74310b18bc1b31`. Independent artifact review found one omission: future public-policy reconciliation and deployed-notice verification were not explicit release prerequisites. The follow-up adds those requirements without changing the current public policy. Final acceptance and draft-delivery receipts are recorded in the PR.

Strict OpenSpec validation passed all 13 active/canonical items and six archived changes; doctor reported a healthy root with no findings. Requested review settings were Astra/high for privacy, design and independent review, Sol/medium for baseline QA; effective model/effort was not independently exposed. These are planning and current-behavior checks, not a completed regional rollout.

## Remaining prerequisites

1. Approve an exact field/purpose inventory and actual provider configuration, contracts, retention and international-transfer ground.
2. Document the applicability and processing decision for the proposed first cohort, including state/province and India-based processing where relevant.
3. Verify a suitable jurisdiction source and applicable opt-out propagation without repurposing the streaming-country choice.
4. Implement the receipt migration and purpose separation, then prove SDK/request behavior and rendered notices before release.

The owner's authorization to proceed is present. Missing app-specific evidence cannot be replaced by another confirmation question or a generic country whitelist. No provider credentials or permission changes are needed to review this proposal.
