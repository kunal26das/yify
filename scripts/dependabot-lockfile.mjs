import { createHash } from 'node:crypto';
import { appendFile, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const SHA = /^[a-f0-9]{40}$/;
const DIGEST = /^[a-f0-9]{64}$/;
const INTEGER = /^[1-9][0-9]*$/;
// The clean job validates the replacement with typechecks, tests, Expo checks, and both web exports.
// Frozen-lock CI may fail because this is the lockfile repair that it needs. New-head CI still gates merge.
const CHECKS = ['Dependabot clean reinstall'];
const TITLE = 'chore(deps): commit regenerated yarn.lock [dependabot skip]';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function commitMessage(metadata) {
  return `${TITLE}\n\nDependabot-Source: ${metadata.source}\nDependabot-PR: ${metadata.pr}\nActions-Run: ${metadata.run_id}\nActions-Attempt: ${metadata.run_attempt}\nLockfile-SHA256: ${metadata.lockfile_sha256}`;
}

function readMessage(message, repository) {
  const match = message.match(/^chore\(deps\): commit regenerated yarn\.lock \[dependabot skip\]\n\nDependabot-Source: ([a-f0-9]{40})\nDependabot-PR: ([1-9][0-9]*)\nActions-Run: ([1-9][0-9]*)\nActions-Attempt: ([1-9][0-9]*)\nLockfile-SHA256: ([a-f0-9]{64})$/);
  assert(match, 'The additional commit is not a recognized lockfile refresh.');
  return { version: 1, repository, source: match[1], pr: Number(match[2]), run_id: match[3], run_attempt: match[4], lockfile_sha256: match[5] };
}

function context(env) {
  assert(env.GITHUB_REPOSITORY === 'kunal26das/yify', 'Unexpected repository.');
  assert(INTEGER.test(env.PR_NUMBER || ''), 'Invalid pull request number.');
  assert(SHA.test(env.PR_HEAD_SHA || ''), 'Invalid expected pull request head.');
  return { repository: env.GITHUB_REPOSITORY, pr: Number(env.PR_NUMBER), expected: env.PR_HEAD_SHA };
}

function validateMetadata(value, env) {
  const ctx = context(env);
  assert(value && value.version === 1 && value.repository === ctx.repository && value.pr === ctx.pr,
    'Lockfile metadata does not identify this pull request.');
  assert(SHA.test(value.source || '') && INTEGER.test(value.run_id || '') && INTEGER.test(value.run_attempt || '') && DIGEST.test(value.lockfile_sha256 || ''),
    'Invalid lockfile provenance metadata.');
  return value;
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

async function lockfile(api, repository, sha) {
  const file = await api('GET', `repos/${repository}/contents/yarn.lock?ref=${sha}`);
  assert(file.type === 'file' && file.encoding === 'base64' && typeof file.content === 'string', 'Unable to read the committed yarn.lock.');
  return Buffer.from(file.content, 'base64');
}

async function regularLockfile(api, repository, commit) {
  assert(SHA.test(commit.commit?.tree?.sha || ''), 'Commit tree identity is missing.');
  const tree = await api('GET', `repos/${repository}/git/trees/${commit.commit.tree.sha}`);
  assert(!tree.truncated && Array.isArray(tree.tree), 'Unable to inspect the complete root tree.');
  const entries = tree.tree.filter((entry) => entry.path === 'yarn.lock');
  assert(entries.length === 1 && entries[0].type === 'blob' && entries[0].mode === '100644',
    'yarn.lock must be a regular, non-executable file.');
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
  for (const name of CHECKS) {
    const matches = jobs.filter((job) => job.name === name);
    assert(matches.length === 1 && matches[0].conclusion === 'success', `Source CI check has not succeeded: ${name}.`);
  }
}

/** Re-read server state; caller never supplies commit authors, files, or signatures. */
export async function inspect({ api, env, allowPublishedHead = false }) {
  const ctx = context(env);
  const pr = await api('GET', `repos/${ctx.repository}/pulls/${ctx.pr}`);
  const open = pr.state === 'open' && !pr.merged;
  const alreadyMerged = env.ALLOW_MERGED === 'true' && pr.merged === true && pr.merged_by?.login === 'github-actions[bot]';
  assert(pr.number === ctx.pr && (open || alreadyMerged) && !pr.draft && pr.user?.login === 'dependabot[bot]' &&
    pr.head?.repo?.full_name === ctx.repository && pr.base?.repo?.full_name === ctx.repository && pr.base.ref === 'main' &&
    typeof pr.head.ref === 'string' && pr.head.ref.startsWith('dependabot/') && !/[\r\n]/.test(pr.head.ref),
  'Pull request is not an open, same-repository Dependabot update targeting main.');
  assert([1, 2].includes(pr.commits), 'Only an original Dependabot commit and one lockfile refresh are allowed.');
  const commits = await list(api, `repos/${ctx.repository}/pulls/${ctx.pr}/commits`);
  assert(commits.length === pr.commits && commits.at(-1).sha === pr.head.sha, 'Pull request changed while inspecting its commits.');
  const source = commits[0];
  assert(source.author?.login === 'dependabot[bot]' && source.commit?.verification?.verified === true && SHA.test(source.sha),
    'The original Dependabot commit must have a verified signature.');
  const original = await api('GET', `repos/${ctx.repository}/commits/${source.sha}?per_page=100`);
  assert(original.sha === source.sha && original.author?.login === 'dependabot[bot]' && original.commit?.verification?.verified === true &&
    original.parents?.length === 1, 'The original commit identity, signature, or ancestry is invalid.');
  assert(Array.isArray(original.files) && original.files.length > 0 && original.files.length <= 2 &&
    new Set(original.files.map((file) => file.filename)).size === original.files.length && original.files.every((file) =>
    ['package.json', 'yarn.lock'].includes(file.filename) && file.status === 'modified'),
  'The original update must modify only package.json and/or yarn.lock.');
  await regularLockfile(api, ctx.repository, original);
  let provenance;
  if (commits.length === 2) {
    const refreshed = await api('GET', `repos/${ctx.repository}/commits/${commits[1].sha}?per_page=100`);
    assert(refreshed.sha === commits[1].sha && refreshed.author?.login === 'github-actions[bot]' && refreshed.committer?.login === 'web-flow' && refreshed.commit?.verification?.verified === true,
      'The lockfile refresh must be a GitHub-signed GitHub Actions commit.');
    assert(refreshed.parents?.length === 1 && refreshed.parents[0].sha === source.sha && refreshed.files?.length === 1 &&
      refreshed.files[0].filename === 'yarn.lock' && refreshed.files[0].status === 'modified',
    'The additional commit must change only yarn.lock directly on the original Dependabot commit.');
    await regularLockfile(api, ctx.repository, refreshed);
    provenance = validateMetadata(readMessage(refreshed.commit.message, ctx.repository), env);
    assert(provenance.source === source.sha, 'The lockfile refresh references another source commit.');
    const [bytes] = await Promise.all([
      lockfile(api, ctx.repository, pr.head.sha), successfulSourceRun(api, ctx.repository, provenance),
    ]);
    assert(digest(bytes) === provenance.lockfile_sha256, 'The committed lockfile does not match the refresh digest.');
  }
  assert(pr.head.sha === ctx.expected || (allowPublishedHead && provenance && source.sha === ctx.expected),
    'Pull request head changed; refusing to use stale results.');
  if (env.GITHUB_EVENT_NAME === 'workflow_dispatch') {
    assert(env.GITHUB_SHA === ctx.expected, 'The dispatched workflow is not running on the expected pull request head.');
  }
  return { pr: ctx.pr, head: pr.head.sha, source: source.sha, branch: pr.head.ref, refreshed: commits.length === 2, pull_request: pr, provenance };
}

export async function capture({ env, directory = env.LOCKFILE_REPORT_DIR }) {
  const ctx = context(env);
  assert(directory, 'LOCKFILE_REPORT_DIR is required.');
  assert(INTEGER.test(env.GITHUB_RUN_ID || '') && INTEGER.test(env.GITHUB_RUN_ATTEMPT || ''), 'Invalid Actions run identity.');
  const bytes = await readFile(join(directory, 'regenerated-yarn.lock'));
  const metadata = { version: 1, repository: ctx.repository, pr: ctx.pr, source: ctx.expected,
    run_id: env.GITHUB_RUN_ID, run_attempt: env.GITHUB_RUN_ATTEMPT, lockfile_sha256: digest(bytes) };
  await writeFile(join(directory, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

export async function publish({ api, env, directory = env.LOCKFILE_REPORT_DIR }) {
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
  assert(state.source === metadata.source, 'Artifact refers to another Dependabot source.');
  const committed = await lockfile(api, ctx.repository, metadata.source);
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
        fileChanges: { additions: [{ path: 'yarn.lock', contents: regenerated.toString('base64') }] },
      } },
    });
    newSha = response.data?.createCommitOnBranch?.commit?.oid;
    assert(SHA.test(newSha || ''), 'GitHub did not return a lockfile commit SHA.');
  }
  // Re-read before dispatching; both the commit CAS and this guard reject concurrent pushes.
  const current = await api('GET', `repos/${ctx.repository}/pulls/${ctx.pr}`);
  assert(current.state === 'open' && current.head?.sha === newSha && current.head?.ref === state.branch && current.head?.repo?.full_name === ctx.repository,
    'Pull request changed before follow-up CI could be dispatched.');
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
    const state = await inspect({ api, env });
    assert(env.RUNNER_TEMP, 'RUNNER_TEMP is required.');
    await mkdir(env.RUNNER_TEMP, { recursive: true });
    const directory = await mkdtemp(join(env.RUNNER_TEMP, 'dependabot-event-'));
    const eventFile = join(directory, 'event.json');
    await writeFile(eventFile, JSON.stringify({ pull_request: state.pull_request }), { mode: 0o600 });
    await writeOutputs(env, { pr: state.pr, head: state.head, source: state.source, branch: state.branch, refreshed: state.refreshed, event_file: eventFile });
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
