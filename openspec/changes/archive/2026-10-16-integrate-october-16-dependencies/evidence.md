# Verification evidence

## Coordinated Expo/RN update — 16 October

Starting main: 60609992297bffbf4eba1c1009a5de27260f1873. Original PR #1000 head: 0bffaba060de80d44c215e68ee5d867ebb5fe080.

- Exact pins, frozen install and 71 native source guards pass. Reanimated lifecycle fixture passes 23 installed cases and 10 upstream controls.
- Typecheck passes; full app suite: 2,293 passed, one skipped, zero failures; crash-reporting workspace: 51 passed.
- Online Expo doctor passes with documented Sentry/Babel/TypeScript and native-config deviations; dependency checking remains enabled.
- Android arm64 Debug compilation passes in 9m25s (1,264 tasks). APK package/runtime code 106, 38 native libraries, compressed/extractNativeLibs packaging check passes. This is development-build evidence, not a store release or device smoke test.
- Native projects regenerated through Expo; CocoaPods resolution succeeds. iOS simulator compilation is still pending at this checkpoint.
- Hosting export and HTML/data-boundary checks pass after adapting the custom HTML document to the streaming renderer. Pages export and browser hydration verification are pending at this checkpoint.
- Focused web-export tests: 43 passed. Pin-watcher tests: 49 passed. OpenSpec current and archived strict validation passes.
- Fresh registry scan: four remaining findings, all release-console pins or the EAS consumer review covered by PR #1003. No incomplete lookups. Babel 7 and regexp-helper compatibility holds have exact candidate/consumer evidence.

Separate prepared changes: PR #1002 wrapper commit 00323b85f3f9a139ae7fac32c862aadc602abb02 (28 focused tests); PR #1003 release commit 49fe1ca6178684a3af1798ca7dcf2cfc4bd8d296 (150 release tests, typecheck, build and frozen install). Independent reviews found no actionable issue in either prepared commit or PR #999. Purchases PR #1001 remains separate and requires a new native runtime after this baseline lands.

No October 16 store submission or OTA has been published. Main merges trigger the existing automatic web workflows. Final merge, deployment and cleanup receipts will be appended after verification.

## Final integration — 16 October

All five PRs merged through the three required status checks and independent exact-head review. Final code main is `ca8e8d123972c6ef10e42f222e191951393a69ed`, version/runtime 1.8.25, Android/iOS build 107.

| PR | Reviewed final head | Required CI | Merge commit |
| --- | --- | --- | --- |
| #1000 | 89621988d705111a63356167568639189b087a27 | 38906486877 | c6bdd73baa73c9c1459dbf768d304b75250701a2 |
| #1002 | 2bd63ba3f139926272c5d373d4113777849ccac5 | 38907332547 | 21d2529a4c349cf33d3b7ca030e215e703535b4f |
| #1003 | 3b32175f1c43da88f52bfdbc2ddbdd7e065cb489 | 38908756271 | 40d0bc46037e5550184900056630ded85ad73719 |
| #999 | 050cc2e9771f9aa843bb7a18455cd47628c30e6e | 38909482186 | 641b25c3b5f23ed09136a8d3bc07c13c279ffa88 |
| #1001 | ebd545a3a775b9afc5a9c6de8fbf7e3ffa1e182f | 38910081841 | ca8e8d123972c6ef10e42f222e191951393a69ed |

Final PR CI confirms 2,293 app tests passed, one skipped, and 51 crashreporting tests passed. Typechecks, exact pins, native guards and the online Expo Doctor 1.21.4 pass with the documented deviations. The post-integration doctor/watcher suite passes 77 tests. Release-console verification passes all 150 tests, typecheck, frozen installation and build. Android HSDP verification `38910081737` also passes.

Both native integration stages compile on Android arm64 Debug and unsigned generic iOS Simulator (arm64 and x86_64). The final code107 APK contains 38 arm64 native libraries with extraction enabled; SHA-256 is `bdffbd8de33ee35b4293a0dd1b0998a917ffb69667f8965662382562d9c063b4`.

The final iOS lock changes only PurchasesHybridCommon 19.11.0, RevenueCat 5.95.0 and RNPurchases 10.13.0 from the coordinated baseline. Parsed native project comparisons retain build settings, shell scripts, resources and phase order despite generated UUID churn; privacy declarations are unchanged. Official public CocoaPods specs resolved a temporary CDN failure without unrelated pod changes.

Both web exports pass HTML/data-boundary validation and 43 focused export tests. Browser checks of the coordinated baseline load all five bootstrap scripts, use the expected title, and show adult and optional analytics switches off with Continue disabled. Changing the adult switch hydrates correctly without storing choices. After explicit local test consent with analytics off, both previews render the same-origin catalog fixture. Browser interception was armed before navigation; outbound vendor calls were blocked. These are fixture-based post-consent checks, not production purchase/provider journey claims.

The trusted dependency watcher `38909473653` closed issue #921 at 13:39:28 UTC with zero findings and zero incomplete checks. A final-main rescan is recorded below when complete. Compatibility holds remain exact and expire when candidate or consumer versions change.

Cleanup verified both temporary review worktrees were clean and their trees matched the squash merges. Their only ignored files were regenerable release dependencies/output. After creating and verifying a private committed-ref recovery bundle, both worktrees and all completed local/remote task branches were removed. The primary checkout was clean on final code main; the unfinished Compose migration remains untouched. These worktree removals discarded only generated files; no credentials or unfinished migration files were included in the removed checkouts or public evidence.

No October 16 store build, submission or OTA was published. Runtime 1.8.25 requires a new binary before any compatible OTA; physical-device billing/restore and full store-artifact verification remain future release gates. Previous Play availability and crash-health statements are not reverified by this maintenance task.

Final-main watcher `38910941787` passed at `ca8e8d123972c6ef10e42f222e191951393a69ed`; issue #921 remains closed with zero unreviewed pins and zero incomplete checks.

## Verified web delivery

Final code main `ca8e8d123972c6ef10e42f222e191951393a69ed` passed main CI [38910835228](https://github.com/kunal26das/yify/actions/runs/38910835228). Automatic [Hosting run 38911517459](https://github.com/kunal26das/yify/actions/runs/38911517459) published deployment `zai5atttz6`; automatic [Pages run 38911517812](https://github.com/kunal26das/yify/actions/runs/38911517812) published Pages deployment `7120809639`. No manual deployment or retry was needed. An intermediate Pages run refused an obsolete commit after main advanced; the final delivery succeeded.

Fresh-browser live checks at `https://yify.expo.app/` and `https://kunal26das.github.io/yify/` each observed 19 successful same-origin responses, including five app scripts and loaded fonts. React attached, the expected page title and consent gate rendered, adult and analytics switches were off, Continue was disabled, and local storage was empty. No page exceptions, console errors, failed same-origin requests or outbound attempts occurred. Interception was armed before navigation; no consent or billing actions were performed. Task-owned browser helpers/profiles were removed afterward.

Hosting's live preflight passed HTML and real movie/show catalog JSON checks. Pages' same-origin API preflight returned 404 because static Pages does not host API routes; passive live startup was verified separately. Full post-consent Pages/provider/purchase journeys remain untested. The earlier fixture-based interactive checks establish hydration, not live third-party behavior.
