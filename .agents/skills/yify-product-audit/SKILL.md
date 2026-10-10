---
name: yify-product-audit
description: Review and close product gaps across existing Yify journeys without adding features. Use for whole-app or multi-journey product audits, completion passes, and consistency reviews. Do not turn an isolated bug fix, status request, or feature discussion into an audit.
---

# Yify Product Audit

Start with the user's requested outcome and scope. A review-only request produces findings; an implementation request includes fixes and verification. For a narrow fix, follow the repository's normal workflow and stop there.

## Establish the boundary

1. Locate the checkout and read `AGENTS.md`, `CLAUDE.md`, and the relevant active OpenSpec change. Follow their architecture, release safeguards, commands and team policy. This skill supplements those instructions.
2. Inspect current changes before editing. Preserve unrelated work and identify the actual proposed revision. Historical screenshots, specs and passing tests are leads, not proof of current behavior.
3. Define the existing journeys covered and the acceptance criteria. Do not add capabilities, new services, monetization experiments or a redesign under a gap-filling request.

## Audit the experience

Trace routes through screens, view models and service ports. Load [journey prompts](references/journeys.md) for the applicable flows, then verify against current source; it is not an exhaustive or permanently current feature inventory.

For each flow, inspect loading, populated, empty, failure, retry, cancellation and repeated actions. Distinguish a genuinely empty result from an unavailable service. Preserve useful loaded content during refresh, but never retain another account's private state. Check late responses after query, route or identity changes. A stale request must not overwrite the current journey.

Check that labels, disabled states, success messages and recovery actions describe what actually happened. Follow platform twins and accessibility behavior: keyboard/focus, meaningful control names, text scaling, truncation and small-screen layouts.

Record only evidence-backed findings: user impact, exact location or reproduction, smallest correction, and verification that would fail before the fix. Separate confirmed defects from questions requiring device or service access. Prioritize blocked journeys and incorrect account, purchase or privacy outcomes over cosmetic consistency.

Use the repository's role briefs and concurrency limits. Involve a designer for material layout/interaction issues, QA for independent journey evidence, and a security/privacy reviewer for changes involving account boundaries, payment or consent. Delegate bounded tasks; do not instantiate every role for every audit.

## Fix and verify

Make the smallest coherent corrections using existing primitives and layer boundaries. Keep native and web implementations consistent where the port promises the same behavior. Test meaningful regressions, including rejected operations and out-of-order responses when relevant.

For preview QA, inspect bootstrap and service fallbacks before launch. Missing environment variables do not guarantee an offline app. Use isolated fixtures or test services, run the repository's preview preflight, and block external telemetry before the first navigation. Do not exercise purchases, advertisements, notifications or destructive account actions against production as tests.

Run the applicable repository gates and independently review the final proposed revision. A web export is not rendered verification; mocked unit tests are not native-device evidence; a resized browser is not an Android font-scale test. Recheck affected behavior after a correction without repeatedly running unrelated checks.

## Close the loop

Keep requirements, tasks and verification evidence together in OpenSpec when required by repository policy. Report what changed, how it was checked, and material coverage limits. Distinguish source inspection, unit tests, rendered fixtures, live services and released behavior. Mark only completed tasks complete. Follow existing user authorization and release policy; using this skill grants no additional deployment, spending or credential authority.
