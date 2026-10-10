# Design

## Context

See proposal.md for motivation. OpenSpec 1.14.1 and six upstream Codex skills already exist. Its config contains only the default schema. CI's required `Typecheck and tests` job currently checks application code but not specs. Existing agent guidance and release safeguards remain authoritative.

## Goals / Non-Goals

**Goals:** keep planning close to code, catch invalid artifacts before merge, and preserve a truthful Android handoff.

**Non-Goals:** a new orchestrator, all-project global profile changes, retroactive specs for the entire app, or an Android release in this adoption.

## Decisions

- Keep the upstream core skills unchanged. Reproduce them with `openspec init --tools codex --profile core`; plain `update` can use a different machine's global profile.
- Put stable user constraints and short artifact rules in `openspec/config.yaml`; keep volatile evidence in each change's design/tasks and link existing release records.
- Add doctor, strict active/spec validation, and archived-task validation to the existing required CI job using exact-version `npx`. A separate optional workflow would not reliably gate existing delivery; adding a CLI to the mobile dependency tree is unnecessary.
- Keep the Android release proposal separate. Existing completed work is cited as evidence; remaining device testing and Play delivery stay unchecked.
- Use the current independent reviewer for semantic validation. Structural success cannot prove that tests ran, an app works, a release is live, or revenue improved.

## Risks / Trade-offs

- CLI transitive dependencies are not lockfile-pinned → pin the top-level version, keep it out of the shipped app, and review updates deliberately.
- A schema-valid document can still be wrong → require evidence review and distinguish planned, verified, published, available, and recovered states.
- Extra process can slow small work → allow concise acceptance notes for mechanical changes without behavior changes.
- Native release evidence can become stale → preserve immutable source/build references and recheck external state immediately before release.

## Migration Plan

Apply the context, contributor guidance, and CI step. Exercise both passing and failing validation cases in disposable fixtures. Review the resulting artifacts, archive only the completed adoption, and leave Android release tasks active. Merge through normal CI. Reverting this change restores the previous planning/check behavior without altering an installed app.
