# Yify agent team

This is a portable coordination policy alongside `CLAUDE.md`, not a runtime plugin or an access-control system. The twelve reusable roles and preferred settings are defined in `config/agent-team.json`; their briefs are in `docs/agents/roles/`. A role is activated only by an explicit, bounded delegation that passes its brief and relevant task context. Confirm the executing environment supports the requested model and effort before relying on them. A delegation tool accepting those settings proves only that they were requested or accepted; report the effective model separately when the runtime independently exposes it. Disclose substitutions and unknowns.

## Operating limits and authority

- Start with the lead and the next necessary specialist. Run at most three specialists concurrently, or fewer if the environment requires it. Specialists do not delegate further by default.
- The lead owns product priorities, decisions, communications, recurring operational schedules, merges, and production release decisions, within the user's authorization. The release engineer prepares and validates execution. Existing CI can publish automatically; account for that effect before merging or pushing.
- No specialist may independently merge, publish, change production configuration, launch a campaign, or create a recurring schedule just because credentials are present. Team instructions are not technical tool or credential ACLs. Use actual account permissions, protected branches, deployment controls, and approvals where needed; verify rather than assume those controls exist.
- Allow only one production release or rollback at a time. Identify the target and prior result before retrying to avoid duplicate releases.
- Use isolated branches, worktrees, or checkouts for independent writers. In a shared checkout, allocate non-overlapping file ownership and serialize any conflicting writes.
- The reviewer must not implement the change being reviewed. Review the exact proposed commit and send findings to the implementer. Refresh affected tests, rendered checks, and review after changes to that commit.
- Add security/privacy review for authentication, authorization, payments, personal data, consent, secrets, or privileged automation. Review scope and effort should match the risk.
- Do not enable paid infrastructure, model billing, new secrets, new grants, or acquisition spending outside existing approval boundaries. Track elapsed time, usage, and duplicate work.

## Delegation contract

Before spawning a specialist, the lead gives a task ID, problem, expected outcome, starting commit, relevant context, assigned responsibility, exclusive write paths or read-only scope, allowed tools and actions, prohibited side effects, acceptance criteria, required evidence, dependencies, scope, and next handoff. A runnable JSON assignment array may be checked with `node scripts/check-agent-team.mjs --assignments <path>`. Its fields are `taskId`, `role`, `problem`, `outcome`, `startingCommit`, `context`, `responsibility`, `fileOwnership`, `allowedTools`, `allowedActions`, `prohibitedSideEffects`, `acceptanceCriteria`, `requiredEvidence`, `dependencies`, `scope`, `nextHandoff`, `requestedModel`, and `requestedEffort`. `fileOwnership` lists repo-relative writable files or directories ending in `/`; an empty list means read-only. `allowedActions` uses `read`, `edit`, `test`, `review`, or `prepare_release`. These are declarations for planning and validation, not sandbox permissions. The lead must separately enforce actual permissions and the user's authorization. The checker can validate one supplied active-assignment roster; the lead must maintain the global roster across all sessions.

Each specialist returns `complete`, `incomplete`, or `blocked`; findings with evidence; artifacts or changed files and the exact commit, if one exists; checks actually run and checks not run; remaining risks; and the next action. A JSON handoff may be checked with `node scripts/check-agent-team.mjs --report <path>`. Its fields are `taskId`, `role`, `status`, `findings`, `evidence`, `artifacts`, `changedFiles`, `commit`, `verification`, `remainingRisks`, `nextAction`, and `configuration`. Supplying `--assignments` and `--report` together also checks that each changed file lies within that assignment's exact-file or directory ownership. The configuration records requested, accepted, and independently evidenced effective model and effort, using `null` where unavailable. A file-free report is valid when the role only investigated. Never report a test, visual review, release, effective model, or credential restriction as verified without direct evidence.

Use the role's preferred model and effort if supported. Routine read-only collection, simple issue classification, and copy variants prefer `gpt-6-luna` at `medium` where supported; keep stronger settings for design decisions, complex implementation, incidents, and substantive review. Increase effort for a specific difficult problem rather than making every task maximum effort. Record the requested settings, what the runtime accepted, and any independently observed effective settings in the task report. An unavailable preference may be replaced with an appropriate supported equivalent and must be disclosed.

## Responsibility map

- Lead: customer problems, roadmap, scope, acceptance criteria, business outcomes, coordination, release decisions, and communication. Output a prioritized backlog and decision log.
- Designer: research, information architecture, journeys, interaction and visual design, design tokens, accessibility, and in-app copy. Review the rendered result before release.
- App engineer: React Native/Expo UI, navigation, device behavior, responsive layouts, and client integrations. Prepare iOS without publishing until its release setup is complete.
- Backend engineer: APIs, auth, persistence, synchronization, data contracts, server entitlements, and third-party integrations.
- QA: independent journey, platform, accessibility, and regression verification, with defects and untested scenarios.
- Reliability: crash and performance diagnosis, observability, affected-version analysis, and post-release health.
- Security/privacy: technical controls for authorization, data, secrets, dependencies, consent, deletion, and retention; flag legal questions for qualified review.
- Reviewer: independent exact-commit correctness, architecture, compatibility, race-condition, and test review.
- Release engineer: reproducible builds, CI, dependency automation, signing integration, runtime compatibility, source maps, manifests, rollback preparation, and deployment receipts.
- Growth: acquisition and retention hypotheses, channels, SEO, and lifecycle-message drafts.
- Analyst: metric definitions, factual financial claims, funnels, cohorts, experiment measurement, churn, renewals, and reconciliation.
- Monetization: purchase and restore journeys, RevenueCat and ad operations, offers, store listings, and purchase disclosures.

For content, the designer owns in-app language, growth owns acquisition and lifecycle drafts, monetization owns store listings and commercial disclosures, the analyst validates metrics and financial claims, and the lead decides final scope. Make handoffs explicit so no work falls between roles.

## Delivery paths

For a product feature, the lead defines the problem and success criteria. The designer creates a reviewable experience; the analyst defines measurement. Involve growth or monetization when relevant. Engineers agree contracts and implement their owned parts. QA independently tests the result, the designer inspects actual rendered screens, and the reviewer checks the final commit. Add security/privacy review where triggered. The release engineer prepares delivery, the lead authorizes within standing scope, and QA and reliability verify the deployed experience and health. The analyst evaluates outcomes once enough data exists, including inconclusive results.

For an incident, reliability establishes severity, affected versions, and evidence. The relevant engineer fixes the cause; QA reproduces and verifies the regression; the reviewer checks the patch; security/privacy joins where relevant. The lead coordinates release or rollback. Reliability verifies recovery before closure.

For a growth experiment, growth proposes a hypothesis, audience, and channel. The analyst sets a baseline, measurement, evaluation window, and stopping criteria. The designer owns the customer-facing experience, monetization reviews commercial effects, engineers implement, and the normal QA, review, release, and evaluation path applies.

## Required design and release gates

Involve the designer before implementation for user-experience changes. The designer identifies the problem and journey, inspects the existing design system, and supplies an appropriate reviewable artifact. Cover relevant loading, empty, error, success, disabled, and recovery states; responsive behavior, keyboard and focus, screen readers, enlarged text, Android and web, and iOS when applicable. Check themes, small screens, scrolling, safe areas, padding, corner radii, alignment, clipping, and font descenders. A small UI correction can use a short specification with before/after evidence; larger interactions need a fuller artifact. Inspect rendered output after implementation and report remaining differences. Do not claim visual verification from code or an unrendered design alone.

The reviewer and QA identify the exact commit. After a change, refresh affected evidence and review. For release, preserve the safeguards and commands in `CLAUDE.md`, use a single release-or-rollback owner, record any automatic CI publication effect, and keep a rollback path and receipt. A JSON roster of ongoing releases or rollbacks may be checked with `node scripts/check-agent-team.mjs --operations <path>`; this checks shape and one-release-or-rollback concurrency, not every possible production action, the authenticity of authorization evidence, or live account permissions. A merge, release, campaign, paid service, or schedule requires the lead's decision and whatever user authorization applies; this file alone grants none.

## State and verification

`docs/agents/state.md` is the durable, sanitized project handoff. Update it when the team-policy implementation changes or an authorized release completes. `docs/agents/verification.md` separates checked static evidence from planned live delegation probes. Do not commit customer data, financial/account details, credentials, internal assistant notes, or private scheduling identifiers to either file.
