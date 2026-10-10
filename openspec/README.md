# OpenSpec

Install the CLI on each development machine with Node.js 20.19 or newer:

```sh
npm install --global @fission-ai/openspec@1.14.1
openspec doctor --json
```

The six Codex skills are committed under `.agents/skills/`. Agents use them for
substantive work; the owner can describe the outcome without remembering commands.

1. Explore the relevant code, existing specs, and current evidence with `$openspec-explore`.
2. Use `$openspec-propose "describe the change"` to record the proposal, scenarios,
   design, and verifiable tasks under `openspec/changes/`.
3. Use `$openspec-apply-change <change>` for authorized implementation and
   `$openspec-update-change <change>` when requirements or evidence change.
4. Compare the result with each scenario through tests and independent review.
   `$openspec-sync-specs <change>` updates implemented requirements without archiving.
5. Use `$openspec-archive-change <change>` after the tracked work is complete.
   Canonical requirements live in `openspec/specs/`; unfinished work stays active.

Small mechanical changes without behavior changes can use concise PR acceptance
notes. Specs supplement the existing review, app tests, and release checks.

Keep project constraints in `openspec/config.yaml`. Follow `AGENTS.md` and
`CLAUDE.md` for architecture, validation, and release rules. Refresh the same core
skills with `openspec init --tools codex --profile core`; plain `openspec update`
uses the machine's global workflow selection. Avoid editing generated skills.

Run the checks CI requires:

```sh
openspec doctor --json
openspec validate --all --strict --json --no-interactive
openspec validate --archived --strict --json --no-interactive
```

These commands check structure and archived task completion, not whether code
works or a release reached users. Doctor also reports relationship findings;
those findings do not all produce a failing exit code. Record the actual evidence in the change and PR.
The CLI version is pinned; its transitive dependencies are not lockfile-pinned.

To disable OpenSpec usage telemetry on a new machine:

```sh
openspec config set telemetry.enabled false
```
