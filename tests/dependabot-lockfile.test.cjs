const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const helpers = import('../scripts/dependabot-lockfile.mjs');

const SOURCE = 'a'.repeat(40);
const REFRESHED = 'b'.repeat(40);
const REPOSITORY = 'kunal26das/yify';
const REPOSITORY_ID = 283553926;
const FOLLOWUP_ID = 789;
const ORIGINAL = Buffer.from('# yarn lockfile v1\noriginal:\n  version "1.0.0"\n');
const REGENERATED = Buffer.from('# yarn lockfile v1\noriginal:\n  version "1.0.1"\n');
const names = ['Typecheck and tests', 'Web exports render and isolate catalog data', 'Typecheck and test release console'];

async function fixture(options = {}) {
  const { digest, commitMessage } = await helpers;
  const scope = options.scope || 'root';
  const lockfile = scope === 'root' ? 'yarn.lock' : 'release/yarn.lock';
  const manifest = scope === 'root' ? 'package.json' : 'release/package.json';
  const env = { GITHUB_REPOSITORY: REPOSITORY, PR_NUMBER: '123', PR_HEAD_SHA: SOURCE, GITHUB_SHA: SOURCE,
    GITHUB_EVENT_NAME: 'pull_request', GITHUB_RUN_ID: '456', GITHUB_RUN_ATTEMPT: '1', DEPENDENCY_SCOPE: scope };
  const metadata = { version: 2, scope, lockfile, repository: REPOSITORY, pr: 123, source: SOURCE, run_id: '456', run_attempt: '1', lockfile_sha256: digest(REGENERATED) };
  const originalCommit = { sha: SOURCE, author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true }, tree: { sha: 'e'.repeat(40) }, message: 'Bump package' },
    parents: [{ sha: 'c'.repeat(40) }], files: [{ filename: manifest, status: 'modified' }, { filename: lockfile, status: 'modified' }] };
  const refreshedCommit = { sha: REFRESHED, author: { login: 'github-actions[bot]' }, committer: { login: 'web-flow' },
    commit: { verification: { verified: true }, tree: { sha: 'f'.repeat(40) }, message: commitMessage(metadata) }, parents: [{ sha: SOURCE }], files: [{ filename: lockfile, status: 'modified' }] };
  const pr = { number: 123, state: 'open', merged: false, draft: false, user: { login: 'dependabot[bot]' },
    head: { sha: SOURCE, ref: 'dependabot/npm_and_yarn/patch-updates-abcd', repo: { id: REPOSITORY_ID, full_name: REPOSITORY } },
    base: { ref: 'main', repo: { id: REPOSITORY_ID, full_name: REPOSITORY } }, commits: 1 };
  const run = { id: 456, workflow_id: 12, path: '.github/workflows/ci.yml', head_sha: SOURCE, head_branch: pr.head.ref, repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY }, event: 'pull_request', run_attempt: 1, status: 'completed', actor: { login: 'dependabot[bot]' }, pull_requests: [{ number: 123, head: structuredClone(pr.head), base: structuredClone(pr.base) }] };
  const jobs = [...names, `Dependabot clean reinstall (${scope})`].map((name) => ({ name, status: 'completed', conclusion: 'success' }));
  const followupRun = { id: FOLLOWUP_ID, workflow_id: 12, path: '.github/workflows/ci.yml', event: 'pull_request',
    head_sha: REFRESHED, head_branch: pr.head.ref, repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY },
    actor: { login: 'github-actions[bot]' }, status: 'completed', conclusion: 'action_required',
    pull_requests: [{ number: 123, head: { sha: REFRESHED, ref: pr.head.ref, repo: { id: REPOSITORY_ID } },
      base: { ref: 'main', repo: { id: REPOSITORY_ID } } }] };
  const writes = [];
  const state = { env, metadata, pr, originalCommit, refreshedCommit, run, followupRun, jobs, writes, regenerate: REGENERATED,
    original: ORIGINAL, approvalFailure: false, concurrentCommit: false, lockMode: '100644', directoryMode: '040000', extraCommits: [] };
  state.refresh = () => { pr.commits = 2; pr.head.sha = REFRESHED; };
  if (options.refreshed) { state.refresh(); env.PR_HEAD_SHA = REFRESHED; env.GITHUB_SHA = REFRESHED; }
  state.api = async (method, path, body) => {
    if (method === 'POST') {
      writes.push({ path, body });
      if (path === 'graphql') {
        if (state.concurrentCommit) throw new Error('expectedHeadOid does not match');
        assert.equal(body.variables.input.expectedHeadOid, SOURCE);
        const input = body.variables.input;
        state.regenerate = Buffer.from(input.fileChanges.additions[0].contents, 'base64');
        refreshedCommit.commit.message = `${input.message.headline}\n\n${input.message.body}`;
        state.refresh();
        return { data: { createCommitOnBranch: { commit: { oid: REFRESHED } } } };
      }
      assert.fail('The commit token must not approve runs or dispatch workflows.');
    }
    if (path === `repos/${REPOSITORY}/pulls/123`) return structuredClone(pr);
    if (path.startsWith(`repos/${REPOSITORY}/pulls/123/commits?`)) return structuredClone(pr.commits === 1 ? [originalCommit] : [originalCommit, refreshedCommit, ...state.extraCommits]);
    if (path === `repos/${REPOSITORY}/commits/${SOURCE}?per_page=100`) return structuredClone(originalCommit);
    if (path === `repos/${REPOSITORY}/commits/${REFRESHED}?per_page=100`) return structuredClone(refreshedCommit);
    if (path.startsWith(`repos/${REPOSITORY}/git/trees/`)) return { truncated: false, tree: [
      { path: 'yarn.lock', type: 'blob', mode: state.lockMode },
      ...(path.endsWith('9'.repeat(40)) ? [] : [{ path: 'release', type: 'tree', mode: state.directoryMode, sha: '9'.repeat(40) }]),
    ] };
    if (path.startsWith(`repos/${REPOSITORY}/contents/${lockfile}?ref=`)) {
      const bytes = path.endsWith(SOURCE) ? state.original : state.regenerate;
      return { type: 'file', encoding: 'base64', content: bytes.toString('base64') };
    }
    if (path === `repos/${REPOSITORY}/actions/workflows/ci.yml`) return { id: 12, path: '.github/workflows/ci.yml' };
    if (path === `repos/${REPOSITORY}/actions/workflows/12/runs?event=pull_request&head_sha=${REFRESHED}&per_page=100`) {
      return { total_count: 1, workflow_runs: [structuredClone(followupRun)] };
    }
    if (path === `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}`) return structuredClone(followupRun);
    if (path === `repos/${REPOSITORY}/actions/runs/456`) return structuredClone(run);
    if (path === `repos/${REPOSITORY}/actions/runs/456/attempts/1`) return structuredClone(run);
    if (path === `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/attempts/1`) return { ...structuredClone(followupRun), run_attempt: 1 };
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/attempts/1/jobs?`)) return { jobs: structuredClone(jobs.slice(0, 3)) };
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/456/artifacts?`)) return { artifacts: [{ name: `dependabot-clean-install-${scope}-456-1`, expired: false, workflow_run: { id: 456, head_sha: SOURCE, head_branch: pr.head.ref, repository_id: REPOSITORY_ID, head_repository_id: REPOSITORY_ID } }] };
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/456/attempts/1/jobs?`)) return { jobs: structuredClone(jobs) };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  };
  state.approvalApi = async (method, path, body) => {
    assert.equal(method, 'POST');
    assert.equal(path, `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
    assert.equal(body, undefined);
    writes.push({ path, credential: 'approval-app' });
    if (state.approvalFailure) throw new Error('Approval temporarily unavailable');
    followupRun.status = 'queued'; followupRun.conclusion = null;
    return null;
  };
  return state;
}

async function artifact(t, state, options = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'dependabot-lockfile-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await writeFile(join(dir, 'original-yarn.lock'), options.original || ORIGINAL);
  await writeFile(join(dir, 'regenerated-yarn.lock'), options.regenerated || REGENERATED);
  await writeFile(join(dir, 'metadata.json'), JSON.stringify(options.metadata || state.metadata));
  return dir;
}

async function rejectsInspection(state, expression) {
  const { inspect } = await helpers;
  await assert.rejects(() => inspect(state), expression);
  assert.equal(state.writes.length, 0);
}

test('accepts one signed Dependabot commit without writing repository state', async () => {
  const { inspect } = await helpers;
  const state = await fixture();
  const result = await inspect(state);
  assert.equal(result.source, SOURCE);
  assert.equal(result.refreshed, false);
  assert.equal(result.head, SOURCE);
  assert.equal(result.eligible, true);
  assert.equal(result.automerge, false);
  assert.equal(result.scope, 'root');
  assert.equal(result.lockfile, 'yarn.lock');
  assert.equal(state.writes.length, 0);
});

test('accepts a signed lock-only refresh with successful source CI and matching digest', async () => {
  const { inspect } = await helpers;
  const result = await inspect(await fixture({ refreshed: true }));
  assert.equal(result.head, REFRESHED);
  assert.equal(result.source, SOURCE);
  assert.equal(result.refreshed, true);
  assert.equal(result.automerge, false);
});

for (const [label, mutate] of [
  ['another author', (s) => { s.pr.user.login = 'someone'; }],
  ['a fork', (s) => { s.pr.head.repo.full_name = 'someone/yify'; }],
  ['another base', (s) => { s.pr.base.ref = 'dev'; }],
  ['a draft', (s) => { s.pr.draft = true; }],
  ['a closed PR', (s) => { s.pr.state = 'closed'; }],
  ['a third commit', (s) => { s.pr.commits = 3; }],
  ['an unsigned source', (s) => { s.originalCommit.commit.verification.verified = false; }],
  ['a merged source ancestry', (s) => { s.originalCommit.parents.push({ sha: 'd'.repeat(40) }); }],
  ['an executable lockfile', (s) => { s.lockMode = '100755'; }],
  ['a symlink lockfile', (s) => { s.lockMode = '120000'; }],
  ['source code changes', (s) => { s.originalCommit.files.push({ filename: '.github/workflows/ci.yml', status: 'modified' }); }],
  ['a stale expected head', (s) => { s.env.PR_HEAD_SHA = 'd'.repeat(40); }],
]) test(`rejects ${label}`, async () => {
  const state = await fixture(); mutate(state); await rejectsInspection(state);
});

for (const [label, mutate] of [
  ['unsigned refresh', (s) => { s.refreshedCommit.commit.verification.verified = false; }],
  ['a forged refresh author', (s) => { s.refreshedCommit.author.login = 'someone'; }],
  ['a non-web commit signature', (s) => { s.refreshedCommit.committer.login = 'someone'; }],
  ['source changes inside refresh', (s) => { s.refreshedCommit.files.push({ filename: 'package.json', status: 'modified' }); }],
  ['wrong parent', (s) => { s.refreshedCommit.parents[0].sha = 'd'.repeat(40); }],
  ['a merge commit', (s) => { s.refreshedCommit.parents.push({ sha: 'd'.repeat(40) }); }],
  ['a missing deterministic marker', (s) => { s.refreshedCommit.commit.message = s.refreshedCommit.commit.message.replace('[dependabot skip]', '[skip ci]'); }],
  ['modified lock content', (s) => { s.regenerate = Buffer.from('tampered'); }],
  ['wrong source run SHA', (s) => { s.run.head_sha = 'd'.repeat(40); }],
  ['another workflow', (s) => { s.run.workflow_id = 99; }],
  ['a failed source clean install', (s) => { s.jobs[3].conclusion = 'failure'; }],
  ['missing source checks', (s) => { s.jobs.pop(); }],
]) test(`rejects refresh with ${label}`, async () => {
  const state = await fixture({ refreshed: true }); mutate(state); await rejectsInspection(state);
});

test('dispatch requires execution on the exact tested PR head', async () => {
  const state = await fixture({ refreshed: true });
  state.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; state.env.GITHUB_SHA = SOURCE;
  await rejectsInspection(state, /dispatched workflow/);
});

test('merged PR inspection is opt-in and limited to the Actions merger', async () => {
  const { inspect } = await helpers;
  const state = await fixture({ refreshed: true });
  state.pr.state = 'closed'; state.pr.merged = true; state.pr.merged_by = { login: 'github-actions[bot]' };
  await rejectsInspection(state);
  state.env.ALLOW_MERGED = 'true';
  assert.equal((await inspect(state)).refreshed, true);
  state.pr.merged_by.login = 'someone'; await rejectsInspection(state);
});

test('publish commits only tested yarn.lock with CAS and approves pull-request checks on the new head', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const result = await publish({ ...state, directory });
  assert.deepEqual(result, { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.equal(state.writes.length, 2);
  const input = state.writes[0].body.variables.input;
  assert.equal(input.expectedHeadOid, SOURCE);
  assert.deepEqual(input.fileChanges, { additions: [{ path: 'yarn.lock', contents: REGENERATED.toString('base64') }] });
  assert.match(input.message.headline, /\[dependabot skip\]/);
  assert.equal(state.writes[1].path, `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
  assert.equal(state.writes[1].credential, 'approval-app');
});

test('publish leaves matching lockfiles unchanged and does not approve redundant CI', async (t) => {
  const { publish, digest } = await helpers;
  const state = await fixture();
  state.metadata.lockfile_sha256 = digest(ORIGINAL);
  const directory = await artifact(t, state, { regenerated: ORIGINAL });
  assert.deepEqual(await publish({ ...state, directory }), { changed: false, new_sha: SOURCE });
  assert.equal(state.writes.length, 0);
});

test('publish retries a failed approval without creating another commit, including failed-only reruns', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  state.approvalFailure = true;
  await assert.rejects(() => publish({ ...state, directory }), /Approval temporarily unavailable/);
  state.approvalFailure = false;
  state.env.GITHUB_RUN_ATTEMPT = '2'; state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/approve')).length, 2);
});

for (const scope of ['root', 'release']) test(`${scope} publication waits for the exact new head after GitHub returns the old head`, async (t) => {
  const { publish } = await helpers;
  const state = await fixture({ scope });
  const directory = await artifact(t, state);
  const oldPr = structuredClone(state.pr);
  const waits = [];
  let readsAfterCommit = 0;
  const api = async (method, path, body) => {
    if (method === 'GET' && path === `repos/${REPOSITORY}/pulls/123` && state.writes.some((write) => write.path === 'graphql')) {
      readsAfterCommit += 1;
      if (readsAfterCommit < 3) return structuredClone(oldPr);
    }
    return state.api(method, path, body);
  };
  const approvalApi = (...args) => {
    assert.equal(readsAfterCommit, 5);
    return state.approvalApi(...args);
  };
  assert.deepEqual(await publish({ ...state, api, approvalApi, directory, wait: async (ms) => waits.push(ms) }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/approve')).length, 1);
  assert.equal(state.writes.at(-1).path, `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
});

test('head propagation timeout is bounded and a rerun recovers without another commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const oldPr = structuredClone(state.pr);
  const waits = [];
  let readsAfterCommit = 0;
  const api = async (method, path, body) => {
    if (method === 'GET' && path === `repos/${REPOSITORY}/pulls/123` && state.writes.some((write) => write.path === 'graphql')) {
      readsAfterCommit += 1;
      return structuredClone(oldPr);
    }
    return state.api(method, path, body);
  };
  await assert.rejects(() => publish({ ...state, api, directory, wait: async (ms) => waits.push(ms) }), /Rerun this failed job/);
  assert.equal(readsAfterCommit, 6);
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 15000]);
  assert.equal(state.writes.length, 1);
  state.env.GITHUB_RUN_ATTEMPT = '2'; state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/approve')).length, 1);
});

for (const [label, mutate] of [
  ['an unrelated head', (pr) => { pr.head.sha = 'd'.repeat(40); }],
  ['a missing head', (pr) => { delete pr.head.sha; }],
  ['a closed pull request', (pr) => { pr.state = 'closed'; }],
  ['a merged pull request', (pr) => { pr.merged = true; }],
  ['a draft pull request', (pr) => { pr.draft = true; }],
  ['another author', (pr) => { pr.user.login = 'someone'; }],
  ['another branch', (pr) => { pr.head.ref = 'dependabot/another'; }],
  ['a fork', (pr) => { pr.head.repo.full_name = 'someone/yify'; }],
  ['another base branch', (pr) => { pr.base.ref = 'dev'; }],
  ['another base repository', (pr) => { pr.base.repo.full_name = 'someone/yify'; }],
  ['another pull request', (pr) => { pr.number = 999; }],
]) test(`head propagation immediately rejects ${label} without approval`, async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const oldPr = structuredClone(state.pr);
  const waits = [];
  let readsAfterCommit = 0;
  const api = async (method, path, body) => {
    if (method === 'GET' && path === `repos/${REPOSITORY}/pulls/123` && state.writes.some((write) => write.path === 'graphql')) {
      readsAfterCommit += 1;
      if (readsAfterCommit === 1) return structuredClone(oldPr);
      const changed = structuredClone(state.pr);
      mutate(changed);
      return changed;
    }
    return state.api(method, path, body);
  };
  await assert.rejects(() => publish({ ...state, api, directory, wait: async (ms) => waits.push(ms) }), /Pull request changed/);
  assert.equal(readsAfterCommit, 2);
  assert.deepEqual(waits, [1000]);
  assert.equal(state.writes.length, 1);
});

test('a previously published head moving back to its source does not receive a propagation retry', async (t) => {
  const { publish } = await helpers;
  const state = await fixture({ refreshed: true });
  state.env.PR_HEAD_SHA = SOURCE;
  const directory = await artifact(t, state);
  let reads = 0;
  const api = async (method, path, body) => {
    const response = await state.api(method, path, body);
    if (method === 'GET' && path === `repos/${REPOSITORY}/pulls/123` && ++reads > 1) response.head.sha = SOURCE;
    return response;
  };
  await assert.rejects(() => publish({ ...state, api, directory, wait: async () => assert.fail('Must not retry a reverted published head.') }), /Pull request changed/);
  assert.equal(reads, 2);
  assert.equal(state.writes.length, 0);
});

test('head propagation does not retry GitHub request failures or repeat the commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const api = async (method, path, body) => {
    if (method === 'GET' && path === `repos/${REPOSITORY}/pulls/123` && state.writes.some((write) => write.path === 'graphql')) {
      throw new Error('GitHub request unavailable');
    }
    return state.api(method, path, body);
  };
  await assert.rejects(() => publish({ ...state, api, directory, wait: async () => assert.fail('Must not retry an API failure.') }), /GitHub request unavailable/);
  assert.equal(state.writes.length, 1);
});

test('missing or reused approval credentials fail before a lockfile commit', async (t) => {
  const { publish, main } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  await assert.rejects(() => publish({ ...state, approvalApi: undefined, directory }), /separate GitHub App/);
  for (const token of [undefined, 'built-in-token']) {
    await assert.rejects(() => main('publish', { ...state.env, GH_TOKEN: 'built-in-token', DEPENDABOT_APPROVAL_TOKEN: token }), /separate GitHub App/);
  }
  assert.equal(state.writes.length, 0);
});

test('follow-up discovery waits for the actual pull-request run without another commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const waits = [];
  let discoveries = 0;
  const api = async (method, path, body) => {
    if (path.includes('/runs?event=pull_request') && ++discoveries < 3) return { total_count: 0, workflow_runs: [] };
    return state.api(method, path, body);
  };
  assert.equal((await publish({ ...state, api, directory, wait: async (ms) => waits.push(ms) })).ci_run_id, FOLLOWUP_ID);
  assert.deepEqual(waits, [1000, 2000]);
  assert.equal(discoveries, 3);
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/approve')).length, 1);
});

test('follow-up discovery timeout is bounded and preserves a reusable lockfile commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const waits = [];
  let discoveries = 0;
  const api = async (method, path, body) => {
    if (path.includes('/runs?event=pull_request')) {
      discoveries += 1;
      return { total_count: 0, workflow_runs: [] };
    }
    return state.api(method, path, body);
  };
  await assert.rejects(() => publish({ ...state, api, directory, wait: async (ms) => waits.push(ms) }), /not created the pull-request CI run/);
  assert.equal(discoveries, 6);
  assert.deepEqual(waits, [1000, 2000, 4000, 8000, 15000]);
  assert.equal(state.writes.length, 1);
  assert.equal((await publish({ ...state, directory })).ci_run_id, FOLLOWUP_ID);
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
});

for (const [label, mutate] of [
  ['missing workflow ID', (run) => { delete run.workflow_id; }],
  ['another workflow', (run) => { run.workflow_id = 99; }],
  ['another workflow file', (run) => { run.path = '.github/workflows/other.yml'; }],
  ['manual dispatch', (run) => { run.event = 'workflow_dispatch'; }],
  ['another head', (run) => { run.head_sha = SOURCE; }],
  ['another branch', (run) => { run.head_branch = 'main'; }],
  ['another repository', (run) => { run.repository.full_name = 'someone/yify'; }],
  ['a fork', (run) => { run.head_repository.full_name = 'someone/yify'; }],
  ['another actor', (run) => { run.actor.login = 'someone'; }],
  ['no PR association', (run) => { run.pull_requests = []; }],
  ['multiple PR associations', (run) => { run.pull_requests.push(structuredClone(run.pull_requests[0])); }],
  ['another PR', (run) => { run.pull_requests[0].number = 999; }],
  ['another PR head', (run) => { run.pull_requests[0].head.sha = SOURCE; }],
  ['another PR branch', (run) => { run.pull_requests[0].head.ref = 'other'; }],
  ['another PR repository', (run) => { run.pull_requests[0].head.repo.id = 123; }],
  ['another base repository', (run) => { run.pull_requests[0].base.repo.id = 123; }],
  ['another base branch', (run) => { run.pull_requests[0].base.ref = 'dev'; }],
  ['invalid run ID', (run) => { run.id = '../approve'; }],
]) test(`refuses approval for follow-up CI with ${label}`, async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  mutate(state.followupRun);
  const directory = await artifact(t, state);
  await assert.rejects(() => publish({ ...state, directory }), /exact same-repository/);
  assert.equal(state.writes.length, 1);
});

for (const result of [{}, { total_count: 2, workflow_runs: [] }, { total_count: 1, workflow_runs: [] }]) {
  test(`refuses malformed or ambiguous follow-up discovery: ${JSON.stringify(result)}`, async (t) => {
    const { publish } = await helpers;
    const state = await fixture();
    const directory = await artifact(t, state);
    const api = (method, path, body) => path.includes('/runs?event=pull_request') ? result : state.api(method, path, body);
    await assert.rejects(() => publish({ ...state, api, directory }), /ambiguous or incomplete/);
    assert.equal(state.writes.length, 1);
  });
}

for (const [status, conclusion] of [['queued', null], ['in_progress', null], ['completed', 'success']]) {
  test(`existing ${status}/${conclusion} follow-up is reused without approving twice`, async (t) => {
    const { publish } = await helpers;
    const state = await fixture({ refreshed: true });
    state.env.PR_HEAD_SHA = SOURCE;
    state.followupRun.status = status; state.followupRun.conclusion = conclusion;
    const directory = await artifact(t, state);
    assert.equal((await publish({ ...state, directory })).ci_run_id, FOLLOWUP_ID);
    assert.equal(state.writes.length, 0);
  });
}

for (const conclusion of ['failure', 'cancelled', 'timed_out', 'skipped', null]) {
  test(`completed follow-up with ${conclusion} is not reported as successfully recovered`, async (t) => {
    const { publish } = await helpers;
    const state = await fixture({ refreshed: true });
    state.env.PR_HEAD_SHA = SOURCE;
    state.followupRun.conclusion = conclusion;
    const directory = await artifact(t, state);
    await assert.rejects(() => publish({ ...state, directory }), /inspect its failure/);
    assert.equal(state.writes.length, 0);
  });
}

test('approval accepted before a lost response is recovered without another POST', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const approvalApi = async (...args) => {
    await state.approvalApi(...args);
    throw new Error('Response lost');
  };
  await assert.rejects(() => publish({ ...state, approvalApi, directory }), /Response lost/);
  assert.equal((await publish({ ...state, directory })).ci_run_id, FOLLOWUP_ID);
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/approve')).length, 1);
});

for (const stage of ['run discovery', 'fresh run lookup', 'final head check']) {
  test(`a concurrent push during ${stage} prevents approval`, async (t) => {
    const { publish } = await helpers;
    const state = await fixture();
    const directory = await artifact(t, state);
    let readsAfterCommit = 0;
    const api = async (method, path, body) => {
      const response = await state.api(method, path, body);
      if (stage === 'run discovery' && path.includes('/runs?event=pull_request')) state.pr.head.sha = 'd'.repeat(40);
      if (stage === 'fresh run lookup' && path === `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}`) state.pr.head.sha = 'd'.repeat(40);
      if (stage === 'final head check' && path === `repos/${REPOSITORY}/pulls/123` && state.writes.length > 0 && ++readsAfterCommit === 3) response.head.sha = 'd'.repeat(40);
      return response;
    };
    await assert.rejects(() => publish({ ...state, api, directory }), /Pull request changed/);
    assert.equal(state.writes.length, 1);
  });
}

test('the newly created lockfile commit must have verified provenance before approval', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const api = async (method, path, body) => {
    const response = await state.api(method, path, body);
    if (path === `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}`) state.refreshedCommit.commit.verification.verified = false;
    return response;
  };
  await assert.rejects(() => publish({ ...state, api, directory }), /GitHub-signed/);
  assert.equal(state.writes.length, 1);
});

test('publish refuses a concurrent push rather than overwriting it', async (t) => {
  const { publish } = await helpers;
  const state = await fixture(); state.concurrentCommit = true;
  const directory = await artifact(t, state);
  await assert.rejects(() => publish({ ...state, directory }), /expectedHeadOid/);
  assert.equal(state.writes.length, 1);
  assert.equal(state.pr.head.sha, SOURCE);
});

for (const [label, options] of [
  ['modified regenerated bytes', () => ({ regenerated: Buffer.from('tampered') })],
  ['wrong original bytes', () => ({ original: Buffer.from('wrong original') })],
  ['another workflow attempt', (s) => ({ metadata: { ...s.metadata, run_attempt: '2' } })],
  ['another PR', (s) => ({ metadata: { ...s.metadata, pr: 124 } })],
  ['another source SHA', (s) => ({ metadata: { ...s.metadata, source: 'd'.repeat(40) } })],
]) test(`publish rejects artifact with ${label}`, async (t) => {
  const { publish } = await helpers;
  const state = await fixture(); const directory = await artifact(t, state, options(state));
  await assert.rejects(() => publish({ ...state, directory }));
  assert.equal(state.writes.length, 0);
});

test('publish cannot mutate an already merged PR even when merge inspection flag is set', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  state.env.ALLOW_MERGED = 'true'; state.pr.state = 'closed'; state.pr.merged = true; state.pr.merged_by = { login: 'github-actions[bot]' };
  const directory = await artifact(t, state);
  await assert.rejects(() => publish({ ...state, directory }));
  assert.equal(state.writes.length, 0);
});

test('capture binds lock bytes to current PR, source, run and attempt', async (t) => {
  const { capture } = await helpers;
  const state = await fixture(); const directory = await artifact(t, state);
  await capture({ env: state.env, directory });
  assert.deepEqual(JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8')), state.metadata);
});

test('API client fails closed on HTTP and GraphQL errors', async () => {
  const { githubApi } = await helpers;
  await assert.rejects(() => githubApi('test', async () => ({ ok: false, status: 403 }))('POST', 'graphql', {}), /403/);
  await assert.rejects(() => githubApi('test', async () => ({ ok: true, status: 200, json: async () => ({ errors: [{ message: 'head moved' }] }) }))('POST', 'graphql', {}), /head moved/);
});

test('API client accepts the workflow approval endpoint empty 201 response', async () => {
  const { githubApi } = await helpers;
  const api = githubApi('approval-app-token', async (url, options) => {
    assert.equal(url, `https://api.github.com/repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, 'Bearer approval-app-token');
    assert.equal(options.body, undefined);
    return new Response(null, { status: 201 });
  });
  assert.equal(await api('POST', `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`), null);
});

test('only the default-branch maintenance workflow can publish, approve or merge', async () => {
  const yaml = require('js-yaml');
  const ciText = await readFile(join(__dirname, '../.github/workflows/ci.yml'), 'utf8');
  const ci = yaml.load(ciText);
  const workflow = yaml.load(await readFile(join(__dirname, '../.github/workflows/dependabot-maintenance.yml'), 'utf8'));
  assert.match(ci.concurrency.group, /github\.event\.pull_request\.head\.sha/);
  assert.doesNotMatch(ciText, /DEPENDABOT_APP|contents: write|pull-requests: write|actions: write|pull_request_target/);
  assert.equal(ci.jobs['dependabot-write-lock'], undefined);
  assert.equal(ci.jobs['dependabot-auto-merge'], undefined);
  assert.deepEqual(workflow.on.workflow_run, { workflows: ['CI'], types: ['completed'] });
  assert.equal(workflow.on.pull_request, undefined);
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.equal(workflow.concurrency['cancel-in-progress'], false);
  const job = workflow.jobs.maintain;
  assert.match(job.if, /github\.ref == 'refs\/heads\/main'/);
  assert.equal(job.permissions.actions, 'read');
  const steps = job.steps;
  assert.equal(steps[0].with.ref, '${{ github.sha }}');
  assert.equal(steps[0].with['persist-credentials'], false);
  const token = steps.find((step) => step.id === 'approval-token');
  assert.match(token.uses, /^actions\/create-github-app-token@[a-f0-9]{40}$/);
  assert.equal(token.with['permission-actions'], 'write');
  assert.equal(token.with.repositories, '${{ github.event.repository.name }}');
  assert.equal(token.with['private-key'], '${{ secrets.DEPENDABOT_APP_PRIVATE_KEY }}');
  const download = steps.find((step) => step.uses?.startsWith('actions/download-artifact@'));
  assert.equal(download.with['run-id'], '${{ steps.prepare.outputs.source_run_id }}');
  assert.equal(download.with.name, '${{ steps.prepare.outputs.artifact_name }}');
  assert.ok(steps.findIndex((step) => step.name === 'Check workflow approval credentials') < steps.findIndex((step) => step.id === 'publish'));
  assert.match(steps.find((step) => step.id === 'publish').run, /publish-maintenance/);
  assert.match(steps.find((step) => step.id === 'inspect').if, /checks_passed == 'true'/);
  assert.match(steps.find((step) => step.id === 'inspect').if, /steps\.publish\.outputs\.changed == 'false'/);
  assert.match(steps.find((step) => step.id === 'merge').if, /version-update:semver-patch/);
  assert.ok(steps.every((step) => !/yarn |npm |npx |pull_request\.head/.test(step.run || '')));
});

test('a validated fresh lockfile can repair a failing original frozen-lock install', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  state.jobs[0].conclusion = 'failure';
  state.jobs[1].conclusion = 'failure';
  state.jobs[2].conclusion = 'failure';
  const directory = await artifact(t, state);
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.equal(state.writes.at(-1).path, `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
});

test('root lockfile automation includes the declared crash-reporting workspace', async () => {
  const { inspect } = await helpers;
  const state = await fixture();
  state.originalCommit.files.push({ filename: 'crashreporting/package.json', status: 'modified' });
  assert.equal((await inspect(state)).eligible, true);
});

test('GitHub Actions updates receive CI without write or merge eligibility', async () => {
  const { inspect } = await helpers;
  const state = await fixture();
  state.originalCommit.files = ['.github/workflows/ci.yml', '.github/workflows/deploy-pages.yml'].map((filename) => ({ filename, status: 'modified' }));
  const result = await inspect(state);
  assert.equal(result.eligible, false);
  assert.equal(result.automerge, false);
  assert.equal(result.scope, 'github-actions');
  assert.equal(state.writes.length, 0);
});

test('a release update cannot publish root lockfile artifacts', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  state.originalCommit.files = [{ filename: 'release/package.json', status: 'modified' }];
  const directory = await artifact(t, state);
  await assert.rejects(() => publish({ ...state, directory }), /another dependency scope/);
  assert.equal(state.writes.length, 0);
});

test('dependency scopes cannot be mixed or used to bypass exact head checks', async () => {
  for (const mutate of [
    (state) => state.originalCommit.files.push({ filename: 'release/package.json', status: 'modified' }),
    (state) => { state.originalCommit.files = [{ filename: '.github/workflows/../script.js', status: 'modified' }]; },
    (state) => { state.originalCommit.files = [{ filename: 'release/package.json', status: 'modified' }]; state.env.PR_HEAD_SHA = 'd'.repeat(40); },
  ]) {
    const state = await fixture();
    mutate(state);
    await rejectsInspection(state);
  }
});

test('manual follow-up fixes in root, release and Actions PRs receive CI without write or merge eligibility', async () => {
  const { inspect } = await helpers;
  for (const filename of ['package.json', 'release/package.json', '.github/workflows/ci.yml']) {
    const state = await fixture({ refreshed: true });
    state.originalCommit.files = [{ filename, status: 'modified' }];
    state.refreshedCommit.author.login = 'maintainer';
    state.refreshedCommit.commit.verification.verified = false;
    state.refreshedCommit.files = [{ filename: 'release/data/compatibility.ts', status: 'added' }];
    const result = await inspect({ ...state, allowManual: true });
    assert.equal(result.eligible, false);
    assert.equal(result.automerge, false);
    assert.equal(result.head, REFRESHED);
    assert.equal(state.writes.length, 0);
  }
});

for (const refreshed of [false, true]) test(`release updates have scope-bound lockfile and merge eligibility (refreshed: ${refreshed})`, async () => {
  const { inspect } = await helpers;
  const state = await fixture({ scope: 'release', refreshed });
  const result = await inspect(state);
  assert.equal(result.eligible, true);
  assert.equal(result.automerge, true);
  assert.equal(result.scope, 'release');
  assert.equal(result.lockfile, 'release/yarn.lock');
  assert.equal(result.refreshed, refreshed);
  assert.equal(state.writes.length, 0);
});

test('release publication changes only release/yarn.lock and approves final pull-request CI', async (t) => {
  const { publish, inspect } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state);
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  const input = state.writes[0].body.variables.input;
  assert.equal(input.expectedHeadOid, SOURCE);
  assert.deepEqual(input.fileChanges, { additions: [{ path: 'release/yarn.lock', contents: REGENERATED.toString('base64') }] });
  assert.match(input.message.body, /^Dependency-Scope: release\nLockfile-Path: release\/yarn.lock\n/);
  assert.equal(state.writes[1].path, `repos/${REPOSITORY}/actions/runs/${FOLLOWUP_ID}/approve`);
  assert.equal(state.writes[1].credential, 'approval-app');
  const result = await inspect({ ...state, env: { ...state.env, PR_HEAD_SHA: REFRESHED } });
  assert.equal(result.automerge, true);
  assert.equal(result.refreshed, true);
});

test('release approval can retry without creating another commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state);
  state.approvalFailure = true;
  await assert.rejects(() => publish({ ...state, directory }), /Approval temporarily unavailable/);
  state.approvalFailure = false;
  state.env.GITHUB_RUN_ATTEMPT = '2'; state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED, ci_run_id: FOLLOWUP_ID });
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
});

test('release capture records its fixed path and rejects unsupported scopes', async (t) => {
  const { capture } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state);
  assert.deepEqual(await capture({ env: state.env, directory }), state.metadata);
  for (const scope of ['../release', 'github-actions', 'constructor', undefined]) {
    await assert.rejects(() => capture({ env: { ...state.env, DEPENDENCY_SCOPE: scope }, directory }), /Unsupported dependency scope/);
  }
});

for (const [label, mutate] of [
  ['root scope in the provenance', (s, commitMessage) => { s.refreshedCommit.commit.message = commitMessage({ ...s.metadata, scope: 'root', lockfile: 'yarn.lock' }); }],
  ['unscoped source CI', (s) => { s.jobs[3].name = 'Dependabot clean reinstall'; }],
  ['root source CI', (s) => { s.jobs[3].name = 'Dependabot clean reinstall (root)'; }],
  ['root lockfile in the refresh', (s) => { s.refreshedCommit.files[0].filename = 'yarn.lock'; }],
  ['symlink directory', (s) => { s.directoryMode = '120000'; }],
  ['symlink lockfile', (s) => { s.lockMode = '120000'; }],
]) test(`release refresh rejects ${label}`, async () => {
  const { commitMessage } = await helpers;
  const state = await fixture({ scope: 'release', refreshed: true });
  mutate(state, commitMessage);
  await rejectsInspection(state);
});

test('legacy root refreshes still validate but cannot automatically merge', async () => {
  const { commitMessage, inspect } = await helpers;
  const state = await fixture({ refreshed: true });
  state.metadata.version = 1;
  delete state.metadata.scope;
  delete state.metadata.lockfile;
  state.refreshedCommit.commit.message = commitMessage(state.metadata);
  state.jobs[3].name = 'Dependabot clean reinstall';
  const result = await inspect(state);
  assert.equal(result.refreshed, true);
  assert.equal(result.automerge, false);
  assert.equal(result.scope, 'root');
});

for (const [label, overrides] of [
  ['root scope', { scope: 'root', lockfile: 'yarn.lock' }],
  ['unbound root lockfile', { lockfile: 'yarn.lock' }],
  ['path traversal', { lockfile: 'release/../yarn.lock' }],
  ['unsupported scope', { scope: 'constructor' }],
  ['legacy release scope', { version: 1 }],
  ['missing scope', { scope: undefined }],
]) test(`release publication refuses metadata with ${label}`, async (t) => {
  const { publish } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state, { metadata: { ...state.metadata, ...overrides } });
  await assert.rejects(() => publish({ ...state, directory }));
  assert.equal(state.writes.length, 0);
});

test('manual fixes never gain publication privileges and still require the current dispatched head', async (t) => {
  const { inspect, publish } = await helpers;
  const state = await fixture({ scope: 'release', refreshed: true });
  state.refreshedCommit.author.login = 'maintainer';
  const directory = await artifact(t, state);
  const result = await inspect({ ...state, allowManual: true });
  assert.equal(result.eligible, false);
  assert.equal(result.automerge, false);
  state.env.PR_HEAD_SHA = SOURCE;
  state.env.ALLOW_MANUAL_DEPENDENCY_UPDATES = 'true';
  await assert.rejects(() => publish({ ...state, directory }), /GitHub-signed/);
  await assert.rejects(() => inspect({ ...state, allowManual: true }), /head changed/);
  state.env.PR_HEAD_SHA = REFRESHED;
  state.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  state.env.GITHUB_SHA = SOURCE;
  await assert.rejects(() => inspect({ ...state, allowManual: true }), /dispatched workflow/);
  assert.equal(state.writes.length, 0);
});

test('three-commit manual fixes receive ordinary CI but fail strict automation inspection', async () => {
  const { inspect } = await helpers;
  const state = await fixture({ scope: 'release', refreshed: true });
  const head = 'd'.repeat(40);
  state.extraCommits.push({ sha: head });
  state.pr.commits = 3;
  state.pr.head.sha = head;
  state.env.PR_HEAD_SHA = head;
  assert.equal((await inspect({ ...state, allowManual: true })).eligible, false);
  await rejectsInspection(state, /one lockfile refresh/);
  state.originalCommit.commit.verification.verified = false;
  await assert.rejects(() => inspect({ ...state, allowManual: true }), /verified signature/);
});


async function maintenanceFixture(options = {}) {
  const state = await fixture(options);
  Object.assign(state.env, { GITHUB_EVENT_NAME: 'workflow_run', GITHUB_REF: 'refs/heads/main',
    GITHUB_SHA: 'c'.repeat(40), GITHUB_RUN_ID: '900', SOURCE_RUN_ID: '456', SOURCE_RUN_ATTEMPT: '1', SOURCE_HEAD_SHA: SOURCE });
  return state;
}

test('trusted maintenance binds source checks and exact-attempt artifact before publication', async () => {
  const { prepareMaintenance } = await helpers;
  const state = await maintenanceFixture({ scope: 'release' });
  assert.deepEqual(await prepareMaintenance(state), { ready: true, operation: 'publish', pr: 123, head: SOURCE, source: SOURCE,
    branch: state.pr.head.ref, scope: 'release', automerge: true, checks_passed: true, source_run_id: '456',
    source_run_attempt: '1', artifact_name: 'dependabot-clean-install-release-456-1' });
  assert.equal(state.writes.length, 0);
});

for (const association of [SOURCE, REFRESHED]) test(`recovery accepts proven historical PR association ${association[0]}`, async () => {
  const { prepareMaintenance } = await helpers;
  const state = await maintenanceFixture({ scope: 'release', refreshed: true });
  state.run.pull_requests[0].head.sha = association;
  const prepared = await prepareMaintenance(state);
  assert.equal(prepared.source, SOURCE);
  assert.equal(prepared.head, REFRESHED);
  assert.equal(prepared.operation, 'publish');
});

for (const [label, mutate] of [
  ['another checkout branch', (s) => { s.env.GITHUB_REF = 'refs/heads/dependabot/test'; }],
  ['pull-request execution', (s) => { s.env.GITHUB_EVENT_NAME = 'pull_request'; }],
  ['another repository', (s) => { s.env.GITHUB_REPOSITORY = 'attacker/yify'; }],
  ['missing source ID', (s) => { delete s.env.SOURCE_RUN_ID; }],
  ['invalid source attempt', (s) => { s.env.SOURCE_RUN_ATTEMPT = '../1'; }],
  ['source ID mismatch', (s) => { s.run.id = 457; }],
  ['source attempt mismatch', (s) => { s.run.run_attempt = 2; }],
  ['another workflow', (s) => { s.run.workflow_id = 13; }],
  ['another workflow path', (s) => { s.run.path = '.github/workflows/other.yml'; }],
  ['surrogate dispatch CI', (s) => { s.run.event = 'workflow_dispatch'; }],
  ['incomplete source CI', (s) => { s.run.status = 'in_progress'; }],
  ['forked source run', (s) => { s.run.head_repository.full_name = 'attacker/yify'; }],
  ['unknown run actor', (s) => { s.run.actor.login = 'someone'; }],
  ['another branch association', (s) => { s.run.head_branch = 'other'; }],
  ['another association head', (s) => { s.run.pull_requests[0].head.sha = 'd'.repeat(40); }],
  ['another association repository', (s) => { s.run.pull_requests[0].head.repo.id = 99; }],
  ['multiple associations', (s) => { s.run.pull_requests.push(s.run.pull_requests[0]); }],
  ['failed clean reinstall', (s) => { s.jobs[3].conclusion = 'failure'; }],
  ['incomplete clean reinstall', (s) => { s.jobs[3].status = 'in_progress'; }],
  ['missing clean reinstall', (s) => { s.jobs.pop(); }],
]) test(`maintenance rejects ${label} before credentials or publication`, async () => {
  const { prepareMaintenance } = await helpers;
  const state = await maintenanceFixture(); mutate(state);
  await assert.rejects(() => prepareMaintenance(state));
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['missing', (a) => { a.splice(0); }],
  ['duplicated', (a) => { a.push(a[0]); }],
  ['expired', (a) => { a[0].expired = true; }],
  ['another attempt', (a) => { a[0].name = 'dependabot-clean-install-root-456-2'; }],
  ['another source', (a) => { a[0].workflow_run.head_sha = REFRESHED; }],
  ['another run', (a) => { a[0].workflow_run.id = 457; }],
  ['another repository', (a) => { a[0].workflow_run.head_repository_id = 99; }],
]) test(`maintenance rejects ${label} artifact`, async () => {
  const { prepareMaintenance } = await helpers;
  const state = await maintenanceFixture();
  const api = async (...args) => {
    const result = await state.api(...args);
    if (args[1].includes('/artifacts?')) mutate(result.artifacts);
    return result;
  };
  await assert.rejects(() => prepareMaintenance({ ...state, api }), /artifact/);
  assert.equal(state.writes.length, 0);
});

test('manual recovery requires the selected artifact-producing attempt without guessing', async () => {
  const { prepareMaintenance } = await helpers;
  const state = await maintenanceFixture();
  state.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; delete state.env.SOURCE_RUN_ATTEMPT;
  const api = async (method, path, body) => {
    if (path === `repos/${REPOSITORY}/actions/runs/456`) return { ...state.run, run_attempt: 2 };
    if (path.endsWith('/attempts/2')) return { ...state.run, run_attempt: 2 };
    if (path.includes('/attempts/2/jobs?')) return { jobs: [] };
    return state.api(method, path, body);
  };
  await assert.rejects(() => prepareMaintenance({ ...state, api }), /exact artifact-producing attempt/);
  state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.equal((await prepareMaintenance({ ...state, api })).artifact_name, 'dependabot-clean-install-root-456-1');
});

test('manual maintenance on main normalizes only after source validation and publishes original-run provenance', async (t) => {
  const { maintenanceContext, publish } = await helpers;
  const state = await maintenanceFixture();
  state.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  const directory = await artifact(t, state);
  const env = await maintenanceContext({ ...state, operation: 'publish' });
  assert.equal(env.GITHUB_EVENT_NAME, 'workflow_run');
  assert.equal(env.SOURCE_RUN_ID, '456');
  assert.equal(env.GITHUB_RUN_ID, '900');
  assert.equal((await publish({ ...state, env, directory })).new_sha, REFRESHED);
  assert.match(state.refreshedCommit.commit.message, /Actions-Run: 456/);
  assert.doesNotMatch(state.refreshedCommit.commit.message, /Actions-Run: 900/);
});

test('a refreshed head requires three passing actual pull-request checks and no new artifact', async () => {
  const { prepareMaintenance, maintenanceContext } = await helpers;
  const state = await maintenanceFixture({ scope: 'release', refreshed: true });
  state.followupRun.run_attempt = 1;
  state.followupRun.conclusion = 'success';
  state.env.SOURCE_RUN_ID = String(FOLLOWUP_ID); state.env.SOURCE_HEAD_SHA = REFRESHED;
  const result = await prepareMaintenance(state);
  assert.equal(result.operation, 'merge');
  assert.equal(result.artifact_name, undefined);
  assert.equal((await maintenanceContext({ ...state, operation: 'merge' })).PR_HEAD_SHA, REFRESHED);
  state.jobs[0].conclusion = 'failure';
  await assert.rejects(() => prepareMaintenance(state), /every required CI check/);
  assert.equal(state.writes.length, 0);
});

test('failed frozen checks permit a tested fresh lockfile but never immediate merge', async () => {
  const { prepareMaintenance, maintenanceContext } = await helpers;
  const state = await maintenanceFixture({ scope: 'release' });
  state.jobs[0].conclusion = 'failure';
  assert.equal((await prepareMaintenance(state)).checks_passed, false);
  await assert.rejects(() => maintenanceContext({ ...state, operation: 'merge' }), /has not passed/);
});

test('maintenance rejects stale preparation and source checks on a different current head', async () => {
  const { maintenanceContext } = await helpers;
  const state = await maintenanceFixture({ scope: 'release' });
  state.env.SOURCE_HEAD_SHA = REFRESHED;
  await assert.rejects(() => maintenanceContext({ ...state, operation: 'publish' }), /changed after maintenance preparation/);
  state.env.SOURCE_HEAD_SHA = SOURCE; state.refresh(); state.env.PR_HEAD_SHA = REFRESHED;
  await assert.rejects(() => maintenanceContext({ ...state, operation: 'merge' }), /did not test the current/);
});

test('closed pull requests and GitHub Actions updates are skipped without privilege use', async () => {
  const { prepareMaintenance } = await helpers;
  const closed = await maintenanceFixture(); closed.pr.state = 'closed';
  assert.equal((await prepareMaintenance(closed)).ready, false);
  const action = await maintenanceFixture(); action.originalCommit.files = [{ filename: '.github/workflows/ci.yml', status: 'modified' }];
  assert.equal((await prepareMaintenance(action)).ready, false);
  assert.equal(closed.writes.length + action.writes.length, 0);
});
