# DPDP and GDPR readiness

Reviewed 25 September 2026. Owner: Kunal Das, operating as Kudos Labs. Audience decision: adults 18+ only, confirmed by the owner. This is an engineering assessment and operating checklist, not a compliance certification. The changes below are prepared in the privacy branch; production remains unchanged until the app and rules are released.

## Legal timing and scope

GDPR applies where Yify's activities meet its territorial scope, including offering services to people in the EU. Its consent, transparency, rights, security and transfer obligations are already applicable in those circumstances. The related ePrivacy rules also matter for cookies and similar device storage/access; a GDPR legal basis alone does not authorize optional trackers.

India's DPDP commencement is phased from 13 November 2025. The Consent Manager registration framework starts 13 November 2026. Core app duties concerning notice, consent, children, security, breaches and individual rights start **13 May 2027**. A privacy-settings page does not itself make Yify a statutory Consent Manager. Existing obligations under other applicable laws are not suspended by this timetable.

Primary sources:

- [GDPR, Regulation (EU) 2016/679](https://eur-lex.europa.eu/eli/reg/2016/679/oj), especially Articles 3, 5–8, 12–22, 27–30, 32–35 and 44–49.
- [EDPB: processing personal data lawfully](https://www.edpb.europa.eu/sme/be-compliant/process-personal-data-lawfully_en).
- [EDPB: individual rights](https://www.edpb.europa.eu/sme/be-compliant/respect-individuals-rights_en).
- [EU: online privacy and cookies](https://europa.eu/youreurope/business/growing/digitalising/online-privacy/index_en.htm).
- [DPDP commencement notification G.S.R. 843(E)](https://egazette.gov.in/WriteReadData/2025/267647.pdf).
- [IndiaCode annotated DPDP Act](https://www.indiacode.nic.in/bitstream/123456789/22037/2/a2023-22.pdf).
- [Final DPDP Rules, G.S.R. 846(E)](https://www.meity.gov.in/static/uploads/2025/11/53450e6e5dc0bfa85ebd78686cadad39.pdf); English begins on PDF page 24.
- [December 2025 corrigendum](https://egazette.gov.in/WriteReadData/2025/268455.pdf).
- [MeitY's May 2026 confirmation of full enforcement on 13 May 2027](https://www.pib.gov.in/PressReleasePage.aspx?PRID=2261823&lang=1&reg=3).

DPDP permits consent and its specifically enumerated legitimate uses. Do not copy GDPR's general legitimate-interest basis into an Indian processing assessment. DPDP requires notice/consent language options, grievance handling and nomination as well as access/correction/erasure; GDPR portability is a separate right with its own conditions.

## Prepared engineering changes

| Control | Behaviour | Release boundary |
| --- | --- | --- |
| Adult declaration | On first use, app features do not mount and startup services do not initialize until the user affirmatively confirms 18+. Resetting privacy storage does not remotely stop already scheduled notifications or invalidate an existing account session. No birthday or identity document collected. | Web/new app code; a declaration is not verified age assurance. |
| Optional usage analytics | Off initially; separate from the adult declaration and from access to purchases. Local notice version and timestamp saved. Missing, corrupt or outdated choice defaults to off. | Web/new app code. |
| Withdrawal | Preferences → Privacy disables new client analytics and RevenueCat measurement, requests Firebase-ID unlinking and clears local analytics identifiers. Pre-consent events are discarded, not queued. | Web/new app code; previously sent data needs a provider request. |
| Native SDK defaults | Firebase Analytics collection/storage, advertising signals/identifiers and automatic screen reporting disabled in configuration. | **New native binary required.** Android runtime 1.8.10/code 92 prepared. OTA alone cannot apply these pre-JavaScript defaults. |
| Search minimization | Search text removed from analytics; no unrestricted analytics payloads copied into Crashlytics breadcrumbs. | Web/new app code. Error reporting remains active. |
| Ad-choice refresh | Discards cached ads and stale callbacks when reopening Android UMP, then checks the resulting consent before requesting another ad. | Android app code. Google's ad consent remains separate from product analytics. |
| Account deletion | Firestore rejects reads/recreation of account content after the permanent deletion marker. Updated clients clear attributable synced caches after positively verifying deletion. | **Firestore rules deployment required**, plus client update. Offline/unverifiable clients need local storage clearing. |
| Collection removal | Deleted collection names are scrubbed locally and rewritten remotely while preserving deletion timestamps and compatibility. | New app code and successful sync. |
| Rights contact | Preferences → Privacy opens an email request for access/copy, correction, deletion, objection or concerns. Legal pages remain accessible before the adult declaration. | Web/new app code. This is a request route, not an automated complete export. |

## Data and processor inventory

| Activity | Data and storage | Current erasure/retention position |
| --- | --- | --- |
| Sign-in and account sync | Firebase Auth profile and UID; Firestore `users/{uid}` contains watchlist/history/settings/library/enrollment data. | Account action deletes auth and sync content. Watchlist/history removal marks have bounded pruning. A minimal account-linked deletion marker prevents resurrection. |
| Private journal | Separate Firestore journal documents and per-account device cache; movie/date/optional rating/note. | Account deletion removes contents, retains empty deletion barrier. Unreachable devices cannot be remotely wiped. |
| Search and catalogue | Recent searches and response caches on device; catalogue/TMDB/media endpoints receive normal connection metadata. | Device controls and settings clear relevant local records. Audit every cache namespace before claiming a complete device wipe. |
| Purchases | RevenueCat customer UID, aliases, transaction/subscription records; Google/Apple/Stripe billing. | Logout/deletion does not erase provider records or cancel billing. Verify legal retention and provider erasure scope case by case. |
| Optional measurement | Firebase Analytics events/installation identity; optional RevenueCat purchase/ad measurement linkage. | Consent now gates client collection. Verify dashboard retention and previously linked server integration behaviour; unlinking is not retroactive erasure. |
| Diagnostics | Sentry errors, traces, logs, metrics; Crashlytics native/JS reports, identifiers/device details. | Still active. Filtering is not anonymization. Actual retention, transfer terms and the basis for necessary diagnostics versus optional performance require review. |
| Ads | AdMob/UMP on Android; AdSense/Google CMP on web. | Android consent refresh fixed. Verify the live web CMP and persistent withdrawal route in EEA/UK/Switzerland before calling web advertising compliant. |
| Availability alerts | Firestore device enrollment, Expo/FCM/APNs tokens, country/timezone, server delivery state, GitHub worker. | Enrollment removed on account deletion. Worker state outside the current pilot allowlist needs a separate administrative cleanup sweep. |
| Location | Explicit permission, web coarse coordinates sent to BigDataCloud; stored country preference. | Coordinates not retained by Yify's location implementation. External provider retention must be confirmed. Manual country selection remains available. |
| Hosting/support | Expo/GitHub server logs; email and Sentry feedback. | Configure/document actual retention and restricted access. Do not promise immediate deletion of legal/security records. |

## Work required before claiming readiness

1. **Controller notice:** obtain the owner's public business/correspondence address. The existing email is `kunal26das@gmail.com`. Do not invent a registered company, address, DPO or EU representative. Assess whether Article 27 requires an EU representative; a DPO is not automatically required just because GDPR applies.
2. **Purpose and legal-basis register:** approve a basis for each inventory row. Optional analytics uses consent. Document necessity for account/purchase services. Assess limited crash/security diagnostics separately; sampled performance, sessions and other tracking cannot automatically inherit a security rationale. Complete a legitimate-interest assessment where used for GDPR and an independently valid DPDP ground.
3. **Processors and transfers:** inspect current Firebase/Google, Sentry, RevenueCat, Expo, GitHub, Stripe and other applicable agreements, locations/subprocessors and transfer mechanisms. Record executed DPAs and applicable safeguards; merely listing providers or using HTTPS is insufficient.
4. **Retention:** verify actual configured periods for analytics, crash reports, support, delivery state and backups. Set owner-approved retention and a scheduled purge with receipts. Scope DPDP Rules 6 and 8(3)'s security/processing/traffic-log retention before enforcement; do not apply a blanket one-year or three-year rule to every record or promise universal instant erasure. Review retention of deletion markers against the need to stop stale-device restoration.
5. **Ads and embeds:** test a fresh EEA browser with no CMP choice, refusal, acceptance and withdrawal, checking requests/storage. Verify Google's certified CMP setup and the permanent privacy link. Default autoplay and third-party media requests still need their own assessment/activation controls; `youtube-nocookie` is not equivalent to no third-party processing.
6. **Adults-only implementation:** reconcile Play Console target audience, public terms and actual marketing with the owner's decision. Assess proportionate age assurance; a self-declaration does not prove age or excuse processing a known child's data. Do not collect government IDs by default. Handle discovered under-18 accounts, refunds and erasure requests explicitly.
7. **DPDP language and rights:** prepare notice/consent access in English or requested Eighth Schedule languages, a verifiable nomination process and grievance tracking. The current English UI and mail link alone do not complete this work.
8. **Provider deletion/export:** add a controlled administrative workflow covering provider records and old availability state. A client export of loaded screens would be incomplete; do not advertise it as a full access response.
9. **Consent evidence:** the local record is versioned, but removable browser storage is not a complete centralized audit trail. Decide proportionate server-side evidence for account-linked optional processing without introducing new cross-device tracking or silently copying consent between devices.
10. **Live verification:** deploy rules, web and a new native binary, then verify fresh-install refusal, opt-in, withdrawal, restart, stale-device deletion and network behaviour. Older installed binaries cannot gain native defaults from an OTA.

## Handling a privacy request

1. Log receipt date, requested right and jurisdiction in a restricted register. Acknowledge without requesting unnecessary personal information. Use existing account sign-in or a proportionate ownership check; do not routinely request ID scans or passwords.
2. Keep deletion/access deadlines visible. GDPR responses are due without undue delay and normally within one month. A permitted extension must be explained within that first month. DPDP's grievance period must be published and not exceed 90 days once applicable; a faster internal target is appropriate.
3. Identify Firebase UID and relevant provider identifiers securely. Never paste tokens, detailed viewing history or raw provider exports into public issues or logs.
4. For access, collect account/profile, synchronized watchlist/history/library/journal/settings, alert registrations and state, available processor-held personal data and recipient/purpose/retention information. Include provenance and any genuine limits. Provide an accessible response; supply machine-readable data where portability applies.
5. For erasure, prevent resurrection first, then delete eligible account/processor data. Document any justified legal retention, restricted purpose and eventual purge date. Subscription cancellation/refunds are separate; explain the consequence clearly. Preserve the deletion barrier until the stale-session risk is addressed.
6. Obtain processor confirmations/receipts. Deliver the response securely to the verified requester, record outcome, and remove temporary export files. A sent email alone is not evidence that provider deletion completed.

## Incident procedure

Restrict access to the incident record, contain the incident and preserve necessary evidence. Establish awareness time, affected systems/people/data, likely consequences and mitigations. Assess GDPR notification: supervisory-authority notice where required within 72 hours of awareness, with reasons for delay; notify individuals without undue delay where high risk requires it. Once DPDP's relevant rules apply, notify the Board and affected people without delay and provide the further Rule 7 details within 72 hours unless extended. Record decisions even where notification is not required. Confirm recipients and facts before issuing a notice; do not wait for a complete root-cause analysis to start the assessment.

## Verification for this change

- Full suite: 1,765 app/domain/data/worker tests plus 51 crash-reporting workspace tests passed.
- TypeScript, exact dependency pins and the repository's Expo compatibility check passed; the latter retains its explicitly reviewed existing deviations.
- Firestore emulator verified that a stale owner token cannot read, update or recreate deleted account content, while completing an interrupted deletion remains permitted.
- Production web export and export checks passed. Edge browser checks at 390px and 1280px confirmed default refusal, an explicit adult declaration, persisted refusal, cross-tab withdrawal, no horizontal overflow and no page errors. These local checks do not substitute for a live EEA CMP test with production settings.
- Direct ESLint still reports the pre-existing layout import/conditional-hook and Preferences ref diagnostics, with the additional Privacy section repeating the same ref diagnostic. No clean whole-project lint result is claimed.
