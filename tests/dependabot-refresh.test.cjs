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

async function fixture() {
  const { digest, commitMessage } = await lockfile;
  const repo = { id: REPOSITORY_ID, full_name: REPOSITORY };
  const pr = { number: 892, state: 'open', merged: false, draft: false, user: { login: 'dependabot[bot]' }, commits: 2,
    head: { sha: HEAD, ref: 'dependabot/npm_and_yarn/release/types/node-26.6.2', repo: { ...repo } },
    base: { ref: 'main', repo: { ...repo } }, mergeable_state: 'behind' };
  const metadata = { version: 2, repository: REPOSITORY, scope: 'release', lockfile: 'release/yarn.lock',
    pr: 892, source: SOURCE, run_id: '123', run_attempt: '1', lockfile_sha256: digest(LOCK) };
  const original = { sha: SOURCE, author: { login: 'dependabot[bot]' }, commit: { verification: { verified: true }, tree: { sha: TREE } },
    parents: [{ sha: MAIN }], files: [{ filename: 'release/package.json', status: 'modified' }, { filename: 'release/yarn.lock', status: 'modified' }] };
  const refresh = { sha: HEAD, author: { login: 'github-actions[bot]' }, committer: { login: 'web-flow' },
    commit: { verification: { verified: true }, tree: { sha: TREE }, message: commitMessage(metadata) },
    parents: [{ sha: SOURCE }], files: [{ filename: 'release/yarn.lock', status: 'modified' }] };
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
  const state = { env, pr, run, sourceRun, jobs, original, refresh, next, comments: [], reactions: [], writes: [],
    calls: [], main: { ref: 'refs/heads/main', object: { type: 'commit', sha: MAIN } },
    owner: { login: 'kunal26das', type: 'User' }, nextCommentId: 100, now: 0, waits: [] };
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
    if (path === `repos/${REPOSITORY}/git/trees/${TREE}`) return { truncated: false, tree: [{ path: 'release', type: 'tree', mode: '040000', sha: RELEASE_TREE }] };
    if (path === `repos/${REPOSITORY}/git/trees/${RELEASE_TREE}`) return { truncated: false, tree: [{ path: 'yarn.lock', type: 'blob', mode: '100644' }] };
    if (path === `repos/${REPOSITORY}/contents/release/yarn.lock?ref=${HEAD}`) return { type: 'file', encoding: 'base64', content: (state.lock || LOCK).toString('base64') };
    if (path === `repos/${REPOSITORY}/actions/workflows/ci.yml`) return { id: 12, path: '.github/workflows/ci.yml' };
    if (path === `repos/${REPOSITORY}/actions/runs/456` || path === `repos/${REPOSITORY}/actions/runs/456/attempts/2`) return structuredClone(run);
    if (path === `repos/${REPOSITORY}/actions/runs/123/attempts/1`) return structuredClone(sourceRun);
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/456/attempts/2/jobs?`)) return { jobs: structuredClone(jobs) };
    if (path.startsWith(`repos/${REPOSITORY}/actions/runs/123/attempts/1/jobs?`)) return { jobs: [{ name: 'Dependabot clean reinstall (release)', status: 'completed', conclusion: 'success' }] };
    if (path === `repos/${REPOSITORY}/git/ref/heads/main`) return structuredClone(state.main);
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
