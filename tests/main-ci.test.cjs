const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const helpers = import('../scripts/main-ci.mjs');

const REPOSITORY = 'kunal26das/yify';
const REPOSITORY_ID = 283553926;
const MAIN = 'a'.repeat(40);
const NEXT = 'b'.repeat(40);
const HEAD = 'c'.repeat(40);
const names = ['Verify dependency automation context', 'Typecheck and tests',
  'Web exports render and isolate catalog data', 'Typecheck and test release console'];

function fixture() {
  const repo = { id: REPOSITORY_ID, full_name: REPOSITORY };
  const env = { GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/heads/main', GITHUB_SHA: MAIN,
    GITHUB_EVENT_NAME: 'workflow_run', SOURCE_RUN_ID: '123', SOURCE_RUN_ATTEMPT: '2',
    PR_NUMBER: '950', PR_HEAD_SHA: HEAD };
  const run = { id: 123, workflow_id: 12, path: '.github/workflows/ci.yml', run_attempt: 2,
    event: 'push', head_branch: 'main', head_sha: MAIN, repository: { ...repo }, head_repository: { ...repo },
    status: 'completed', conclusion: 'success' };
  const state = { env, run, latest: structuredClone(run), workflow: { id: 12, path: '.github/workflows/ci.yml' },
    jobs: names.map((name) => ({ name, status: 'completed', conclusion: 'success' })),
    branch: { ref: 'refs/heads/main', object: { type: 'commit', sha: MAIN } },
    pr: { number: 950, state: 'closed', merged: true, draft: false, user: { login: 'dependabot[bot]' },
      merged_by: { login: 'github-actions[bot]' }, merge_commit_sha: MAIN,
      head: { sha: HEAD, ref: 'dependabot/npm_and_yarn/release/react', repo: { ...repo } },
      base: { ref: 'main', repo: { ...repo } } }, calls: [], writes: [] };
  state.api = async (method, path, body) => {
    state.calls.push({ method, path, body });
    if (state.beforeApi) await state.beforeApi(method, path, body);
    if (method === 'POST') {
      assert.equal(path, `repos/${REPOSITORY}/actions/workflows/ci.yml/dispatches`);
      state.writes.push({ path, body });
      if (state.dispatchError) throw new Error('Dispatch rejected');
      return null;
    }
    assert.equal(method, 'GET');
    if (path === `repos/${REPOSITORY}/pulls/950`) return structuredClone(state.pr);
    if (path === `repos/${REPOSITORY}/git/ref/heads/main`) return structuredClone(state.branch);
    if (path === `repos/${REPOSITORY}/actions/runs/123`) return structuredClone(state.latest);
    if (path === `repos/${REPOSITORY}/actions/runs/123/attempts/2`) return structuredClone(state.run);
    if (path === `repos/${REPOSITORY}/actions/workflows/ci.yml`) return structuredClone(state.workflow);
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/123/attempts/2/jobs?`)) {
      const page = Number(new URL(`https://api.github.com/${path}`).searchParams.get('page'));
      return { jobs: structuredClone(state.jobPages ? state.jobPages[page - 1] || [] : state.jobs) };
    }
    throw new Error(`Unexpected API request: ${method} ${path}`);
  };
  return state;
}

for (const event of ['push', 'workflow_dispatch']) test(`accepts current main CI from ${event} with all required checks`, async () => {
  const state = fixture();
  state.latest.event = event; state.run.event = event;
  assert.deepEqual(await (await helpers).verifyMainCI(state),
    { ready: true, head: MAIN, repositoryId: REPOSITORY_ID, workflowId: 12 });
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['another repository', (s) => { s.env.GITHUB_REPOSITORY = 'other/yify'; }],
  ['untrusted checkout branch', (s) => { s.env.GITHUB_REF = 'refs/heads/test'; }],
  ['invalid checkout SHA', (s) => { s.env.GITHUB_SHA = 'main'; }],
  ['manual caller', (s) => { s.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; }],
  ['missing source attempt', (s) => { delete s.env.SOURCE_RUN_ATTEMPT; }],
  ['invalid source run', (s) => { s.env.SOURCE_RUN_ID = '123/../456'; }],
  ['mismatched run ID', (s) => { s.run.id = 124; }],
  ['newer latest attempt', (s) => { s.latest.run_attempt += 1; }],
  ['another source attempt', (s) => { s.run.run_attempt = 1; }],
  ['another workflow', (s) => { s.run.workflow_id += 1; }],
  ['invalid workflow ID', (s) => { s.workflow.id = 0; }],
  ['another workflow path', (s) => { s.workflow.path = '.github/workflows/other.yml'; }],
  ['another run path', (s) => { s.run.path = '.github/workflows/other.yml'; }],
  ['pull request masquerading as main', (s) => { s.run.event = 'pull_request'; }],
  ['inconsistent source events', (s) => { s.latest.event = 'workflow_dispatch'; }],
  ['another source branch', (s) => { s.run.head_branch = 'dependabot/test'; }],
  ['failed source', (s) => { s.run.conclusion = 'failure'; }],
  ['running latest attempt', (s) => { s.latest.status = 'in_progress'; }],
  ['fork source', (s) => { s.run.head_repository.full_name = 'other/yify'; }],
  ['different repository ID', (s) => { s.run.repository.id += 1; }],
  ['missing repository ID', (s) => { delete s.run.repository.id; }],
  ['inconsistent run head', (s) => { s.latest.head_sha = NEXT; }],
  ['malformed run head', (s) => { s.run.head_sha = 'main'; }],
  ['failed required check', (s) => { s.jobs[1].conclusion = 'failure'; }],
  ['unfinished required check', (s) => { s.jobs[1].status = 'in_progress'; }],
  ['missing required check', (s) => { s.jobs.pop(); }],
  ['duplicate required check', (s) => { s.jobs.push(s.jobs[1]); }],
  ['skipped dependency context', (s) => { s.jobs[0].conclusion = 'skipped'; }],
  ['missing dependency context', (s) => { s.jobs.shift(); }],
  ['invalid current branch', (s) => { s.branch.ref = 'refs/heads/other'; }],
  ['non-commit branch object', (s) => { s.branch.object.type = 'tag'; }],
]) test(`rejects ${label} without dispatching`, async () => {
  const state = fixture(); mutate(state);
  await assert.rejects(async () => (await helpers).verifyMainCI(state));
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['main advanced', (s) => { s.branch.object.sha = NEXT; }],
  ['event checkout advanced', (s) => { s.env.GITHUB_SHA = NEXT; }],
]) test(`skips obsolete CI when ${label}`, async () => {
  const state = fixture(); mutate(state);
  const result = await (await helpers).verifyMainCI(state);
  assert.equal(result.ready, false);
  assert.equal(result.head, MAIN);
  assert.match(result.reason, /superseded/);
  assert.equal(state.writes.length, 0);
});

test('stale CI still rejects an invalid source identity', async () => {
  const state = fixture(); state.branch.object.sha = NEXT; state.run.head_repository.id += 1;
  await assert.rejects(async () => (await helpers).verifyMainCI(state));
});

test('checks every jobs page and rejects duplicate checks on later pages', async () => {
  const state = fixture();
  state.jobPages = [Array.from({ length: 100 }, (_, index) => ({ name: `other-${index}` })), state.jobs];
  assert.equal((await (await helpers).verifyMainCI(state)).ready, true);
  state.jobPages[0][0] = state.jobs[0];
  await assert.rejects(async () => (await helpers).verifyMainCI(state), /required check/);
});

test('bounds jobs pagination before accepting checks', async () => {
  const state = fixture();
  state.jobPages = Array.from({ length: 20 }, () => Array.from({ length: 100 }, () => ({ name: 'other' })));
  await assert.rejects(async () => (await helpers).verifyMainCI(state), /supported size/);
  assert.equal(state.calls.filter(({ path }) => path.includes('/jobs?')).length, 20);
});

test('rejects a CI attempt rerun while its job evidence is being read', async () => {
  const state = fixture();
  state.beforeApi = (_method, path) => { if (path.includes('/jobs?')) state.latest.run_attempt += 1; };
  await assert.rejects(async () => (await helpers).verifyMainCI(state), /latest successful CI attempt/);
});

test('dispatches normal main CI only after verifying a current bot-merged PR', async () => {
  const state = fixture();
  assert.deepEqual(await (await helpers).dispatchMergedMainCI(state), { dispatched: true, head: MAIN, pr: 950 });
  assert.deepEqual(state.writes, [{ path: `repos/${REPOSITORY}/actions/workflows/ci.yml/dispatches`, body: { ref: 'main' } }]);
});

test('superseded automated merges do not dispatch stale main CI', async () => {
  const state = fixture(); state.branch.object.sha = NEXT;
  assert.equal((await (await helpers).dispatchMergedMainCI(state)).dispatched, false);
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['untrusted execution branch', (s) => { s.env.GITHUB_REF = 'refs/heads/other'; }],
  ['pull-request execution', (s) => { s.env.GITHUB_EVENT_NAME = 'pull_request'; }],
  ['missing tested head', (s) => { delete s.env.PR_HEAD_SHA; }],
  ['another PR number', (s) => { s.pr.number += 1; }],
  ['open PR', (s) => { s.pr.state = 'open'; }],
  ['unmerged PR', (s) => { s.pr.merged = false; }],
  ['draft PR', (s) => { s.pr.draft = true; }],
  ['human-authored PR', (s) => { s.pr.user.login = 'kunal26das'; }],
  ['human merge', (s) => { s.pr.merged_by.login = 'kunal26das'; }],
  ['different tested head', (s) => { s.pr.head.sha = NEXT; }],
  ['non-Dependabot branch', (s) => { s.pr.head.ref = 'fix/test'; }],
  ['fork PR', (s) => { s.pr.head.repo.full_name = 'other/yify'; }],
  ['another target branch', (s) => { s.pr.base.ref = 'other'; }],
  ['mismatched repository IDs', (s) => { s.pr.head.repo.id += 1; }],
  ['missing repository ID', (s) => { delete s.pr.base.repo.id; }],
  ['invalid merge SHA', (s) => { s.pr.merge_commit_sha = 'main'; }],
]) test(`rejects dispatch for ${label}`, async () => {
  const state = fixture(); mutate(state);
  await assert.rejects(async () => (await helpers).dispatchMergedMainCI(state));
  assert.equal(state.writes.length, 0);
});

test('a rejected dispatch is not reported as successful', async () => {
  const state = fixture(); state.dispatchError = true;
  await assert.rejects(async () => (await helpers).dispatchMergedMainCI(state), /Dispatch rejected/);
});

test('GitHub dispatch accepts an empty HTTP 204 response', async () => {
  const { githubApi } = await import('../scripts/dependabot-lockfile.mjs');
  const api = githubApi('fixture-token', async (_url, options) => {
    assert.equal(options.method, 'POST');
    assert.deepEqual(JSON.parse(options.body), { ref: 'main' });
    return { ok: true, status: 204, json() { assert.fail('HTTP 204 has no JSON body.'); } };
  });
  assert.equal(await api('POST', `repos/${REPOSITORY}/actions/workflows/ci.yml/dispatches`, { ref: 'main' }), null);
});

test('production promotion requires main to remain on the exported SHA', async () => {
  const state = fixture(); state.env.CHECK_CURRENT_MAIN = 'true';
  assert.deepEqual(await (await helpers).checkCurrentMain(state), { ready: true, head: MAIN });
  state.branch.object.sha = NEXT;
  await assert.rejects(async () => (await helpers).checkCurrentMain(state), /refusing to publish/);
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['a rerun starts', (s) => { s.latest.run_attempt += 1; s.latest.status = 'in_progress'; s.latest.conclusion = null; }],
  ['the source run fails', (s) => { s.latest.conclusion = 'failure'; }],
  ['the required context no longer succeeds', (s) => { s.jobs[0].conclusion = 'failure'; }],
]) test(`queued automatic production rechecks CI before promotion when ${label}`, async () => {
  const state = fixture(); state.env.CHECK_CURRENT_MAIN = 'true';
  assert.equal((await (await helpers).verifyMainCI(state)).ready, true);
  mutate(state);
  await assert.rejects(async () => (await helpers).checkCurrentMain(state));
  assert.equal(state.branch.object.sha, MAIN);
  assert.equal(state.writes.length, 0);
});

test('manual production checks current main without requiring a CI source run', async () => {
  const state = fixture(); state.env.CHECK_CURRENT_MAIN = 'true'; state.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  delete state.env.SOURCE_RUN_ID; delete state.env.SOURCE_RUN_ATTEMPT;
  assert.deepEqual(await (await helpers).checkCurrentMain(state), { ready: true, head: MAIN });
  assert.deepEqual(state.calls.map(({ path }) => path), [`repos/${REPOSITORY}/git/ref/heads/main`]);
});

test('manual previews do not require the branch to be current main', async () => {
  const state = fixture(); state.env.GITHUB_REF = 'refs/heads/preview'; state.env.CHECK_CURRENT_MAIN = 'false';
  assert.deepEqual(await (await helpers).checkCurrentMain(state), { ready: true, head: MAIN });
  assert.equal(state.calls.length, 0);
});

test('preview CLI does not require API credentials', async () => {
  const state = fixture(); state.env.CHECK_CURRENT_MAIN = 'false'; state.env.GITHUB_REF = 'refs/heads/preview';
  assert.deepEqual(await (await helpers).main(state.env, 'current'), { ready: true, head: MAIN });
});

test('CLI emits verified outputs and a usable status summary', async (t) => {
  const state = fixture();
  const directory = await mkdtemp(join(tmpdir(), 'main-ci-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  state.env.GITHUB_OUTPUT = join(directory, 'output'); state.env.GITHUB_STEP_SUMMARY = join(directory, 'summary');
  await (await helpers).main(state.env, 'validate', state.api);
  assert.match(await readFile(state.env.GITHUB_OUTPUT, 'utf8'), /ready=true\n/);
  assert.match(await readFile(state.env.GITHUB_OUTPUT, 'utf8'), new RegExp(`head=${MAIN}\\n`));
  assert.match(await readFile(state.env.GITHUB_STEP_SUMMARY, 'utf8'), /Verified successful CI/);
});

test('CLI does not emit success output when dispatch fails', async (t) => {
  const state = fixture(); state.dispatchError = true;
  const directory = await mkdtemp(join(tmpdir(), 'main-ci-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  state.env.GITHUB_OUTPUT = join(directory, 'output');
  await assert.rejects(async () => (await helpers).main(state.env, 'dispatch', state.api), /Dispatch rejected/);
  await assert.rejects(() => readFile(state.env.GITHUB_OUTPUT), { code: 'ENOENT' });
});
