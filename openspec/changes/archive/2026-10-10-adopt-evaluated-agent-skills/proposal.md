# Proposal

## Why

The owner requested Anthropic's skill-creator and actual use of its evaluation workflow. Yify's recent product audit provides a concrete reusable workflow; installing a skill alone would not demonstrate that it helps.

## What Changes

- Install a pinned Anthropic skill-creator in the local Codex skill directory under a distinct name, with upstream resources/license and recorded Codex adaptations.
- Add a portable Yify product-audit skill that routes to existing repository policies and preserves task scope.
- Run two realistic paired fixture evaluations with and without that skill; use the upstream review viewer and record meaningful results and limits.
- Document installation/reproduction and appropriate future use, without forcing skill creation onto unrelated tasks.

## Capabilities

No app behavior or existing product requirement changes. This is agent tooling/documentation, so `skip_specs: true` applies.

## Impact

Local Codex skills, `.agents/skills/yify-product-audit/`, concise repository guidance and evaluation evidence. No app dependencies, native runtime, credentials, permission changes or production operations. Existing main CI/deployment triggers must still be considered before any merge.
