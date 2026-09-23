import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const INTEGER = /^[1-9][0-9]*$/;
const TITLE = 'chore(deps): commit regenerated yarn.lock [dependabot skip]';
const HEAD_PROPAGATION_DELAYS = [1000, 2000, 4000, 8000, 15000];
const SCOPES = {
  root: { lockfile: 'yarn.lock', manifests: ['package.json', 'crashreporting/package.json'] },
  release: { lockfile: 'release/yarn.lock', manifests: ['release/package.json'] },
};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function commitMessage(metadata) {
  const scope = metadata.version === 1 ? '' : `Dependency-Scope: ${metadata.scope}\nLockfile-Path: ${metadata.lockfile}\n`;
  return `${TITLE}\n\n${scope}Dependabot-Source: ${metadata.source}\nDependabot-PR: ${metadata.pr}\nActions-Run: ${metadata.run_id}\nActions-Attempt: ${metadata.run_attempt}\nLockfile-SHA256: ${metadata.lockfile_sha256}`;
}

function readMessage(message, repository) {
  const match = message.match(/^chore\(deps\): commit regenerated yarn\.lock \[dependabot skip\]\n\n(?:Dependency-Scope: (root|release)\nLockfile-Path: (yarn\.lock|release\/yarn\.lock)\n)?Dependabot-Source: ([a-f0-9]{40})\nDependabot-PR: ([1-9][0-9]*)\nActions-Run: ([1-9][0-9]*)\nActions-Attempt: ([1-9][0-9]*)\nLockfile-SHA256: ([a-f0-9]{64})$/);
  assert(match, 'The additional commit is not a recognized lockfile refresh.');
  return { version: match[1] ? 2 : 1, repository, scope: match[1] || 'root', lockfile: match[2] || 'yarn.lock',
    source: match[3], pr: Number(match[4]), run_id: match[5], run_attempt: match[6], lockfile_sha256: match[7] };
}

function scopeConfig(scope) {
  assert(Object.hasOwn(SCOPES, scope), 'Unsupported dependency scope.');
  return SCOPES[scope];
}

function context(env) {
  assert(env.GITHUB_REPOSITORY === 'kunal26das/yify', 'Unexpected repository.');
  assert(INTEGER.test(env.PR_NUMBER || ''), 'Invalid pull request number.');
  assert(SHA.test(env.PR_HEAD_SHA || ''), 'Invalid expected pull request head.');
  return { repository: env.GITHUB_REPOSITORY, pr: Number(env.PR_NUMBER), expected: env.PR_HEAD_SHA };
}

function validateMetadata(value, env) {
  const ctx = context(env);
  assert(value && [1, 2].includes(value.version) && value.repository === ctx.repository && value.pr === ctx.pr,
    'Lockfile metadata does not identify this pull request.');
  assert(SHA.test(value.source || '') && INTEGER.test(value.run_id || '') && INTEGER.test(value.run_attempt || '') && DIGEST.test(value.lockfile_sha256 || ''),
    'Invalid lockfile provenance metadata.');
  const scope = value.scope || (value.version === 1 ? 'root' : undefined);
  const lockfile = value.lockfile || (value.version === 1 ? 'yarn.lock' : undefined);
  assert(lockfile === scopeConfig(scope).lockfile && (value.version !== 1 || scope === 'root'), 'Lockfile provenance has an invalid scope or path.');
  return { ...value, scope, lockfile };
}

export function githubApi(token, fetchImpl = fetch) {
  assert(token, 'GH_TOKEN is required.');
  return async (method, path, body) => {
    const response = await fetchImpl(`https://api.github.com/${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    assert(response.ok, `GitHub ${method} ${path} failed (${response.status}).`);
    if (response.status === 204) return null;
    const result = await response.json();
    assert(!result.errors?.length, `GitHub GraphQL request failed: ${result.errors?.map((item) => item.message).join('; ')}`);
    return result;
  };
}

async function list(api, path, key) {
  const result = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const values = key ? response[key] : response;
    assert(Array.isArray(values), 'Unexpected GitHub list response.');
    result.push(...values);
    if (values.length < 100) return result;
  }
  throw new Error('GitHub list exceeds the supported size.');
}

async function lockfile(api, repository, sha, scope) {
  const path = scopeConfig(scope).lockfile;
  const file = await api('GET', `repos/${repository}/contents/${path}?ref=${sha}`);
  assert(file.type === 'file' && file.encoding === 'base64' && typeof file.content === 'string', `Unable to read the committed ${path}.`);
  return Buffer.from(file.content, 'base64');
}

async function regularLockfile(api, repository, commit, scope) {
  assert(SHA.test(commit.commit?.tree?.sha || ''), 'Commit tree identity is missing.');
  const parts = scopeConfig(scope).lockfile.split('/');
  let sha = commit.commit.tree.sha;
  for (const [index, part] of parts.entries()) {
    const tree = await api('GET', `repos/${repository}/git/trees/${sha}`);
    assert(!tree.truncated && Array.isArray(tree.tree), 'Unable to inspect the complete lockfile tree.');
    const entries = tree.tree.filter((entry) => entry.path === part);
    const leaf = index === parts.length - 1;
    assert(entries.length === 1 && entries[0].type === (leaf ? 'blob' : 'tree') && entries[0].mode === (leaf ? '100644' : '040000'),
      `${scopeConfig(scope).lockfile} must be a regular, non-executable file under real directories.`);
    sha = entries[0].sha;
    if (!leaf) assert(SHA.test(sha || ''), 'Lockfile directory identity is missing.');
  }
}

async function successfulSourceRun(api, repository, metadata) {
  const [run, workflow, jobs] = await Promise.all([
    api('GET', `repos/${repository}/actions/runs/${metadata.run_id}/attempts/${metadata.run_attempt}`),
    api('GET', `repos/${repository}/actions/workflows/ci.yml`),
    list(api, `repos/${repository}/actions/runs/${metadata.run_id}/attempts/${metadata.run_attempt}/jobs`, 'jobs'),
  ]);
  assert(run.workflow_id === workflow.id && run.head_sha === metadata.source && run.head_repository?.full_name === repository &&
    ['pull_request', 'workflow_dispatch'].includes(run.event) && String(run.run_attempt) === metadata.run_attempt,
  'The refresh provenance does not identify CI on the original Dependabot commit.');
  for (const name of [metadata.version === 1 ? 'Dependabot clean reinstall' : `Dependabot clean reinstall (${metadata.scope})`]) {
    const matches = jobs.filter((job) => job.name === name);
    assert(matches.length === 1 && matches[0].conclusion === 'success', `Source CI check has not succeeded: ${name}.`);
  }
}

/** Re-read server state; caller never supplies commit authors, files, or signatures. */
export async function inspect({ api, env, allowPublishedHead = false, allowManual = false }) {
  const ctx = context(env);
  const pr = await api('GET', `repos/${ctx.repository}/pulls/${ctx.pr}`);
  const open = pr.state === 'open' && !pr.merged;
  const alreadyMerged = env.ALLOW_MERGED === 'true' && pr.merged === true && pr.merged_by?.login === 'github-actions[bot]';
  assert(pr.number === ctx.pr && (open || alreadyMerged) && !pr.draft && pr.user?.login === 'dependabot[bot]' &&
    pr.head?.repo?.full_name === ctx.repository && pr.base?.repo?.full_name === ctx.repository && pr.base.ref === 'main' &&
    typeof pr.head.ref === 'string' && pr.head.ref.startsWith('dependabot/') && !/[\r\n]/.test(pr.head.ref),
  'Pull request is not an open, same-repository Dependabot update targeting main.');
  assert(Number.isInteger(pr.commits) && pr.commits > 0, 'The pull request commit count is invalid.');
  const commits = await list(api, `repos/${ctx.repository}/pulls/${ctx.pr}/commits`);
  assert(commits.length === pr.commits && commits.at(-1).sha === pr.head.sha, 'Pull request changed while inspecting its commits.');
  const source = commits[0];
  assert(source.author?.login === 'dependabot[bot]' && source.commit?.verification?.verified === true && SHA.test(source.sha),
    'The original Dependabot commit must have a verified signature.');
  const original = await api('GET', `repos/${ctx.repository}/commits/${source.sha}?per_page=100`);
  assert(original.sha === source.sha && original.author?.login === 'dependabot[bot]' && original.commit?.verification?.verified === true &&
    original.parents?.length === 1, 'The original commit identity, signature, or ancestry is invalid.');
  assert(Array.isArray(original.files) && original.files.length > 0 &&
    new Set(original.files.map((file) => file.filename)).size === original.files.length && original.files.every((file) =>
    file.status === 'modified'), 'The original update must contain unique, modified dependency files.');
  const files = original.files.map((file) => file.filename);
  const scope = Object.keys(SCOPES).find((name) => files.every((file) => [SCOPES[name].lockfile, ...SCOPES[name].manifests].includes(file)));
  const actionsUpdate = files.every((file) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(file));
  assert(scope || actionsUpdate, 'The original update must modify only one supported dependency scope.');
  const manualState = (reason) => {
    assert(pr.head.sha === ctx.expected, 'Manual dependency update head changed; refusing stale results.');
    assert(env.GITHUB_EVENT_NAME !== 'workflow_dispatch' || env.GITHUB_SHA === ctx.expected,
      'The dispatched workflow is not running on the expected pull request head.');
    return { eligible: false, automerge: false, pr: ctx.pr, head: pr.head.sha, source: source.sha, branch: pr.head.ref, refreshed: false,
      pull_request: pr, scope: scope || 'github-actions', lockfile: scope ? scopeConfig(scope).lockfile : '', reason };
  };
  if (actionsUpdate) return manualState('GitHub Actions updates require manual review.');
  let provenance;
  try {
    assert([1, 2].includes(pr.commits), 'Only an original Dependabot commit and one lockfile refresh are allowed.');
    await regularLockfile(api, ctx.repository, original, scope);
    if (commits.length === 2) {
      const refreshed = await api('GET', `repos/${ctx.repository}/commits/${commits[1].sha}?per_page=100`);
      assert(refreshed.sha === commits[1].sha && refreshed.author?.login === 'github-actions[bot]' && refreshed.committer?.login === 'web-flow' && refreshed.commit?.verification?.verified === true,
        'The lockfile refresh must be a GitHub-signed GitHub Actions commit.');
      assert(refreshed.parents?.length === 1 && refreshed.parents[0].sha === source.sha && refreshed.files?.length === 1 &&
        refreshed.files[0].filename === scopeConfig(scope).lockfile && refreshed.files[0].status === 'modified',
      'The additional commit must change only its scope lockfile directly on the original Dependabot commit.');
      await regularLockfile(api, ctx.repository, refreshed, scope);
      provenance = validateMetadata(readMessage(refreshed.commit.message, ctx.repository), env);
      assert(provenance.scope === scope, 'The lockfile refresh references another dependency scope.');
      assert(provenance.source === source.sha, 'The lockfile refresh references another source commit.');
      const [bytes] = await Promise.all([
        lockfile(api, ctx.repository, pr.head.sha, scope), successfulSourceRun(api, ctx.repository, provenance),
      ]);
      assert(digest(bytes) === provenance.lockfile_sha256, 'The committed lockfile does not match the refresh digest.');
    }
  } catch (error) {
    if (allowManual && commits.length > 1) return manualState(error.message);
    throw error;
  }
  assert(pr.head.sha === ctx.expected || (allowPublishedHead && provenance && source.sha === ctx.expected),
    'Pull request head changed; refusing to use stale results.');
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    assert(env.GITHUB_SHA === ctx.expected, 'The dispatched workflow is not running on the expected pull request head.');
  }
  return { eligible: true, automerge: scope === 'release', scope, lockfile: scopeConfig(scope).lockfile,
    pr: ctx.pr, head: pr.head.sha, source: source.sha, branch: pr.head.ref, refreshed: commits.length === 2, pull_request: pr, provenance };
}

export async function capture({ env, directory = env.LOCKFILE_REPORT_DIR }) {
  const ctx = context(env);
  assert(directory, 'LOCKFILE_REPORT_DIR is required.');
  assert(INTEGER.test(env.GITHUB_RUN_ID || '') && INTEGER.test(env.GITHUB_RUN_ATTEMPT || ''), 'Invalid Actions run identity.');
  const scope = env.DEPENDENCY_SCOPE;
  const { lockfile } = scopeConfig(scope);
  const bytes = await readFile(join(directory, 'regenerated-yarn.lock'));
  const metadata = { version: 2, scope, lockfile, repository: ctx.repository, pr: ctx.pr, source: ctx.expected,
    run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, lockfile_sha256: digest(bytes) };
  await writeFile(join(directory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

async function waitForPublishedHead({ api, ctx, state, newSha, wait }) {
  for (let attempt = 0; ; attempt += 1) {
    const current = await api('GET', `repos/${ctx.repository}/pulls/${ctx.pr}`);
    const unchanged = current.number === ctx.pr && current.state === 'open' && !current.merged && !current.draft &&
      current.user?.login === 'dependabot[bot]' && current.head?.ref === state.branch && current.head?.repo?.full_name === ctx.repository &&
      current.base?.ref === 'main' && current.base?.repo?.full_name === ctx.repository;
    assert(unchanged, 'Pull request changed before follow-up CI could be dispatched.');
    if (current.head.sha === newSha) return;
    assert(!state.refreshed && current.head.sha === state.head,
      'Pull request changed before follow-up CI could be dispatched.');
    assert(attempt < HEAD_PROPAGATION_DELAYS.length,
      'GitHub has not exposed the new lockfile commit on the pull request yet. Rerun this failed job to retry without creating another commit.');
    await wait(HEAD_PROPAGATION_DELAYS[attempt]);
  }
}

export async function publish({ api, env, directory = env.LOCKFILE_REPORT_DIR, wait = delay }) {
  assert(directory, 'LOCKFILE_REPORT_DIR is required.');
  const ctx = context(env);
  const [original, regenerated, text] = await Promise.all([
    readFile(join(directory, 'original-yarn.lock')), readFile(join(directory, 'regenerated-yarn.lock')), readFile(join(directory, 'metadata.json'), 'utf8'),
  ]);
  const metadata = validateMetadata(JSON.parse(text), env);
  assert(metadata.source === ctx.expected && metadata.run_id === env.GITHUB_RUN_ID && metadata.run_attempt === (env.SOURCE_RUN_ATTEMPT || env.GITHUB_RUN_ATTEMPT),
    'Artifact was not produced for this source commit and workflow attempt.');
  assert(regenerated.length > 0 && regenerated.length <= 10 * 1024 * 1024 && digest(regenerated) === metadata.lockfile_sha256,
    'Regenerated lockfile is empty, oversized, or differs from its recorded digest.');
  const state = await inspect({ api, env: { ...env, ALLOW_MERGED: 'false' }, allowPublishedHead: true });
  assert(state.eligible, 'Only verified npm updates can publish regenerated lockfiles.');
  assert(state.scope === metadata.scope && state.lockfile === metadata.lockfile, 'Artifact refers to another dependency scope or lockfile.');
  assert(state.source === metadata.source, 'Artifact refers to another Dependabot source.');
  const committed = await lockfile(api, ctx.repository, metadata.source, state.scope);
  assert(original.equals(committed), 'Original artifact lockfile differs from the source commit.');
  await successfulSourceRun(api, ctx.repository, metadata);
  if (original.equals(regenerated)) {
    assert(!state.refreshed, 'An unchanged artifact cannot explain the existing refresh commit.');
    return { changed: false, new_sha: state.head };
  }
  let newSha = state.head;
  if (state.refreshed) {
    assert(commitMessage(state.provenance) === commitMessage(metadata), 'Existing refresh was produced by another workflow attempt or artifact.');
  } else {
    const message = commitMessage(metadata);
    const response = await api('POST', 'graphql', {
      query: 'mutation($input: CreateCommitOnBranchInput!) { createCommitOnBranch(input: $input) { commit { oid } } }',
      variables: { input: {
        branch: { repositoryNameWithOwner: ctx.repository, branchName: state.branch }, expectedHeadOid: state.head,
        message: { headline: TITLE, body: message.slice(TITLE.length + 2) },
        fileChanges: { additions: [{ path: state.lockfile, contents: regenerated.toString('base64') }] },
      } },
    });
    newSha = response.data?.createCommitOnBranch?.commit?.oid;
    assert(SHA.test(newSha || ''), 'GitHub did not return a lockfile commit SHA.');
  }
  await waitForPublishedHead({ api, ctx, state, newSha, wait });
  await api('POST', `repos/${ctx.repository}/actions/workflows/ci.yml/dispatches`, {
    ref: state.branch, inputs: { dependabot_pr: String(ctx.pr), dependabot_head: newSha },
  });
  return { changed: true, new_sha: newSha };
}

async function writeOutputs(env, values) {
  assert(env.GITHUB_OUTPUT, 'GITHUB_OUTPUT is required.');
  for (const [key, value] of Object.entries(values)) {
    assert(!/[\r\n]/.test(String(value)), 'Invalid multiline workflow output.');
    await appendFile(env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}

export async function main(mode, env = process.env) {
  if (mode === 'capture') return capture({ env });
  const api = githubApi(env.GH_TOKEN);
  if (mode === 'inspect') {
    const state = await inspect({ api, env, allowManual: env.ALLOW_MANUAL_DEPENDENCY_UPDATES === 'true' });
    assert(env.RUNNER_TEMP, 'RUNNER_TEMP is required.');
    await mkdir(env.RUNNER_TEMP, { recursive: true });
    const directory = await mkdtemp(join(env.RUNNER_TEMP, 'dependabot-event-'));
    const eventFile = join(directory, 'event.json');
    await writeFile(eventFile, JSON.stringify({ pull_request: state.pull_request }), { mode: 0o600 });
    await writeOutputs(env, { eligible: state.eligible, automerge: state.automerge, scope: state.scope, lockfile: state.lockfile,
      pr: state.pr, head: state.head, source: state.source, branch: state.branch, refreshed: state.refreshed, event_file: eventFile });
    if (state.reason) console.log(`Dependency automation skipped: ${state.reason}`);
    return state;
  }
  if (mode === 'publish') {
    const result = await publish({ api, env });
    await writeOutputs(env, result);
    return result;
  }
  throw new Error('Expected inspect, capture, or publish mode.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
