# HSDP Android framework regression

This is a standalone Android application, not Yify. It isolates the original malformed-intent crash on real Android framework callbacks without React Native, Firebase, ads, billing, telemetry, OTA, accounts or network permissions. The tested device matrix is API 30 and API 35. API 35 is an additional comparison, not the latest Android release; Android 17/API 37 device coverage remains unrun.

## Exact boundaries

- `legacyDebug`: package `io.github.kunal26das.hsdpregression.legacy`, original HSDP 2.0.1.
- `fixedDebug`: package `io.github.kunal26das.hsdpregression.fixed`, original HSDP 2.2.0.
- Official AAR SHA-256 values are pinned in `policy.mjs` and verified against the resolved AAR before the corresponding native build.
- Both use the same driver source, compileSdk 37, targetSdk 36 and minSdk 24. The compile platform is the actual stable SDK package `platforms;android-37.0`, revision 2. No alias directory or lower SDK is substituted.
- Gradle 9.4.1 uses the repository's checksum-pinned wrapper; AGP 9.2.1, JDK 17, build-tools 37.0.0 and existing command-line tools 12.0 are required. No Expo, Node package installation, NDK, CMake, EAS or signing account is needed.
- Debug signing is only for the new disposable packages. Release tasks are disabled. Neither APK is published or submitted.
- The build checks the resolved dependency graph for forbidden service SDKs. The final signed APK must contain the actual HSDP Activity class, both driver classes, zero requested permissions and zero content providers. The original HSDP Activity must remain non-exported.

## Cases and evidence

`DriverActivity` is an exported test-only launcher in the same application UID as the non-exported HSDP Activity. Each case starts with a unique run ID, a fresh forced-stop process and a new local evidence file. It passes `referrer=local-framework-regression` and `deeplink_url=https://example.invalid/test`, omitting `target_package_name`.

1. `raw-missing` launches the unmodified `HsdpShimActivity` directly. Application lifecycle callbacks record its real framework creation and destruction. The original version must produce the specific AndroidRuntime process crash from `onAttachedToWindow`; the fixed version must finish during `onCreate` and reach framework destruction while the process survives.
2. `attached`, `configuration`, `new-intent` use a small subclass without modifying the SDK class. They supply a complete local intent only during SDK `onCreate` to obtain a real Android window, then remove the target extra. For `attached`, Android directly delivers the tested callback. For the other two cases, the subclass intentionally defers the SDK's first attached callback so it cannot contact Play services or finish before the requested case. The runner requests a disposable-emulator display-size change for `configuration`; the Activity requests an explicit singleTop launch for `new-intent`. Only a recorded real framework callback with a non-null Android window token allows the test to continue.
3. The original SDK method is invoked through `super`. The 2.0.1 exception is recorded and rethrown, not swallowed or manufactured; AndroidRuntime must log the matching original process crash, message and SDK callback frame. Version 2.2.0 must return with `isFinishing=true`. A second controlled invocation checks its finishing guard; this repeat is labeled a direct repeat, not a second framework delivery. Real framework destruction and continued process survival are required.
4. `empty-create` and `null-create` run only on 2.2.0. Android creates the subclass, which makes the intent empty/null immediately before the original SDK `onCreate`. Safe finish and destruction must be observed.

Missing launch, missing window token, a configuration request without a delivered callback, a timeout, different exception, wrong PID/source/API, absent destruction, and a process that merely exits all fail. The evidence is narrow: it proves the selected original class's behavior within the real Android lifecycle, not full Firebase startup, Google sign-in, Play Billing or Yify UI behavior.

## Permission and environment prerequisites

The workflow is `.github/workflows/hsdp-framework-qa.yml`. Review its exact source commit before publication or execution. A same-repository pull request affecting this workflow, `qa/hsdp-device/**`, or `tests/hsdp-device.test.cjs` runs its immutable head SHA on API 30 and API 35 independently. Fork pull requests and push events cannot run it. Manual dispatch remains restricted to the default branch and takes one immutable `source_sha`. Both routes use a credential-free checkout and identical KVM, SDK, APK and device-confinement gates.

The runner must already have readable and writable `/dev/kvm`. The script checks actual ownership/access and the emulator's acceleration probe; it does not run sudo, chmod, chown, usermod, or modify host firewall/security settings. Missing KVM access is a blocker, not permission to repeat the earlier temporary permission grant.

The runner must have the official SDK, command-line tools 12.0 and existing Android SDK license receipts. Required packages must appear in its stable SDK inventory. `sdkmanager --install` reads from closed stdin; no SDK terms are accepted. The required image identifiers are:

- `system-images;android-30;google_apis;x86_64`
- `system-images;android-35;google_apis;x86_64`

Platform, image, emulator and platform-tool metadata are captured. The image/emulator patch revisions are recorded, not claimed to be globally frozen. A clean source checkout and at least 16 GiB available disk are required. The isolated home/Gradle/AVD state must be a new directory outside the checkout. The runner never reads local production signing files or inherits service credentials into the build.

After the new AVD boots, root adbd must be available. Before either test package is installed or launched, the script confirms the exact disposable AVD identity/API, disables its radios and installs first-rule IPv4 and IPv6 OUTPUT drops inside that emulator only. Independent rule reads and failing IPv4/IPv6 loopback canaries with increasing kernel drop counters verify the boundary without sending test traffic to a public destination. The installed APK hash and absence of INTERNET permission are checked again. Rules are rechecked after every case. The emulator is terminated on exit; no user's device or host permission is altered.

The emulator OS boots before its guest firewall is applied; this workflow does not claim boot-time whole-OS network confinement. The standalone driver is installed only after confinement and has no network permission or production endpoints in either case. If boot-time OS-wide isolation is required too, do not launch this workflow until an independently isolated runner/AVD route is approved.

## Run and interpret

After source review and explicit execution authorization, on a suitable existing runner:

```sh
bash qa/hsdp-device/run.sh REVIEWED_40_CHARACTER_SHA 30 /new/external/state-api30
bash qa/hsdp-device/run.sh REVIEWED_40_CHARACTER_SHA 35 /new/external/state-api35
```

A successful matrix contains ten validated case results per API in `device-receipt.json`, alongside exact AAR graph/hash receipts, APK hash, source SHA, merged manifest, installed-package evidence, device fingerprint, run IDs/PIDs, structured Activity events, raw PID-filtered logcat and guest firewall evidence. A missing receipt means that device leg did not complete; partial files must not be called a pass. The workflow retains these diagnostics for seven days and does not upload APKs as a release candidate.

Local review checks need only Node:

```sh
node --test tests/hsdp-device.test.cjs
bash -n qa/hsdp-device/run.sh qa/hsdp-device/run-isolated.sh
```

These validate the evidence classifier and fail-closed policy. They do not compile Java, run Gradle, boot Android or prove actual callback behavior. Those remain gated on the reviewed hosted execution.
