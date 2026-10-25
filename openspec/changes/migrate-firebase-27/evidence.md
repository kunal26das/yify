# Verification evidence

## Candidate and scope

The migration starts from main `683a60dbaaf8d8504480c3602406068980de7d86` and the verified Firebase dependency proposal [PR1033](https://github.com/kunal26das/yify/pull/1033). The candidate is1.8.29/code111. A private verified Git bundle preserves both baseline refs. No credentials or secret values are part of these artifacts.

## Dependency and source checks

- All five installed/declaration RNFirebase packages27.0.0, Firebase JS13.0.0 and Google wrapper16.1.5 use exact pins. The root lockfile is the verified proposal's lockfile; frozen installation passed.
-101 reviewed package/version/SHA256 source targets verify after postinstall. Unknown source or unapplied patches fail closed. The wrapper public Objective-C header comparison showed additive SDK changes; compilation and runtime evidence are assessed separately.
- Firebase compatibility fixtures cover partial installs, SDK and toolchain drift, mandatory Google app-link registration, preserved false optional analytics/ad defaults, required crash-handler defaults and static-linking override boundaries. A clean-checkout regression verifies source manifests before installation and requires the installed graph afterward; Dependabot's preinstall step uses the explicit manifests-only mode.
- The existing crashreporting workspace retains injected SDK adapters. No application identity, paywall, entitlement, consent or crash-grouping implementation changed.

## Apple resolution and linking

The public [Firebase27 migration requirements](https://rnfirebase.io/migrating-to-v27) require Apple SDK13 through SwiftPM. Google SDK10.1's published AppCheck range includes12. A CocoaPods range-only bridge still selected AppCheckCore11 and was rejected.

Private SDK-only Debug/Release fixtures compiled Objective-C and Swift imports using the shared GoogleSignIn10.1 product. A mixed dynamic RN wrapper/static Expo adapter fixture reproduced an unresolved GIDSignIn class without the app-target product link and passed with it. The static adapter contract is retained for Expo Core. A generated resource-bundle finder class appeared twice in the expanded fixture's symbol inventory; Firebase/Google runtime classes were not duplicated. This is not a claim of zero duplicate classes overall or proof of real provider sign-in.

Full application Expo prebuild, CocoaPods installation and Xcode SwiftPM resolution passed on October25. The graph pins Firebase13.0.0, GoogleSignIn10.1.0 and AppCheck12.0.0. All five RNFB pods are27.0.0; both Google wrapper pods are16.1.5. Legacy Firebase, GoogleSignIn, GoogleUtilities, Recaptcha and AppCheckCore CocoaPods entries are absent. The app retains exactly one matching Google package reference, application product and Frameworks build-file link after Pod hooks. The workspace, lock and aggregate privacy manifest were regenerated. Runtime/channel are1.8.29/Production, app/build1.8.29/111. The generic RNFB dynamic SwiftPM embedding phase remains installed.

Full-app Debug/Release compilation, embedding and bounded initialization remain separate gates; resolution and SDK fixtures alone do not establish them. iOS publication is excluded.

## Local application checks

Typecheck passes for the app and crashreporting workspace. The complete candidate test run passes2463 app tests, with one existing optimized-JNI test skipped until an APK is supplied, and all51 crashreporting tests. Coverage includes account isolation, sign-in cancellation/retry, consent persistence and withdrawal, purchase/restore attribution, fatal/nonfatal forwarding and crash fingerprints. These are local/mocked regressions, not real provider or billing acceptance.

Both Hosting and Pages exports pass the existing rendered page/API/data-boundary checker. The release console typecheck,150 baseline tests and build pass. Online Expo doctor passes with the existing three reviewed deviations; no exclusion was added. Strict active/archived OpenSpec validation, agent-team validation and targeted ESLint pass. An independent precommit review found and verified the R8 build-suffix guard correction; exact-commit/native/artifact review remains pending.

## Android toolchain diagnosis

A private configuration-only Gradle run reproduced a classloader mismatch: the root buildscript resolved KGP2.4.21, while the app and Expo root plugin loaded2.2.10 from the buildSrc parent classloader. DependencyInsight traced the parent dependency to the UMP buildSrc AGP API edge, through AGP9.2.1 to KGP2.2.10. A direct buildSrc pin corrected the loader. Temporary included-compiler changes were removed after the parent cause was isolated; the bundled RN/Expo compilers retain their original declarations.

The first native CI run then exposed missing Pika1.1.0-2.4.21 and Expo V2 compiler0.2.5-2.4.21 artifacts, even though configuration/runtime graph checks passed. Maven Central metadata, POMs, modules, JARs and maintainer Gradle-plugin source confirm both plugins construct their version from the loaded Kotlin patch and publish matching2.4.20 variants. The candidate now pins2.4.20, which also meets Firebase27's2.4 floor and Kotlin's supported Gradle/AGP range. Compile-only QA resolves every release compiler classpath and verifies the two reviewed JAR SHA256 values before app compilation; no compiler override or feature disable is used.

The final diagnostic verifies loaded KGP2.4.20, Gradle9.4.1, AGP9.2.1, bundled R8 9.2.14, BoM35.0.0 and23 selected Firebase modules with no duplicate selected module versions. Owning-project verification tasks resolve57 release compiler configurations, hash-check the reviewed Pika and Expo V2 JARs, and write reports consumed by a root aggregate. This preserves Gradle's project locking; root tasks do not resolve child configurations. Twenty-one sampled input hashes are identical before/after. Independent review also hashes the downloaded JARs and confirms both pins.

Compile-only QA rejects a loaded Kotlin or R8 version outside the reviewed toolchain, and its real-Gradle regression accepts the captured R8 build suffix while refusing wrong/malformed versions. Existing late-enable and unknown-upload execution guards still pass. Full native compilation remains required; no app binary or upload was requested by configuration diagnostics.

## Release boundaries

Existing remote Expo Android signing and Play submission assignments were verified by metadata only. The October25 preflight found no1.8.28/code110 build. The previous1.8.27/code109 Expo build/submission finished and Play reported a completed production track; current Google review/public availability was not established. The shipped-runtime ledger must not infer availability from that receipt.

The installed EAS CLI rejects an uppercase build-profile channel, so the candidate retains the existing profile with no channel field and preserves the native Production request headers and EXPO_UPDATE_CHANNEL. No lowercase channel migration is introduced, and null EAS build metadata is not treated as a registered channel. A regression checks the committed profiles through the actual installed CLI schema and rejects the invalid uppercase addition; signed AAB validation must verify the native Production header.

No1.8.29 production build, submission or public release has occurred at this evidence stage. Before release, recheck duplicate jobs, validate the exact source in CI and native QA, inspect the signed four-ABI AAB and generated APKs, verify isolated API36/4KB and API37/16KB startup/consent persistence, and submit the exact build once through play-production. Existing main CI publishes web automatically; source-bound readback is a separate required gate. Provider OAuth, billing and real crash delivery are not proven by mocks, offline initialization or unsigned builds.
