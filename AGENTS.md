# Agent guidance

Read `CLAUDE.md` before working in this repository. It is the source for commands, architecture, conventions, and release safeguards. Follow its no-code-comments and no-agent-attribution rules.

The portable Yify team policy is in `docs/agents/team.md`, with one role brief per file in `docs/agents/roles/`. `config/agent-team.json` records preferred models, effort, delegation limits, and role paths. Run `node scripts/check-agent-team.mjs` when changing any team policy file.

This repository does not automatically instantiate these roles. The lead explicitly delegates bounded tasks through a runtime that supports selecting a model and effort, supplies the relevant role brief and task context, and records what was actually requested and independently verified. Do not infer tool permissions or credential isolation from the role files. The lead retains all merge, production release, and recurring-schedule decisions, subject to the user's authorization.

Use OpenSpec for substantive features, cross-cutting fixes, and release work. Read `openspec/config.yaml` and run `openspec list --json` before starting; reuse relevant active changes. Keep requirements, design decisions, task evidence, and changed behavior together. Small mechanical fixes or dependency updates without behavior changes can use concise PR acceptance notes. Follow the user's authorized scope without requesting approval for each artifact; a planning-only request remains planning-only. Instructions and commands are in `openspec/README.md`. Validate specs in addition to the existing app checks, obtain independent scenario/evidence review, and archive only completed work.
