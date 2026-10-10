# OpenSpec

Install the CLI on each development machine with Node.js 20.19 or newer:

```sh
npm install --global @fission-ai/openspec@1.14.1
openspec doctor --json
```

The six Codex skills are committed under `.agents/skills/`. Start with
`$openspec-propose "describe the change"` or `$openspec-explore`.

Keep project constraints in `openspec/config.yaml`. Follow `AGENTS.md` and
`CLAUDE.md` for architecture, validation, and release rules. The generated skills
can be refreshed with `openspec update`; avoid editing them directly.

To disable OpenSpec usage telemetry on a new machine:

```sh
openspec config set telemetry.enabled false
```
