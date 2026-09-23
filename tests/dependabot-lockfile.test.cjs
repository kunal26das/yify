const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, writeFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const helpers = import('../scripts/dependabot-lockfile.mjs');

const SOURCE = 'a'.repeat(40);
const REFRESHED = 'b'.repeat(40);
const REPOSITORY = 'kunal26das/yify';
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
    head: { sha: SOURCE, ref: 'dependabot/npm_and_yarn/patch-updates-abcd', repo: { full_name: REPOSITORY } },
    base: { ref: 'main', repo: { full_name: REPOSITORY } }, commits: 1 };
  const run = { workflow_id: 12, head_sha: SOURCE, head_repository: { full_name: REPOSITORY }, event: 'pull_request', run_attempt: 1 };
  const jobs = [...names, `Dependabot clean reinstall (${scope})`].map((name) => ({ name, conclusion: 'success' }));
  const writes = [];
  const state = { env, metadata, pr, originalCommit, refreshedCommit, run, jobs, writes, regenerate: REGENERATED,
    original: ORIGINAL, dispatchFailure: false, concurrentCommit: false, lockMode: '100644', directoryMode: '040000', extraCommits: [] };
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
      if (path.endsWith('/dispatches')) {
        if (state.dispatchFailure) throw new Error('Dispatch temporarily unavailable');
        return null;
      }
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
    if (path === `repos/${REPOSITORY}/actions/workflows/ci.yml`) return { id: 12 };
    if (path === `repos/${REPOSITORY}/actions/runs/456/attempts/1`) return structuredClone(run);
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/456/attempts/1/jobs?`)) return { jobs: structuredClone(jobs) };
    throw new Error(`Unexpected API request: ${method} ${path}`);
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

test('publish commits only tested yarn.lock with CAS and dispatches checks on the new head', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  const result = await publish({ ...state, directory });
  assert.deepEqual(result, { changed: true, new_sha: REFRESHED });
  assert.equal(state.writes.length, 2);
  const input = state.writes[0].body.variables.input;
  assert.equal(input.expectedHeadOid, SOURCE);
  assert.deepEqual(input.fileChanges, { additions: [{ path: 'yarn.lock', contents: REGENERATED.toString('base64') }] });
  assert.match(input.message.headline, /\[dependabot skip\]/);
  assert.deepEqual(state.writes[1].body, { ref: state.pr.head.ref, inputs: { dependabot_pr: '123', dependabot_head: REFRESHED } });
});

test('publish leaves matching lockfiles unchanged and does not dispatch redundant CI', async (t) => {
  const { publish, digest } = await helpers;
  const state = await fixture();
  state.metadata.lockfile_sha256 = digest(ORIGINAL);
  const directory = await artifact(t, state, { regenerated: ORIGINAL });
  assert.deepEqual(await publish({ ...state, directory }), { changed: false, new_sha: SOURCE });
  assert.equal(state.writes.length, 0);
});

test('publish retries a failed dispatch without creating another commit, including failed-only reruns', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  const directory = await artifact(t, state);
  state.dispatchFailure = true;
  await assert.rejects(() => publish({ ...state, directory }), /Dispatch temporarily unavailable/);
  state.dispatchFailure = false;
  state.env.GITHUB_RUN_ATTEMPT = '2'; state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED });
  assert.equal(state.writes.filter((write) => write.path === 'graphql').length, 1);
  assert.equal(state.writes.filter((write) => write.path.endsWith('/dispatches')).length, 2);
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

test('a validated fresh lockfile can repair a failing original frozen-lock install', async (t) => {
  const { publish } = await helpers;
  const state = await fixture();
  state.jobs[0].conclusion = 'failure';
  state.jobs[1].conclusion = 'failure';
  state.jobs[2].conclusion = 'failure';
  const directory = await artifact(t, state);
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED });
  assert.equal(state.writes.at(-1).body.inputs.dependabot_head, REFRESHED);
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

test('release publication changes only release/yarn.lock and dispatches final CI', async (t) => {
  const { publish, inspect } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state);
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED });
  const input = state.writes[0].body.variables.input;
  assert.equal(input.expectedHeadOid, SOURCE);
  assert.deepEqual(input.fileChanges, { additions: [{ path: 'release/yarn.lock', contents: REGENERATED.toString('base64') }] });
  assert.match(input.message.body, /^Dependency-Scope: release\nLockfile-Path: release\/yarn.lock\n/);
  assert.deepEqual(state.writes[1].body, { ref: state.pr.head.ref, inputs: { dependabot_pr: '123', dependabot_head: REFRESHED } });
  const result = await inspect({ ...state, env: { ...state.env, PR_HEAD_SHA: REFRESHED } });
  assert.equal(result.automerge, true);
  assert.equal(result.refreshed, true);
});

test('release dispatch can retry without creating another commit', async (t) => {
  const { publish } = await helpers;
  const state = await fixture({ scope: 'release' });
  const directory = await artifact(t, state);
  state.dispatchFailure = true;
  await assert.rejects(() => publish({ ...state, directory }), /Dispatch temporarily unavailable/);
  state.dispatchFailure = false;
  state.env.GITHUB_RUN_ATTEMPT = '2'; state.env.SOURCE_RUN_ATTEMPT = '1';
  assert.deepEqual(await publish({ ...state, directory }), { changed: true, new_sha: REFRESHED });
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
