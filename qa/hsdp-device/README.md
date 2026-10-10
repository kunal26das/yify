# HSDP Android framework regression

This is a standalone Android application, not Yify. It isolates the original malformed-intent crash on real Android framework callbacks without React Native, Firebase, ads, billing, telemetry, OTA, accounts or network permissions. The intended hosted device matrix is API 30 and API 36; completed receipts are required before either is called tested. The official stable SDK inventory offers a default x86_64 AOSP image for API 36 but not API 37, so Android 17/API 37 device coverage remains unrun.

## Exact boundaries

- `legacyDebug`: package `io.github.kunal26das.hsdpregression.legacy`, original HSDP 2.0.1.
- `fixedDebug`: package `io.github.kunal26das.hsdpregression.fixed`, original HSDP 2.2.0.
- Official AAR SHA-256 values are pinned in `policy.mjs` and verified against the resolved AAR before the corresponding native build.
- Both use the same driver source, compileSdk 37, targetSdk 36 and minSdk 24. The compile platform is the actual stable SDK package `platforms;android-37.0`, revision 2. No alias directory or lower SDK is substituted.
- Gradle 9.4.1 uses the repository's checksum-pinned wrapper; AGP 9.2.1, JDK 17, build-tools 37.0.0 and existing command-line tools 12.0 are required. No Expo, Node package installation, NDK, CMake, EAS or signing account is needed.
- Debug signing is only for the new disposable packages. Release tasks are disabled. Neither APK is published or submitted.
- The build checks the resolved dependency graph for forbidden service SDKs. The final signed APK must contain the actual HSDP Activity class, the driver, callback, Application and identity-gate classes, zero requested permissions, no shared UID and no services, receivers, aliases or content providers. The original HSDP Activity must remain non-exported.

## Cases and evidence

`DriverActivity` is an exported test-only launcher in the same application UID as the non-exported HSDP Activity. Each case starts with a unique run ID, a fresh forced-stop process and a new local evidence file. It passes `referrer=local-framework-regression` and `deeplink_url=https://example.invalid/test`, omitting `target_package_name`.

1. `raw-missing` launches the unmodified `HsdpShimActivity` directly. Application lifecycle callbacks record its real framework creation, post-creation and destruction. The original version must produce the specific AndroidRuntime process crash from `onAttachedToWindow`; the fixed version must finish during `onCreate` and reach framework destruction while the process survives. The framework's `onActivityCreated` callback occurs inside `Activity.onCreate`, before HSDP validates the intent, so safe finishing is checked at `onActivityPostCreated` after HSDP returns.
2. `attached`, `configuration`, `new-intent` use a small subclass without modifying the SDK class. They supply a complete local intent only during SDK `onCreate` to obtain a real Android window, then remove the target extra. For `attached`, Android directly delivers the tested callback. For the other two cases, the subclass intentionally defers the SDK's first attached callback so it cannot contact Play services or finish before the requested case. The runner requests a disposable-emulator display-size change for `configuration`; the Activity requests an explicit singleTop launch for `new-intent`. Only a recorded real framework callback with a non-null Android window token allows the test to continue.
3. The original SDK method is invoked through `super`. The 2.0.1 exception is recorded and rethrown, not swallowed or manufactured; AndroidRuntime must log the matching original process crash, message and SDK callback frame. Version 2.2.0 must return with `isFinishing=true`. A second controlled invocation checks its finishing guard; this repeat is labeled a direct repeat, not a second framework delivery. Real framework destruction and continued process survival are required.
4. `empty-create` and `null-create` run only on 2.2.0. Android creates the subclass, which makes the intent empty/null immediately before the original SDK `onCreate`. The SDK return marker and framework post-creation callback must both report finishing, followed by destruction.

Missing launch, missing window token, a configuration request without a delivered callback, a timeout, different exception, wrong PID/source/API, absent destruction, and a process that merely exits all fail. The evidence is narrow: it proves the selected original class's behavior within the real Android lifecycle, not full Firebase startup, Google sign-in, Play Billing or Yify UI behavior.

## Permission and environment prerequisites

The workflow is `.github/workflows/hsdp-framework-qa.yml`. Review its exact source commit before publication or execution. A same-repository pull request affecting this workflow, `qa/hsdp-device/**`, or `tests/hsdp-device.test.cjs` runs its immutable head SHA on API 30 and API 36 independently. Fork pull requests and push events cannot run it. Manual dispatch remains restricted to the default branch and takes one immutable `source_sha`. Both routes use a credential-free checkout and identical KVM, SDK, APK and app-process isolation gates. A draft PR can run these checks before merge; an unresolved merge conflict, a skipped commit, missing approvals or unavailable runner prerequisites can still block a run. Publication that updates the same-repository PR may immediately start this workflow, so publishing the final workflow also needs execution authorization.

The hosted workflow grants its ephemeral runner user exclusive read/write access to `/dev/kvm` using `sudo chown` and `sudo chmod 0600`. This is a host permission change and the receipt records `hostSecurityChanged: true`. The script checks access explicitly and the emulator's acceleration probe before running cases. A local run requires existing access and records whether the caller changed it through `HOST_KVM_ACCESS_CHANGED=true`.

The runner must have the official SDK, command-line tools 12.0 and existing Android SDK license receipts. Required packages must appear in its stable SDK inventory. `sdkmanager --install` reads from closed stdin; no SDK terms are accepted. The required image identifiers are:

- `system-images;android-30;default;x86_64`
- `system-images;android-36;default;x86_64`

Platform, image, emulator and platform-tool metadata are captured. The image/emulator patch revisions are recorded, not claimed to be globally frozen. A clean source checkout and at least 16 GiB available disk are required. The isolated home/Gradle/AVD state must be a new directory outside the checkout. The runner never reads local production signing files or inherits service credentials into the build.

Boot readiness requires three consecutive responsive package/activity/window probes, with the same system_server PID before, after and across the probes, separated by three-second intervals. The existing nine-minute boot budget bounds all probes; sys.boot_completed alone is insufficient. Continuous boot logcat, per-probe readiness evidence and a bounded failure-logcat snapshot preserve framework failures without changing watchdogs or system settings.

After the new AOSP AVD boots, the script verifies its exact disposable identity, API, x86_64 ABI and absence of Google Play Store, Google Play services and Google Services Framework before installing either package. It does not request root adbd, modify radios, firewall rules or other host/guest security settings. The installed APK hash and absence of INTERNET permission are checked again.

At the start of every fresh application process, before driver navigation, `ProbeApplication` records and checks its own `/proc/self/status`, application/package UID, groups, denied INTERNET permission, empty requested-permission list and absent shared UID. It attempts only to create IPv4/IPv6 stream/datagram sockets, with no address, bind, connection or traffic. All four attempts must fail with EACCES or EPERM before HSDP navigation is allowed. The host first launches an identity-only entrypoint and then matches the evidence PID to every case. `run-as` reads the application's saved evidence; its inherited shell groups are never treated as the application's identity. The variants must have distinct application UIDs.

This boundary covers the standalone application's Internet capability. It does not provide whole-OS network confinement, prevent Android's own boot-time traffic, or prove Yify/Firebase/Google integration. The receipt explicitly records `wholeOsNetworkConfinement: false` and `guestFirewallApplied: false`. If whole-OS confinement is required, this route is insufficient and must not be launched as that proof. The emulator is terminated on exit.

## Run and interpret

After source review and explicit execution authorization, on a suitable existing runner:

```sh
bash qa/hsdp-device/run.sh REVIEWED_40_CHARACTER_SHA 30 /new/external/state-api30
bash qa/hsdp-device/run.sh REVIEWED_40_CHARACTER_SHA 36 /new/external/state-api36
```

A successful matrix contains ten validated case results per API in `device-receipt.json`, alongside exact AAR graph/hash receipts, APK hash, source SHA, merged manifest, installed-package evidence, device fingerprint, run IDs/PIDs, structured Activity events, raw PID-filtered logcat and per-process identity/socket-denial evidence. A missing receipt means that device leg did not complete; partial files must not be called a pass. The workflow retains these diagnostics for seven days and does not upload APKs as a release candidate.

Local review checks need only Node:

```sh
node --test tests/hsdp-device.test.cjs
bash -n qa/hsdp-device/run.sh qa/hsdp-device/run-isolated.sh
```

These validate the evidence classifier and fail-closed policy. They do not compile Java, run Gradle, boot Android or prove actual callback behavior. The local-only Java compilation and prior fixture builds do not establish this final hosted APK or device result. Those remain gated on source review and authorized hosted execution.
