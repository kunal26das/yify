const { test } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, readFile, rm } = require('node:fs/promises');
const { tmpdir } = require('node:os');
const { join } = require('node:path');
const helpers = import('../scripts/dependabot-refresh.mjs');
const lockfile = import('../scripts/dependabot-lockfile.mjs');

const REPOSITORY = 'kunal26das/yify';
const REPOSITORY_ID = 283553926;
const SOURCE = 'a'.repeat(40);
const HEAD = 'b'.repeat(40);
const MAIN = 'c'.repeat(40);
const NEXT = 'd'.repeat(40);
const TREE = 'e'.repeat(40);
const RELEASE_TREE = 'f'.repeat(40);
const LOCK = Buffer.from('# yarn lockfile v1\ntest:\n  version "1.0.1"\n');
const DATE = '2026-09-25T00:00:00Z';
const names = ['Typecheck and tests', 'Web exports render and isolate catalog data', 'Typecheck and test release console'];

function rootLock(version) {
  return Buffer.from(`# yarn lockfile v1\neslint@${version}:\n  version "${version}"\n  resolved "https://registry.yarnpkg.com/eslint/-/eslint-${version}.tgz#${'a'.repeat(40)}"\n  integrity sha512-${Buffer.alloc(64, 1).toString('base64')}\n`);
}

async function fixture({ scope = 'release' } = {}) {
  const { digest, commitMessage } = await lockfile;
  const repo = { id: REPOSITORY_ID, full_name: REPOSITORY };
  const lockPath = scope === 'release' ? 'release/yarn.lock' : 'yarn.lock';
  const manifestPath = scope === 'release' ? 'release/package.json' : 'package.json';
  const refreshedLock = scope === 'release' ? LOCK : rootLock('10.12.0');
  const pr = { number: 892, state: 'open', merged: false, draft: false, user: { login: 'dependabot[bot]' }, commits: 2,
    head: { sha: HEAD, ref: scope === 'release' ? 'dependabot/npm_and_yarn/release/types/node-26.6.2' : 'dependabot/npm_and_yarn/tooling-eslint-10.12.0', repo: { ...repo } },
    base: { ref: 'main', repo: { ...repo } }, mergeable_state: 'behind' };
  const metadata = { version: 2, repository: REPOSITORY, scope, lockfile: lockPath,
    pr: 892, source: SOURCE, run_id: '123', run_attempt: '1', lockfile_sha256: digest(refreshedLock) };
  const original = { sha: SOURCE, author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true }, tree: { sha: TREE } },
    parents: [{ sha: MAIN }], files: [{ filename: manifestPath, status: 'modified' }, { filename: lockPath, status: 'modified' }] };
  const refresh = { sha: HEAD, author: { login: 'github-actions[bot]' }, committer: { login: 'web-flow' },
    commit: { verification: { verified: true }, tree: { sha: TREE }, message: commitMessage(metadata) },
    parents: [{ sha: SOURCE }], files: [{ filename: lockPath, status: 'modified' }] };
  const next = { ...structuredClone(original), sha: NEXT };
  const run = { id: 456, workflow_id: 12, path: '.github/workflows/ci.yml', head_sha: HEAD, head_branch: pr.head.ref,
    repository: { full_name: REPOSITORY }, head_repository: { full_name: REPOSITORY }, event: 'pull_request',
    run_attempt: 2, status: 'completed', actor: { login: 'github-actions[bot]' },
    pull_requests: [{ number: 892, head: structuredClone(pr.head), base: structuredClone(pr.base) }] };
  const sourceRun = { ...structuredClone(run), id: 123, head_sha: SOURCE, run_attempt: 1, actor: { login: 'dependabot[bot]' } };
  const jobs = names.map((name) => ({ name, status: 'completed', conclusion: 'success' }));
  const env = { GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'workflow_run',
    GITHUB_SHA: MAIN, PR_NUMBER: '892', PR_HEAD_SHA: HEAD, SOURCE_HEAD_SHA: HEAD,
    SOURCE_RUN_ID: '456', SOURCE_RUN_ATTEMPT: '2', GH_TOKEN: 'builtin-fixture', DEPENDABOT_REBASE_TOKEN: 'owner-fixture' };
  const state = { env, pr, run, sourceRun, jobs, original, refresh, next, scope, refreshedLock, baseLock: rootLock('10.11.0'),
    baseManifests: { 'package.json': { name: 'yify', devDependencies: { eslint: '10.11.0' } },
      'crashreporting/package.json': { name: '@yify/crashreporting' }, 'tooling/package.json': { name: '@yify/tooling' } },
    headManifests: { 'package.json': { name: 'yify', devDependencies: { eslint: '10.12.0' } },
      'crashreporting/package.json': { name: '@yify/crashreporting' }, 'tooling/package.json': { name: '@yify/tooling' } },
    comments: [], reactions: [], writes: [],
    calls: [], main: { ref: 'refs/heads/main', object: { type: 'commit', sha: MAIN } },
    owner: { login: 'kunal26das', type: 'User' }, nextCommentId: 100, now: 0, waits: [],
    comparison: { base_commit: { sha: HEAD }, ahead_by: 1, status: 'diverged' } };
  state.body = `@dependabot rebase\n\n<!-- dependabot-rebase:v2:${HEAD}:${MAIN} -->`;
  state.comment = (extra = {}) => ({ id: 100, user: { login: 'kunal26das', type: 'User' }, body: state.body, created_at: DATE, ...extra });
  state.rebase = () => { pr.commits = 1; pr.head.sha = NEXT; };
  state.api = async (method, path, body) => {
    state.calls.push({ method, path });
    assert.equal(method, 'GET', 'The built-in token must remain read-only in the refresh helper.');
    if (state.beforeApi) await state.beforeApi(method, path, body);
    if (path === `repos/${REPOSITORY}/pulls/892`) return structuredClone(pr);
    if (path.startsWith(`repos/${REPOSITORY}/pulls/892/commits?`)) return structuredClone(pr.head.sha === NEXT ? [next] : [original, refresh]);
    if (path === `repos/${REPOSITORY}/commits/${SOURCE}?per_page=100`) return structuredClone(original);
    if (path === `repos/${REPOSITORY}/commits/${HEAD}?per_page=100`) return structuredClone(refresh);
    if (path === `repos/${REPOSITORY}/commits/${NEXT}?per_page=100`) return structuredClone(next);
    if (path === `repos/${REPOSITORY}/git/trees/${TREE}`) return { truncated: false, tree: scope === 'release' ? [{ path: 'release', type: 'tree', mode: '040000', sha: RELEASE_TREE }] : [{ path: 'yarn.lock', type: 'blob', mode: '100644' }] };
    if (path === `repos/${REPOSITORY}/git/trees/${RELEASE_TREE}`) return { truncated: false, tree: [{ path: 'yarn.lock', type: 'blob', mode: '100644' }] };
    if (path.startsWith(`repos/${REPOSITORY}/contents/`)) {
      const url = new URL(`https://api.github.com/${path}`);
      const filename = url.pathname.slice(`/repos/${REPOSITORY}/contents/`.length);
      const baseline = url.searchParams.get('ref') === MAIN;
      const bytes = filename === lockPath ? (baseline ? state.baseLock : state.lock || state.refreshedLock) :
        Buffer.from(JSON.stringify((baseline ? state.baseManifests : state.headManifests)[filename]));
      return { type: 'file', encoding: 'base64', content: bytes.toString('base64') };
    }
    if (path === `repos/${REPOSITORY}/actions/workflows/ci.yml`) return { id: 12, path: '.github/workflows/ci.yml' };
    if (path === `repos/${REPOSITORY}/actions/runs/456` || path === `repos/${REPOSITORY}/actions/runs/456/attempts/2`) return structuredClone(run);
    if (path === `repos/${REPOSITORY}/actions/runs/123/attempts/1`) return structuredClone(sourceRun);
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/456/attempts/2/jobs?`)) return { jobs: structuredClone(jobs) };
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/123/attempts/1/jobs?`)) return { jobs: [{ name: `Dependabot clean reinstall (${scope})`, status: 'completed', conclusion: 'success' }] };
    if (path === `repos/${REPOSITORY}/git/ref/heads/main`) return structuredClone(state.main);
    if (path.startsWith(`repos/${REPOSITORY}/compare/`)) return structuredClone(state.comparison);
    if (path.startsWith(`repos/${REPOSITORY}/issues/892/comments?`)) {
      if (state.listError) throw new Error('Comments unavailable');
      if (state.commentPages) return structuredClone(state.commentPages[Number(new URL(`https://api.github.com/${path}`).searchParams.get('page')) - 1] || []);
      return structuredClone(state.comments);
    }
    if (/\/issues\/comments\/[0-9]+\/reactions\?/.test(path)) {
      const id = Number(path.match(/comments\/([0-9]+)\//)[1]);
      return structuredClone(state.reactionsById?.[id] || state.reactions);
    }
    throw new Error(`Unexpected request: ${method} ${path}`);
  };
  state.rebaseApi = async (method, path, body) => {
    if (method === 'GET' && path === 'user') return structuredClone(state.owner);
    assert.equal(method, 'POST');
    assert.equal(path, `repos/${REPOSITORY}/issues/892/comments`);
    state.writes.push({ method, path, body });
    if (state.postBeforeError) throw new Error('Request forbidden');
    const comment = state.comment({ id: state.nextCommentId++, body: body.body });
    state.comments.push(comment);
    if (state.onPost) state.onPost();
    if (state.postAfterError) throw new Error('Connection lost after POST');
    return structuredClone(comment);
  };
  state.wait = async (ms) => { state.waits.push(ms); state.now += ms; if (state.onWait) state.onWait(); };
  state.observe = async (options = {}) => (await helpers).requestRebase({ ...state, now: () => state.now, timeoutMs: 10, pollMs: 5, ...options });
  return state;
}

test('posts only through the owner token and accepts Dependabot acknowledgement', async () => {
  const state = await fixture();
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const result = await state.observe();
  assert.deepEqual(result, { requested: true, acknowledgement: 'dependabot-reaction', pr: 892, head: HEAD, main: MAIN, comment_id: 100 });
  assert.deepEqual(state.writes, [{ method: 'POST', path: `repos/${REPOSITORY}/issues/892/comments`, body: { body: state.body } }]);
  assert.ok(state.calls.every(({ method }) => method === 'GET'));
});

test('accepts a new signed Dependabot source without an acknowledgement reaction', async () => {
  const state = await fixture();
  state.onPost = state.rebase;
  const result = await state.observe();
  assert.equal(result.requested, true);
  assert.equal(result.acknowledgement, 'signed-head');
  assert.equal(result.new_head, NEXT);
});

test('a reviewed JavaScript root update can request a rebase after its exact-head checks pass', async () => {
  const state = await fixture({ scope: 'root' });
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const result = await state.observe();
  assert.equal(result.requested, true);
  assert.equal(result.acknowledgement, 'dependabot-reaction');
  assert.equal(state.writes.length, 1);
});

test('a root rebase accepts only a fresh signed head that retains automatic-merge eligibility', async () => {
  const state = await fixture({ scope: 'root' });
  state.onPost = state.rebase;
  assert.equal((await state.observe()).new_head, NEXT);
  assert.equal(state.writes.length, 1);
});

test('a signed root update needing native review cannot request an automatic rebase', async () => {
  const state = await fixture({ scope: 'root' });
  state.baseManifests['package.json'].dependencies = { 'react-native': '0.88.0-rc.3' };
  state.headManifests['package.json'].dependencies = { 'react-native': '0.88.0-rc.4' };
  await assert.rejects(() => state.observe(), /eligible for automatic merging/);
  assert.equal(state.writes.length, 0);
});

test('a root rebase rejects a new signed head that introduces a native update', async () => {
  const state = await fixture({ scope: 'root' });
  state.onPost = () => {
    state.rebase();
    state.headManifests['package.json'].dependencies = { 'react-native': '0.88.0-rc.4' };
  };
  await assert.rejects(() => state.observe(), /fresh, verified Dependabot update/);
  assert.equal(state.writes.length, 1);
});

for (const [label, mutate] of [
  ['missing owner token', (s) => { delete s.env.DEPENDABOT_REBASE_TOKEN; }],
  ['built-in token reused', (s) => { s.env.DEPENDABOT_REBASE_TOKEN = s.env.GH_TOKEN; }],
  ['a GitHub App token', (s) => { s.owner = { login: 'approval[bot]', type: 'Bot' }; }],
  ['another user token', (s) => { s.owner.login = 'someone'; }],
  ['an owner-named bot', (s) => { s.owner.type = 'Bot'; }],
  ['PR workflow execution', (s) => { s.env.GITHUB_EVENT_NAME = 'pull_request'; }],
  ['another execution branch', (s) => { s.env.GITHUB_REF = 'refs/heads/feature'; }],
  ['a foreign PR author', (s) => { s.pr.user.login = 'someone'; }],
  ['a fork', (s) => { s.pr.head.repo.full_name = 'someone/yify'; }],
  ['another target branch', (s) => { s.pr.base.ref = 'feature'; }],
  ['a closed PR', (s) => { s.pr.state = 'closed'; }],
  ['an already merged PR', (s) => { s.pr.merged = true; s.pr.state = 'closed'; }],
  ['merged-state bypass requested', (s) => { s.env.ALLOW_MERGED = 'true'; }],
  ['unsigned original commit', (s) => { s.original.commit.verification.verified = false; }],
  ['unsigned lock refresh', (s) => { s.refresh.commit.verification.verified = false; }],
  ['unverified lock contents', (s) => { s.lock = Buffer.from('modified'); }],
  ['a failing required check', (s) => { s.jobs[0].conclusion = 'failure'; }],
  ['a different tested head', (s) => { s.run.head_sha = SOURCE; }],
  ['invalid main identity', (s) => { s.main.ref = 'refs/heads/other'; }],
  ['invalid main SHA', (s) => { s.main.object.sha = 'not-a-sha'; }],
]) test(`refuses ${label} before posting any command`, async () => {
  const state = await fixture(); mutate(state);
  await assert.rejects(() => state.observe());
  assert.equal(state.writes.length, 0);
});

test('does not request a rebase when the branch is no longer behind', async () => {
  const state = await fixture(); state.pr.mergeable_state = 'clean';
  assert.equal((await state.observe()).requested, false);
  assert.equal(state.writes.length, 0);
});

test('manual maintenance uses trusted source CI instead of the main execution SHA', async () => {
  const state = await fixture(); state.env.GITHUB_EVENT_NAME = 'workflow_dispatch';
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
});

test('ignores old rejected bot markers and forged owner markers', async () => {
  const state = await fixture();
  state.comments.push(state.comment({ id: 1, user: { login: 'github-actions[bot]', type: 'Bot' }, body: `@dependabot rebase\n\n<!-- dependabot-rebase:${HEAD}:${MAIN} -->` }));
  state.comments.push(state.comment({ id: 2, user: { login: 'someone', type: 'User' } }));
  state.comments.push(state.comment({ id: 3, user: { login: 'github-actions[bot]', type: 'Bot' } }));
  state.comments.push(state.comment({ id: 4, body: `${state.body}\nextra text` }));
  state.comments.push(state.comment({ id: 5, user: { login: 'dependabot[bot]' }, body: 'Sorry, only users with push access can use that command.' }));
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 1);
});

test('existing owner request is observed again without posting duplicates', async () => {
  const state = await fixture(); state.comments.push(state.comment());
  state.onWait = () => state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 0);
  assert.deepEqual(state.waits, [5]);
});

test('finds existing owner requests after the first comments page', async () => {
  const state = await fixture();
  state.commentPages = [Array.from({ length: 100 }, (_, id) => state.comment({ id: id + 1, user: { login: 'someone' } })), [state.comment()]];
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 0);
});

test('an unacknowledged owner request fails visibly and is not repeated on rerun', async () => {
  const state = await fixture();
  await assert.rejects(() => state.observe(), /pending; rerun maintenance/);
  await assert.rejects(() => state.observe(), /pending; rerun maintenance/);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.waits, [5, 5, 5, 5]);
});

test('polling remains bounded when the injected clock does not advance', async () => {
  const state = await fixture(); state.wait = async () => {};
  await assert.rejects(() => state.observe(), /not acknowledged/);
  assert.equal(state.writes.length, 1);
});

test('only Dependabot positive reactions acknowledge requests', async () => {
  const state = await fixture();
  state.reactions.push({ content: '+1', user: { login: 'kunal26das' } }, { content: 'eyes', user: { login: 'dependabot[bot]' } });
  await assert.rejects(() => state.observe(), /not acknowledged/);
});

test('an explicit Dependabot rejection wins over its positive reaction', async () => {
  const state = await fixture();
  state.onPost = () => state.comments.push(state.comment({ id: 101, user: { login: 'dependabot[bot]' }, body: 'Sorry, only users with push access can use that command.' }));
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  await assert.rejects(() => state.observe(), /Dependabot rejected/);
});

test('reconciles a lost POST response without sending a second command', async () => {
  const state = await fixture(); state.postAfterError = true;
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 1);
});

test('a rejected POST is not reported as a successful request', async () => {
  const state = await fixture(); state.postBeforeError = true;
  await assert.rejects(() => state.observe(), /Unable to confirm the rebase request/);
  assert.equal(state.writes.length, 1);
});

for (const [label, mutate] of [
  ['head', (s) => { s.pr.head.sha = NEXT; }],
  ['base', (s) => { s.pr.base.ref = 'other'; }],
  ['repository identity', (s) => { s.pr.head.repo.id += 1; }],
  ['state', (s) => { s.pr.state = 'closed'; }],
]) test(`aborts when PR ${label} changes between inspection and posting`, async () => {
  const state = await fixture();
  let commentsReads = 0;
  state.beforeApi = async (_method, path) => {
    if (path.includes('/comments?') && ++commentsReads === 1) mutate(state);
  };
  await assert.rejects(() => state.observe(), /Pull request changed/);
  assert.equal(state.writes.length, 0);
});

test('aborts if main advances immediately before posting', async () => {
  const state = await fixture(); let reads = 0;
  state.beforeApi = async (_method, path) => {
    if (path.endsWith('/git/ref/heads/main') && ++reads === 2) state.main.object.sha = NEXT;
  };
  await assert.rejects(() => state.observe(), /Main changed/);
  assert.equal(state.writes.length, 0);
});

test('a head change with an invalid signature cannot acknowledge a request', async () => {
  const state = await fixture(); state.next.commit.verification.verified = false; state.onPost = state.rebase;
  await assert.rejects(() => state.observe(), /verified signature/);
});

test('a new head that changes source code is rejected', async () => {
  const state = await fixture(); state.next.files.push({ filename: 'scripts/dependabot-lockfile.mjs', status: 'modified' }); state.onPost = state.rebase;
  await assert.rejects(() => state.observe(), /supported dependency scope/);
});

test('a PR closed while awaiting acknowledgement is never reopened by this helper', async () => {
  const state = await fixture(); state.onPost = () => { state.pr.state = 'closed'; };
  await assert.rejects(() => state.observe(), /identity changed/);
  assert.ok(state.calls.every(({ method }) => method === 'GET'));
  assert.equal(state.writes.length, 1);
});

test('identical concurrent owner requests reuse the acknowledged request without another POST', async () => {
  const state = await fixture(); state.comments.push(state.comment({ id: 101 }), state.comment());
  state.reactionsById = { 101: [{ content: '+1', user: { login: 'dependabot[bot]' } }] };
  const result = await state.observe();
  assert.equal(result.requested, true);
  assert.equal(result.comment_id, 101);
  assert.equal(state.writes.length, 0);
});

test('lost POST responses reconcile concurrent identical owner requests', async () => {
  const state = await fixture(); state.postAfterError = true;
  state.onPost = () => state.comments.push(state.comment({ id: 101 }));
  state.reactionsById = { 101: [{ content: '+1', user: { login: 'dependabot[bot]' } }] };
  assert.equal((await state.observe()).comment_id, 101);
  assert.equal(state.writes.length, 1);
});

test('a concurrent request appearing while polling is observed without a new command', async () => {
  const state = await fixture(); state.comments.push(state.comment());
  state.onWait = () => state.comments.push(state.comment({ id: 101 }));
  state.reactionsById = { 101: [{ content: '+1', user: { login: 'dependabot[bot]' } }] };
  assert.equal((await state.observe()).comment_id, 101);
  assert.equal(state.writes.length, 0);
});

test('every matching owner request must have valid server identity', async () => {
  const state = await fixture(); state.comments.push(state.comment(), state.comment({ id: 101, created_at: 'invalid' }));
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  await assert.rejects(() => state.observe(), /valid owner-authored/);
  assert.equal(state.writes.length, 0);
});

test('failed comments lookup blocks posting without leaking token values', async () => {
  const state = await fixture(); state.listError = true;
  await assert.rejects(() => state.observe(), /Comments unavailable/);
  assert.equal(state.writes.length, 0);
});

test('CLI exports a requested result only after acknowledged success', async (t) => {
  const { main } = await helpers;
  const state = await fixture(); state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const directory = await mkdtemp(join(tmpdir(), 'dependabot-refresh-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  state.env.GITHUB_OUTPUT = join(directory, 'output');
  const originalFetch = global.fetch;
  t.after(() => { global.fetch = originalFetch; });
  global.fetch = async (url, options) => {
    const api = options.headers.Authorization === `Bearer ${state.env.DEPENDABOT_REBASE_TOKEN}` ? state.rebaseApi : state.api;
    const value = await api(options.method, url.replace('https://api.github.com/', ''), options.body ? JSON.parse(options.body) : undefined);
    return new Response(JSON.stringify(value), { status: options.method === 'POST' ? 201 : 200 });
  };
  await main(state.env);
  assert.match(await readFile(state.env.GITHUB_OUTPUT, 'utf8'), /^requested=true\n/);
  state.env.GITHUB_OUTPUT = join(directory, 'pending'); state.reactions.length = 0;
  state.beforeApi = async (_method, path) => { if (path.includes('/reactions?')) throw new Error('Acknowledgement unavailable'); };
  await assert.rejects(() => main(state.env), /Acknowledgement unavailable/);
  await assert.rejects(() => readFile(state.env.GITHUB_OUTPUT), { code: 'ENOENT' });
});

async function recoveryFixture(options = {}) {
  const state = await fixture(options);
  const baseApi = state.api;
  state.env.SOURCE_RUN_ID = '999';
  state.env.SOURCE_RUN_ATTEMPT = '1';
  state.pr.mergeable_state = 'blocked';
  state.run.repository.id = REPOSITORY_ID;
  state.run.head_repository.id = REPOSITORY_ID;
  state.run.conclusion = 'failure';
  state.jobs[0].conclusion = 'failure';
  state.mainJobs = [...names, 'Verify dependency automation context'].map((name) => ({ name, status: 'completed', conclusion: 'success' }));
  state.mainRun = { ...structuredClone(state.run), id: 999, event: 'push', run_attempt: 1, head_sha: MAIN,
    head_branch: 'main', conclusion: 'success', pull_requests: [] };
  state.prs = [structuredClone(state.pr)];
  state.runList = [state.run];
  state.comparison = { base_commit: { sha: HEAD }, ahead_by: 2, status: 'diverged' };
  state.api = async (method, path, body) => {
    assert.equal(method, 'GET');
    if (state.beforeRecoveryApi) await state.beforeRecoveryApi(method, path, body);
    if (path === `repos/${REPOSITORY}/actions/runs/999` || path === `repos/${REPOSITORY}/actions/runs/999/attempts/1`) return structuredClone(state.mainRun);
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/999/attempts/1/jobs?`)) return { jobs: structuredClone(state.mainJobs) };
    if (path.startsWith(`repos/${REPOSITORY}/pulls?state=open&base=main`)) return structuredClone(state.prs);
    if (path.startsWith(`repos/${REPOSITORY}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=`)) return { workflow_runs: structuredClone(state.runList) };
    if (path.startsWith(`repos/${REPOSITORY}/compare/`)) return structuredClone(state.comparison);
    return baseApi(method, path, body);
  };
  state.recover = async (options = {}) => (await helpers).recoverAfterMain({ ...state, now: () => state.now, timeoutMs: 10, pollMs: 5, ...options });
  return state;
}

test('current successful main CI recovers a signed release head with failed PR checks', async () => {
  const state = await recoveryFixture();
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const result = await state.recover();
  assert.equal(result.main, MAIN);
  assert.equal(result.results[0].requested, true);
  assert.equal(result.results[0].failed_run_id, 456);
  assert.equal(result.results[0].failed_run_attempt, 2);
  assert.deepEqual(state.writes, [{ method: 'POST', path: `repos/${REPOSITORY}/issues/892/comments`, body: { body: state.body } }]);
  assert.ok(state.calls.every(({ method }) => method === 'GET'));
});

test('successful main CI dispatched after an automated merge can recover failed updates', async () => {
  const state = await recoveryFixture();
  state.mainRun.event = 'workflow_dispatch';
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.recover()).results[0].requested, true);
  assert.equal(state.writes.length, 1);
});

test('main recovery rebases a reviewed JavaScript root update with failed exact-head checks', async () => {
  const state = await recoveryFixture({ scope: 'root' });
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const result = await state.recover();
  assert.equal(result.results[0].requested, true);
  assert.equal(result.results[0].failed_run_id, 456);
  assert.equal(state.writes.length, 1);
});

test('main recovery reports native root updates as manual without posting a rebase', async () => {
  const state = await recoveryFixture({ scope: 'root' });
  state.baseManifests['package.json'].dependencies = { 'react-native': '0.88.0-rc.3' };
  state.headManifests['package.json'].dependencies = { 'react-native': '0.88.0-rc.4' };
  const result = await state.recover();
  assert.equal(result.results[0].requested, false);
  assert.equal(result.results[0].blocked, undefined);
  assert.match(result.results[0].reason, /react-native|manual|review/);
  assert.equal(state.writes.length, 0);
});

test('healthy JavaScript root updates remain with ordinary maintenance during main recovery', async () => {
  const state = await recoveryFixture({ scope: 'root' });
  state.run.conclusion = 'success';
  const result = await state.recover();
  assert.equal(result.results[0].requested, false);
  assert.equal(result.results[0].reason, 'Current-head CI has no completed failed required check.');
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['non-default execution branch', (s) => { s.env.GITHUB_REF = 'refs/heads/test'; }],
  ['manual dispatch', (s) => { s.env.GITHUB_EVENT_NAME = 'workflow_dispatch'; }],
  ['pull-request source event', (s) => { s.mainRun.event = 'pull_request'; }],
  ['failed main', (s) => { s.mainRun.conclusion = 'failure'; }],
  ['incomplete main', (s) => { s.mainRun.status = 'in_progress'; }],
  ['another main branch', (s) => { s.mainRun.head_branch = 'other'; }],
  ['another workflow', (s) => { s.mainRun.workflow_id += 1; }],
  ['another workflow path', (s) => { s.mainRun.path = '.github/workflows/other.yml'; }],
  ['fork run', (s) => { s.mainRun.head_repository.full_name = 'someone/yify'; }],
  ['repository ID mismatch', (s) => { s.mainRun.head_repository.id += 1; }],
  ['missing repository ID', (s) => { delete s.mainRun.repository.id; }],
  ['older main', (s) => { s.main.object.sha = NEXT; }],
  ['different checkout', (s) => { s.env.GITHUB_SHA = NEXT; }],
  ['stale run attempt', (s) => { s.mainRun.run_attempt += 1; }],
  ['missing attempt', (s) => { delete s.env.SOURCE_RUN_ATTEMPT; }],
  ['failed required main job', (s) => { s.mainJobs[0].conclusion = 'failure'; }],
  ['missing required main job', (s) => { s.mainJobs.pop(); }],
  ['duplicate required main job', (s) => { s.mainJobs.push(s.mainJobs[0]); }],
  ['skipped dependency context', (s) => { s.mainJobs.at(-1).conclusion = 'skipped'; }],
]) test(`main recovery rejects ${label} before writing`, async () => {
  const state = await recoveryFixture(); mutate(state);
  await assert.rejects(() => state.recover());
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['closed', (s) => { s.prs[0].state = 'closed'; }],
  ['draft', (s) => { s.prs[0].draft = true; }],
  ['foreign author', (s) => { s.prs[0].user.login = 'someone'; }],
  ['foreign repository', (s) => { s.prs[0].head.repo.full_name = 'someone/yify'; }],
  ['foreign repository ID', (s) => { s.prs[0].head.repo.id += 1; }],
  ['Actions dependency', (s) => { s.prs[0].head.ref = 'dependabot/github_actions/actions/checkout-8'; }],
]) test(`main recovery excludes ${label} proposals`, async () => {
  const state = await recoveryFixture(); mutate(state);
  assert.deepEqual((await state.recover()).results, []);
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['unsigned source', (s) => { s.original.commit.verification.verified = false; }],
  ['mixed-scope source', (s) => { s.original.files.push({ filename: 'package.json', status: 'modified' }); }],
  ['manual followup', (s) => { s.refresh.author.login = 'kunal26das'; }],
  ['changed repository identity', (s) => { s.pr.head.repo.id += 1; }],
  ['unsigned followup', (s) => { s.refresh.commit.verification.verified = false; }],
  ['unverified lockfile contents', (s) => { s.lock = Buffer.from('changed'); }],
  ['unknown ancestry', (s) => { delete s.comparison.ahead_by; }],
  ['different compared head', (s) => { s.comparison.base_commit.sha = NEXT; }],
  ['different failed CI head', (s) => { s.run.head_sha = NEXT; }],
  ['different failed CI workflow', (s) => { s.run.workflow_id += 1; }],
  ['foreign failed CI actor', (s) => { s.run.actor.login = 'someone'; }],
  ['wrong failed CI PR association', (s) => { s.run.pull_requests[0].number += 1; }],
  ['missing failed required job', (s) => { s.jobs.pop(); }],
]) test(`main recovery never rebases ${label}`, async () => {
  const state = await recoveryFixture(); mutate(state);
  const result = await state.recover();
  assert.ok(result.results.every((item) => !item.requested));
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['up-to-date head', (s) => { s.comparison.ahead_by = 0; s.comparison.status = 'behind'; }],
  ['healthy head', (s) => { s.run.conclusion = 'success'; }],
  ['running head', (s) => { s.run.status = 'in_progress'; }],
  ['cancelled head', (s) => { s.run.conclusion = 'cancelled'; }],
  ['unrelated failed job', (s) => { s.jobs[0].conclusion = 'success'; }],
  ['missing head CI', (s) => { s.runList = []; }],
]) test(`main recovery leaves ${label} to its ordinary maintenance`, async () => {
  const state = await recoveryFixture(); mutate(state);
  const result = await state.recover();
  assert.equal(result.results[0].requested, false);
  assert.equal(result.results[0].blocked, undefined);
  assert.equal(state.writes.length, 0);
});

test('main recovery aborts when a fresh successful attempt replaces failed CI before posting', async () => {
  const state = await recoveryFixture();
  state.beforeApi = async (_method, path) => {
    if (path.includes('/issues/892/comments?')) { state.run.run_attempt += 1; state.run.conclusion = 'success'; }
  };
  const result = await state.recover();
  assert.match(result.results[0].reason, /CI changed/);
  assert.equal(state.writes.length, 0);
});

test('main recovery aborts when its main source is rerun after initial verification', async () => {
  const state = await recoveryFixture();
  state.beforeApi = async (_method, path) => {
    if (path.includes('/issues/892/comments?')) state.mainRun.run_attempt += 1;
  };
  const result = await state.recover();
  assert.match(result.results[0].reason, /latest successful CI attempt/);
  assert.equal(state.writes.length, 0);
});

test('main recovery rechecks the current main and PR head immediately before posting', async () => {
  for (const mutate of [(s) => { s.main.object.sha = NEXT; }, (s) => { s.pr.head.sha = NEXT; }]) {
    const state = await recoveryFixture();
    state.beforeApi = async (_method, path) => { if (path.includes('/issues/892/comments?')) mutate(state); };
    const result = await state.recover();
    assert.equal(result.results[0].blocked, true);
    assert.equal(state.writes.length, 0);
  }
});

test('main recovery reuses the exact owner marker without duplicate comments', async () => {
  const state = await recoveryFixture(); state.comments.push(state.comment());
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.recover()).results[0].requested, true);
  assert.equal((await state.recover()).results[0].requested, true);
  assert.equal(state.writes.length, 0);
});

test('pending recovery is bounded and a repeated main event observes it without reposting', async () => {
  const state = await recoveryFixture();
  assert.equal((await state.recover()).results[0].blocked, true);
  assert.equal((await state.recover()).results[0].blocked, true);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.waits, [5, 5, 5, 5]);
});

test('main recovery accepts a newly signed head and never merges or approves it', async () => {
  const state = await recoveryFixture(); state.onPost = state.rebase;
  const result = await state.recover();
  assert.equal(result.results[0].acknowledgement, 'signed-head');
  assert.equal(result.results[0].new_head, NEXT);
  assert.equal(state.writes.length, 1);
  assert.ok(state.calls.every(({ method }) => method === 'GET'));
});

test('recovery summary identifies blocked requests without claiming a merge', async (t) => {
  const state = await recoveryFixture();
  const directory = await mkdtemp(join(tmpdir(), 'dependabot-main-recovery-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  state.env.GITHUB_STEP_SUMMARY = join(directory, 'summary');
  await state.recover();
  const text = await readFile(state.env.GITHUB_STEP_SUMMARY, 'utf8');
  assert.match(text, /actions\/runs\/999\/attempts\/1/);
  assert.match(text, /Fresh PR checks and lockfile verification still control merging/);
  assert.match(text, /#892: Dependabot has not acknowledged/);
});

test('the recovery job uses read-only built-in credentials and handles successful main push or dispatched CI', async () => {
  const { load } = require('js-yaml');
  const workflow = load(await readFile(join(__dirname, '../.github/workflows/dependabot-maintenance.yml'), 'utf8'));
  const job = workflow.jobs['recover-main'];
  assert.match(job.if, /push/);
  assert.match(job.if, /workflow_dispatch/);
  assert.match(job.if, /github.event.workflow_run.conclusion == 'success'/);
  assert.match(job.if, /github.event.workflow_run.head_branch == 'main'/);
  assert.deepEqual(job.permissions, { contents: 'read', 'pull-requests': 'read', actions: 'read' });
  assert.equal(job.concurrency.queue, 'max');
  assert.equal(job.concurrency['cancel-in-progress'], false);
  assert.notEqual(job.concurrency.group, workflow.concurrency.group);
  assert.equal(job.steps.filter((step) => step.env?.DEPENDABOT_REBASE_TOKEN).length, 1);
  assert.equal(job.steps[0].with.ref, '${{ github.sha }}');
  assert.ok(job.steps.some((step) => step.run === 'node scripts/dependabot-refresh.mjs recover-main'));
});

test('main recovery selects the newest exact-head CI run instead of an older failure', async () => {
  const state = await recoveryFixture();
  const latest = { ...structuredClone(state.run), id: 777, conclusion: 'success' };
  state.runList = [state.run, latest];
  const api = state.api;
  state.api = async (method, path, body) => path === `repos/${REPOSITORY}/actions/runs/777` ? latest : api(method, path, body);
  assert.equal((await state.recover()).results[0].requested, false);
  assert.equal(state.writes.length, 0);
});

test('one rejected release proposal cannot prevent inspecting another eligible update', async () => {
  const state = await recoveryFixture();
  state.prs.unshift({ ...structuredClone(state.pr), number: 891 });
  const api = state.api;
  state.api = async (method, path, body) => path === `repos/${REPOSITORY}/pulls/891`
    ? { ...structuredClone(state.prs[0]), user: { login: 'someone' } } : api(method, path, body);
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  const result = await state.recover();
  assert.equal(result.results[0].blocked, true);
  assert.equal(result.results[1].requested, true);
  assert.equal(state.writes.length, 1);
});

test('main recovery bounds the npm dependency backlog before posting any requests', async () => {
  const state = await recoveryFixture();
  state.prs = Array.from({ length: 21 }, (_, index) => ({ ...structuredClone(state.pr), number: 900 + index }));
  await assert.rejects(() => state.recover(), /More than 20/);
  assert.equal(state.writes.length, 0);
});


for (const status of ['behind', 'dirty']) test(`green PR ${status} after main advances requests a verified rebase`, async () => {
  const state = await fixture(); state.pr.mergeable_state = status;
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 1);
  assert.ok(state.calls.some(({ path }) => path === `repos/${REPOSITORY}/compare/${HEAD}...${MAIN}?per_page=1`));
});

for (const status of ['behind', 'dirty']) test(`green PR ${status} without new main commits is not rebased`, async () => {
  const state = await fixture(); state.pr.mergeable_state = status;
  state.comparison = { base_commit: { sha: HEAD }, ahead_by: 0, status: 'behind' };
  assert.equal((await state.observe()).requested, false);
  assert.equal(state.writes.length, 0);
});

test('a conflicted PR with failed checks cannot use the green-PR rebase path', async () => {
  const state = await fixture(); state.pr.mergeable_state = 'dirty'; state.jobs[0].conclusion = 'failure';
  await assert.rejects(() => state.observe());
  assert.equal(state.writes.length, 0);
});

for (const [label, mutate] of [
  ['main changes during ancestry lookup', (s) => { s.main.object.sha = NEXT; }],
  ['head changes during ancestry lookup', (s) => { s.pr.head.sha = NEXT; }],
  ['comparison refers to another head', (s) => { s.comparison.base_commit.sha = NEXT; }],
  ['comparison is missing ancestry counts', (s) => { delete s.comparison.ahead_by; }],
]) test(`green-PR conflict recovery aborts when ${label}`, async () => {
  const state = await fixture(); state.pr.mergeable_state = 'dirty';
  state.beforeApi = async (_method, path) => { if (path.includes('/compare/')) mutate(state); };
  await assert.rejects(() => state.observe());
  assert.equal(state.writes.length, 0);
});

test('a repeated green-PR conflict request observes the owner marker without another comment', async () => {
  const state = await fixture(); state.pr.mergeable_state = 'dirty'; state.comments.push(state.comment());
  state.reactions.push({ content: '+1', user: { login: 'dependabot[bot]' } });
  assert.equal((await state.observe()).requested, true);
  assert.equal(state.writes.length, 0);
});

test('the merge step invokes guarded rebase for behind and conflicted PRs', async () => {
  const { load } = require('js-yaml');
  const workflow = load(await readFile(join(__dirname, '../.github/workflows/dependabot-maintenance.yml'), 'utf8'));
  const step = workflow.jobs.maintain.steps.find((candidate) => candidate.id === 'merge');
  assert.match(step.run, /mergeable_state == "behind" or \.mergeable_state == "dirty"/);
  assert.ok(step.run.indexOf('inspect-maintenance') < step.run.indexOf('node scripts/dependabot-refresh.mjs'));
  assert.match(step.run, /--match-head-commit "\$PR_HEAD_SHA"/);
});

test('the workflow explains a final manual review decision without interpolating it into shell code', async () => {
  const { load } = require('js-yaml');
  const workflow = load(await readFile(join(__dirname, '../.github/workflows/dependabot-maintenance.yml'), 'utf8'));
  const step = workflow.jobs.maintain.steps.find((candidate) => candidate.env?.AUTOMERGE_REASON);
  assert.match(step.if, /steps\.inspect\.outputs\.automerge == 'false'/);
  assert.match(step.if, /steps\.publish\.outputs\.changed == 'true'/);
  assert.equal(step.env.AUTOMERGE_REASON, '${{ steps.inspect.outputs.automerge_reason || steps.publish.outputs.automerge_reason }}');
  assert.match(step.run, /process\.env\.GITHUB_STEP_SUMMARY/);
  assert.match(step.run, /process\.env\.AUTOMERGE_REASON/);
  assert.doesNotMatch(step.run, /\$\{\{/);
});

test('the workflow uses final published eligibility for both repaired and regressed lockfiles', async () => {
  const { load } = require('js-yaml');
  const { runInNewContext } = require('node:vm');
  const workflow = load(await readFile(join(__dirname, '../.github/workflows/dependabot-maintenance.yml'), 'utf8'));
  const stepsById = Object.fromEntries(workflow.jobs.maintain.steps.filter((step) => step.id).map((step) => [step.id, step]));
  const explain = workflow.jobs.maintain.steps.find((step) => step.env?.AUTOMERGE_REASON);
  const evaluate = (step, source, published, inspected = '') => runInNewContext(`(${step.if})`, { steps: {
    prepare: { outputs: { ready: 'true', automerge: source, checks_passed: 'true', operation: 'publish' } },
    publish: { outputs: { changed: 'true', automerge: published } },
    followup: { outputs: { ready: 'true' } },
    inspect: { outputs: { automerge: inspected } },
  } });
  for (const step of [stepsById.followup, stepsById.inspect]) {
    assert.equal(evaluate(step, 'false', 'true'), true, 'A repaired lockfile must reach its exact-head checks.');
    assert.equal(evaluate(step, 'true', 'false'), false, 'An unsafe regenerated lockfile must override earlier eligibility.');
    assert.equal(evaluate(step, 'true', ''), true, 'Existing source eligibility remains the fallback without a published decision.');
    assert.equal(evaluate(step, 'false', ''), false);
  }
  assert.equal(evaluate(explain, 'true', 'false'), true);
  assert.equal(evaluate(explain, 'false', 'true', 'false'), true);
  assert.equal(evaluate(explain, 'false', 'true', 'true'), false);
  assert.equal(evaluate(explain, 'false', 'false'), false);
});
