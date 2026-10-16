# Release evidence

## Preflight and source

Source `69c60b1e69c3535743b7fa3a82c878132e988061` is the reviewed current main. CI 38913531664 and automatic Hosting 38914134757 / Pages 38914134964 passed on that exact source. Live browser startup verification passed on both web targets. Their deployments are `oan54yyzhz` and `7121245931`; no duplicate manual web deployment was needed.

Expo credential-presence checks found one default remote upload keystore and an assigned Play submission service account for the expected project/package, without fetching or logging secret values. The fresh 14:49 UTC Play API read found code 105 in production and no code 107. Authenticated Console verification shows code 105 Available on Google Play at 100% across the 171 configured regions, released October 14 at 20:53 IST; its shipped ledger entry is reconciled separately.

Expo accepted production build [6ffd0567-2af9-4435-b52f-61249cbf02f8](https://expo.dev/accounts/kunal26das/projects/yify/builds/6ffd0567-2af9-4435-b52f-61249cbf02f8) at 14:51:11 UTC on October 16 from clean source `69c60b1e69c3535743b7fa3a82c878132e988061`, version/runtime 1.8.25, code 107, Production channel. Remote signing is reused and automatic submission is disabled. Release notes were held outside the checkout during upload and restored afterward; no source edits were included.

Disposable API36/4KB and API37/16KB test devices are prepared separately from the owner's existing devices. Signed-artifact results are recorded below; installed-device journeys and final release approval remain pending. No Android submission or OTA has yet been made for this runtime.

## Review and execution setup

Independent preflight review found no blocking issue with the source/web receipts, candidate plan, isolated device setup or prior-release ledger reconciliation. A separate review of the disabled emergency Play publisher found no actionable issue with exact-artifact checks, duplicate prevention, edit validation or uncertain-commit handling. Its live entry remains disabled until a verified AAB hash and an observed Expo submission failure are pinned and reviewed; preparation is not publication. Its ten isolated mock tests passed without real credentials or network access.

The lead retains production ownership. QA requested/accepted `gpt-6-sol` at medium effort; release engineering requested/accepted `gpt-6-sol` at high effort; independent review requested/accepted `gpt-6-astra` at high effort. Effective inference settings are not independently exposed. No specialist is authorized to publish.

The Play Console upload-certificate SHA-256 was checked against the existing signing identity before build validation. The 4KB device has IPv4/IPv6 output filtering; the nonroot 16KB device uses verified offline/no-route isolation, not a claimed firewall. Device APKs will use a disposable test signer and payload/installed-byte comparison; this does not establish Play billing eligibility or store-signing behavior.

## Completed build and verifier correction

Expo finished the exact 1.8.25/code107 candidate after a successful 30m56s Gradle build. The AAB SHA-256 is `8042040478b26b2f12a9665059f803836c05296b5d91bb6435941ee57ddb9488`. Manifest, runtime resource, Production channel, every signed payload entry and the upload certificate passed verification.

The first optimized-JNI check failed because its expected `AsyncContext.createPromise` return descriptor was stale. Two independent readers compared the resolved Expo modules-v2-react 0.2.5 C++/Java contract with the actual AAB DEX: all require and retain `PromiseHandle`; the older 0.2.4 contract returned `Promise`. The verification-only correction requires `PromiseHandle`, updates that exact return descriptor, and also requires the newly registered `nativeResolveNumber(JJD)V` and `nativeResolveBoolean(JJZ)V` methods. All prior class/field/method assertions and existing stripped-artifact controls remain. The corrected full artifact check passes against the same signed AAB. No application source or binary changed to obtain that result. Device and final independent approval remain separate gates.

The finished build timestamp is October 16, 15:41:23.954 UTC. All four universal APK ABIs contain 37 compressed native libraries with extraction enabled. Device-specific APK payloads match the AAB and the installed package bytes match the generated APKs on both devices. The extra library in the earlier Debug APK is `libbarhopper_v3.so`; its absence in the optimized release is not a missing Expo JNI library. Five synthetic controls against the actual parsed AAB DEX reject a missing `PromiseHandle`, the obsolete return descriptor, either missing new native resolver and a missing `NativeObject.nativePointer` field.

Independent exact-commit review of `d208712cbf12661d692d1ac42685ed0fe162e879` found no actionable issue with the verifier correction, static candidate identity or previous-release reconciliation. This commit changes validation and release records only; the candidate retains its original source identity and hash.

## Installed-device validation and release approval

The exact candidate passed 20-second offline foreground startup on API36/4KB and API37/16KB. Both rendered first-run consent with optional analytics off, accepted adult confirmation without enabling analytics, and retained that choice across force-stop/restart. Settled Preferences screens show Analytics off and About 1.8.25 (107). API36 additionally passed bounded connected catalog/artwork, movie detail, local save and watchlist persistence through a restricted proxy. Only the catalog and artwork hosts were observed permitted; other provider/telemetry hosts were denied and direct IPv4/IPv6 probes failed. Captured final logs show no Yify crash or ANR. The lead inspected rendered screenshots and the independent reviewer verified the evidence hashes and installed payloads.

The final bounded release gate was independently approved for the exact build/source/AAB hash above. CI [38927131854](https://github.com/kunal26das/yify/actions/runs/38927131854) passed all three required checks on verifier commit `d208712cbf12661d692d1ac42685ed0fe162e879`. Unexecuted paths remain explicit: connected browsing on 16KB, live account/subscription/purchase/restore, real ads, YouTube, streaming-provider availability, iOS, Play-delivered APK signing behavior and post-release crash health. The provider error visible during isolated QA reflects the intentionally blocked provider endpoint. No real customer, purchase, ad or crash-injection action was performed.

The 16:01:16 UTC Play read still showed production code105 and no bundle107; the fresh Expo list showed no new/in-flight submission. The lead then invoked the established Expo `play-production` route once for exact build `6ffd0567-2af9-4435-b52f-61249cbf02f8`. Submission completion and Play review are tracked separately below.

Expo accepted submission [c41b8840-7c59-4435-a392-819fc1803ba1](https://expo.dev/accounts/kunal26das/projects/yify/submissions/c41b8840-7c59-4435-a392-819fc1803ba1) at 16:02:04.280 UTC. Its submitted-build identity and production/completed configuration match the reviewed candidate. Completion and Google approval are pending at this snapshot.

The QA-owned API36/API37 emulators, proxy, disposable AVDs and temporary APK signing key were stopped or removed after evidence review. Existing devices were not targeted. Those raw artifacts were retained at that cleanup snapshot; their later availability is clarified below. The primary checkout and unfinished Compose migration are the only worktrees; preserve the latter.

## Completed production delivery

The single Expo submission finished successfully at 16:21:22.282 UTC. A fresh 17:21 UTC Play API read verifies completed production 1.8.25/code107 and AAB SHA-256 `8042040478b26b2f12a9665059f803836c05296b5d91bb6435941ee57ddb9488`, exactly matching the tested candidate. No fallback or retry was needed. Authenticated Console release90 shows **Available on Google Play**, 100% across all 171 configured regions, released October 16 at 22:47 IST (17:17 UTC). The ledger timestamp reflects this displayed minute precision. ReTrace mapping and native debug-symbol attachments are visible. Missing crash/ANR metrics do not prove recovery.

A user interruption reset the tool session and the host's temporary raw QA files were no longer present afterward. Their earlier test results, screenshots and independent hash/payload reviews were directly observed before submission and are summarized above; do not describe those raw files as still retrievable. Fresh server receipts and the unchanged signed AAB are recovered into durable private storage. The 99,547,094-byte AAB matches the tested and Play SHA-256; source/build metadata, every signed entry, the upload certificate and the corrected full artifact test pass again. Recovery revalidates server/static identity only and does not repeat or invent device journeys. The new final records reviewer relies on the earlier device observations and reviews, rather than claiming to inspect unavailable raw QA.

Documentation integration, its automatic web publication and final branch cleanup remain pending under task 3.3.
