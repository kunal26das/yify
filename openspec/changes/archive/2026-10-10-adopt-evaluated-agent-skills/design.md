# Design

Install the full upstream skill subtree pinned to commit `b8e53f1c05dff3b6d751297f6527990ffc81c2f4`. Alias its frontmatter to `anthropic-skill-creator` to preserve Codex's built-in creator. Keep upstream hashes/license and document the added Codex compatibility guidance and UI metadata. Reuse native subagents; Claude CLI/API optimization is a separate runtime and is not a Codex trigger benchmark.

Capture the recent product-audit workflow as a concise repository skill with an on-demand journey reference. It should preserve explicit read-only and narrow requests, use designer/QA/reviewer roles proportionally, test loading/empty/error/recovery and stale-state behavior, and separate mocks/exports from live/native/release evidence. Existing AGENTS/CLAUDE/OpenSpec guidance remains authoritative rather than duplicated.

Use two independent with/without pairs with the same model/effort request and synthetic fixtures. One examines existing-journey failures from a small evidence packet; the other protects a narrow UI fix from becoming a broad audit. Keep evaluators away from grading criteria and prior outcomes, and baseline agents away from the candidate skill. Batch pairs within the three-specialist limit. Grade observable outcomes, retain outputs, and use upstream aggregation/static viewer. Missing token/runtime statistics stay unavailable. A single run per case is a smoke comparison, not statistically established improvement or automatic-trigger validation.

Local installation and fixture testing require no additional service access. Do not run any evaluated production action, SDK checkout, ad event or release. Human feedback can inform later iterations; absent feedback is not approval or an empty completed review.
