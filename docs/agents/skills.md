# Evaluated agent skills

Yify's portable [product-audit skill](../../.agents/skills/yify-product-audit/SKILL.md) covers gaps in existing journeys without adding features. It includes scope boundaries, recovery and stale-state checks, designer/QA/reviewer involvement, and honest platform evidence. Use it for audits, not every small fix. Its synthetic [evaluation cases](../../.agents/skills/yify-product-audit/evals/evals.json) are independent of application tests; the narrow fixture intentionally starts with a failing test.

## Anthropic creator

The user-local `anthropic-skill-creator` comes from [Anthropic's official skill](https://github.com/anthropics/claude-plugins-official/tree/b8e53f1c05dff3b6d751297f6527990ffc81c2f4/plugins/skill-creator/skills/skill-creator), pinned at `b8e53f1c05dff3b6d751297f6527990ffc81c2f4`, licensed Apache-2.0. The full upstream package and license remain installed together. The distinct directory **and frontmatter name** preserve the host's built-in `skill-creator`.

On a Codex machine with the bundled installer:

```sh
python3 "${CODEX_HOME:-$HOME/.codex}/skills/.system/skill-installer/scripts/install-skill-from-github.py" \
  --repo anthropics/claude-plugins-official \
  --path plugins/skill-creator/skills/skill-creator \
  --ref b8e53f1c05dff3b6d751297f6527990ffc81c2f4 \
  --name anthropic-skill-creator
```

Before using the installed copy, change its `SKILL.md` frontmatter name to `anthropic-skill-creator`; `--name` changes only the installation directory. Preserve `LICENSE.txt`, record the source revision and any local adaptations, and apply the compatibility rules below. The existing installation also has `ORIGIN.json` with upstream hashes, a Codex compatibility section, and `agents/openai.yaml` with the matching invocation. These local files are not automatically available on other machines. Existing installations should be inspected before replacement. New skills become available to Codex on the next turn.

## Codex compatibility

- Use native subagents and the repository's model/effort preferences and concurrency limits. Keep baseline agents unaware of the candidate skill and grading assertions. Record requested configuration separately from independently verified runtime configuration.
- `run_eval.py`, `improve_description.py` and `run_loop.py` use an authenticated Claude CLI. They do not measure Codex skill selection. Do not provision credentials, incur provider charges or run them implicitly. Description optimization is optional and runtime-specific.
- Use `eval-viewer/generate_review.py --static PATH` for review. Server mode can terminate a process occupying its port. Generated HTML includes external Google Fonts and SheetJS references; remove those tags from the generated copy or block network requests before calling it offline. Markdown-only reports do not need SheetJS.
- Upstream aggregation defaults missing timing and token counts to zero and may substitute character counts for tokens. Remove unavailable runtime, token, tool-call and error metrics from the generated report. Correct its default run count to the actual count. Never invent measurements or user feedback.
- Treat fixture execution as a smoke comparison. It does not prove general effectiveness, automatic activation, production correctness or native rendering. Keep baseline and candidate prompts, models and tools equivalent except for access to the skill.

## Repeat the evaluation

Copy each case's supplied files to separate temporary run directories. Give a fresh agent the case prompt and those files; give only the `with_skill` agent the candidate skill. Do not give either executor `expectations`, previous outputs or other runs. For the narrow case, agents edit copies, not the committed intentionally broken fixture. Keep external services and credentials out of the exercise. These instructions are scope controls, not a technical sandbox.

Use this layout for upstream aggregation:

```text
iteration-1/eval-1-name/eval_metadata.json
iteration-1/eval-1-name/with_skill/run-1/eval_metadata.json
iteration-1/eval-1-name/with_skill/run-1/outputs/
iteration-1/eval-1-name/with_skill/run-1/grading.json
iteration-1/eval-1-name/without_skill/run-1/...
```

The evaluation metadata includes `eval_id`, `eval_name`, `prompt` and `assertions`. Copy it into each run directory for the viewer, but deny executors access. Have an independent grader use upstream `agents/grader.md` and the saved outputs, with `expectations` entries containing `text`, `passed`, `evidence`, plus a numerical `summary`. Store actual command output as evidence and state when only a self-reported execution log is available.

```sh
python3 /path/to/anthropic-skill-creator/scripts/aggregate_benchmark.py \
  /path/to/iteration-1 --skill-name yify-product-audit \
  --skill-path /path/to/yify/.agents/skills/yify-product-audit
```

Apply the metric corrections above to `benchmark.json` and `benchmark.md`, then:

```sh
python3 /path/to/anthropic-skill-creator/eval-viewer/generate_review.py \
  /path/to/iteration-1 --skill-name yify-product-audit \
  --benchmark /path/to/iteration-1/benchmark.json \
  --static /path/to/review.html
```

Review actual outputs as well as pass counts. Record failures and coverage limits, improve the skill when the evidence justifies it, and rerun affected cases. Human feedback is separate from automated grading; no feedback means it is still pending.
