# Team implementation state

The portable team policy was prepared in an isolated checkout against baseline `3c91ecbca833aa5230d6fe11bdc41c2e88da5480`. This state file is a sanitized handoff, not a claim that the team has been activated in a managed runtime.

The intended source of truth is `config/agent-team.json`, `docs/agents/team.md`, and the twelve role briefs. `AGENTS.md` points agents to those files and to the pre-existing `CLAUDE.md`. The repository's `.codex/config.toml` and its WebStorm MCP setting are outside this change.

The mechanism is explicit native delegation with a bounded assignment. Whether the executing runtime loads any project role file, supports preferred models, or exposes effective model selection must be checked in that runtime. A role brief does not grant or revoke tools, account permissions, or credentials.

Current handoff: obtain independent exact-commit review after the change is committed, then perform live role/delegation probes only in an authorized execution context. Record actual evidence in `docs/agents/verification.md` before claiming those probes passed. No merge, production release, paid-service change, new schedule, or campaign is authorized by this state file.
