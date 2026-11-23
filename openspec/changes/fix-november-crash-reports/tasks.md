# Tasks

## 1. Navigation

- [x] 1.1 Replace the module-level `router` with `useRouter()` in every screen and component under `app/` and `presentation/`, passing the scoped router to the native notification-open handler; typecheck passes.
- [x] 1.2 Add a behavioural test with Expo Router's unbound global router and a source test rejecting the global import; both fail on the previous source and pass with the fix.
- [x] 1.3 Update affected component test mocks to supply `useRouter`; the full app suite passes.

## 2. Android 7.x startup

- [x] 2.1 Reproduce the launch failure with the 1.8.29/code 111 production bundle on an isolated API 25 arm64 emulator and record the `java.nio.file.Path` resolution failure.
- [x] 2.2 Confirm Expo Modules v2 React 0.2.8 and 0.3.0 still reference `java.nio.file.Path` in `TypeConverterRegistry`.
- [x] 2.3 Add `withCoreLibraryDesugaring` with fail-closed plugin tests and regenerate the Android project; only the desugaring lines change.
- [x] 2.4 Launch a desugared release build on API 25 and observe Expo Modules v2 installation and a rendered first screen without a fatal error.
- [x] 2.5 Pass compile-only Android QA on the integrated runtime 1.8.32 source, including clean Android regeneration and four-ABI release compilation (run 45211030504 on the #1090 head containing this change).

## 3. Web monitoring

- [x] 3.1 Drop web errors whose original stack frames all belong to browser extensions; tests keep application, mixed, frameless and native errors.

## 4. Delivery

- [x] 4.1 Pass required CI on the final head and merge (#1091 as `87fca2eccbd73767333a4be33ff733dc0cdceebd`; main CI 45210789847).
- [x] 4.2 Include the change in the Android 1.8.32/code 114 production build and verify its signed bundle, the Expo modules v2 JNI contract and an API 25 launch (EAS build `da81d5e6-75e7-4650-a967-b33584343cb7`).
- [ ] 4.3 After availability, confirm that YIFY-2R and YIFY-2Z do not recur on 1.8.32 before resolving them.
