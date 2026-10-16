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
