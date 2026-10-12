# Tasks

## 1. Sentry integration

- [ ] 1.1 Review Sentry 8.30 upstream changes, update its compatibility policy, regenerate native projects under runtime 1.8.19, and pass install, doctor, typecheck and crash-reporting regressions.
- [ ] 1.2 Independently review the exact repaired #983 head and merge after required CI succeeds; record the commit and actual checks.

## 2. Billing and web integration

- [ ] 2.1 Review RevenueCat 10.12.2 and RN Web 0.21.4, reconcile the asset-registry guard, regenerate native projects under runtime 1.8.20, and pass fresh installation, billing/privacy tests and both web export checks.
- [ ] 2.2 Integrate the preceding merge, independently review the exact repaired #984 head and merge after required CI succeeds; record rendered fixture checks and platform gaps.

## 3. Expo and React Native integration

- [ ] 3.1 Rebase the proposed Expo/RN dependency set and source guards against upstream, regenerate native projects under runtime 1.8.21, and pass fresh installation, compatibility and native lifecycle regressions.
- [ ] 3.2 Integrate the preceding merges, independently review the exact repaired #982 head and merge after required CI succeeds; record full application validation and native compilation evidence.

## 4. Integrated verification

- [ ] 4.1 Verify the combined Android native graph, packaging and isolated emulator startup; record actual ABIs, source commit, commands and any iOS gaps.
- [ ] 4.2 Verify final main CI, both web publication receipts and public routes; confirm no requested PR remains open and the primary checkout is clean.

## Workflow follow-up

- Archive once every tracked implementation and verification task has evidence.
