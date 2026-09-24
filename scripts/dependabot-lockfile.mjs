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
const REQUIRED_CHECKS = ['Typecheck and tests', 'Web exports render and isolate catalog data', 'Typecheck and test release console'];
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
    if (response.status === 204 || (response.status === 201 && method === 'POST' && /\/actions\/runs\/[1-9][0-9]*\/approve$/.test(path))) return null;
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

export async function prepareMaintenance({ api, env }) {
  assert(env.GITHUB_REPOSITORY === 'kunal26das/yify' && env.GITHUB_REF === 'refs/heads/main' &&
    ['workflow_run', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME),
  'Dependency maintenance must run from the trusted default branch.');
  assert(INTEGER.test(env.SOURCE_RUN_ID || ''), 'A source CI run ID is required.');
  const repository = env.GITHUB_REPOSITORY;
  const latest = await api('GET', `repos/${repository}/actions/runs/${env.SOURCE_RUN_ID}`);
  const attempt = env.SOURCE_RUN_ATTEMPT || String(latest.run_attempt);
  assert(INTEGER.test(attempt), 'Invalid source CI attempt.');
  const [run, workflow, jobs] = await Promise.all([
    api('GET', `repos/${repository}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${attempt}`),
    api('GET', `repos/${repository}/actions/workflows/ci.yml`),
    list(api, `repos/${repository}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${attempt}/jobs`, 'jobs'),
  ]);
  assert(String(run.id) === env.SOURCE_RUN_ID && String(run.run_attempt) === attempt && run.workflow_id === workflow.id &&
    workflow.path === '.github/workflows/ci.yml' && run.path === workflow.path && run.event === 'pull_request' &&
    run.status === 'completed' && SHA.test(run.head_sha || '') && run.repository?.full_name === repository &&
    run.head_repository?.full_name === repository && ['dependabot[bot]', 'github-actions[bot]'].includes(run.actor?.login) &&
    Array.isArray(run.pull_requests) && run.pull_requests.length === 1 && Number.isSafeInteger(run.pull_requests[0].number),
  'Source run is not a completed same-repository Dependabot pull-request CI attempt.');
  const pr = run.pull_requests[0];
  const sourceEnv = { ...env, GITHUB_EVENT_NAME: 'workflow_run', PR_NUMBER: String(pr.number), PR_HEAD_SHA: run.head_sha };
  const currentPr = await api('GET', `repos/${repository}/pulls/${pr.number}`);
  if (currentPr.state === 'closed') return { ready: false, reason: 'Pull request is already closed.' };
  const state = await inspect({ api, env: sourceEnv, allowPublishedHead: true });
  if (!state.eligible) return { ready: false, reason: state.reason };
  assert(run.head_branch === state.branch && [run.head_sha, state.head].includes(pr.head?.sha) && pr.head?.ref === state.branch && pr.base?.ref === 'main' &&
    Number.isSafeInteger(state.pull_request.head.repo.id) && pr.head?.repo?.id === state.pull_request.head.repo.id &&
    Number.isSafeInteger(state.pull_request.base.repo.id) && pr.base?.repo?.id === state.pull_request.base.repo.id,
  'Source CI association does not match the current verified pull request.');
  const checksPassed = REQUIRED_CHECKS.every((name) => {
    const matches = jobs.filter((job) => job.name === name);
    return matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success';
  });
  const result = { ready: true, operation: 'publish', pr: state.pr, head: state.head, source: run.head_sha,
    branch: state.branch, scope: state.scope, automerge: state.automerge, checks_passed: checksPassed,
    source_run_id: env.SOURCE_RUN_ID, source_run_attempt: attempt };
  if (state.refreshed && state.head === run.head_sha) {
    assert(checksPassed, 'The refreshed pull-request head has not passed every required CI check.');
    return { ...result, operation: 'merge' };
  }
  const cleanJobs = jobs.filter((job) => job.name === `Dependabot clean reinstall (${state.scope})`);
  assert(cleanJobs.length === 1 && cleanJobs[0].status === 'completed' && cleanJobs[0].conclusion === 'success',
    'Source CI has no successful clean reinstall in the selected attempt. Choose the exact artifact-producing attempt for recovery.');
  const name = `dependabot-clean-install-${state.scope}-${env.SOURCE_RUN_ID}-${attempt}`;
  const artifacts = await list(api, `repos/${repository}/actions/runs/${env.SOURCE_RUN_ID}/artifacts`, 'artifacts');
  const matching = artifacts.filter((artifact) => artifact.name === name);
  assert(matching.length === 1 && !matching[0].expired && matching[0].workflow_run?.id === run.id &&
    matching[0].workflow_run?.head_sha === run.head_sha && matching[0].workflow_run?.head_branch === state.branch &&
    matching[0].workflow_run?.repository_id === state.pull_request.base.repo.id &&
    matching[0].workflow_run?.head_repository_id === state.pull_request.head.repo.id,
  'The exact source CI attempt has no unique, unexpired lockfile artifact.');
  return { ...result, artifact_name: name };
}

export async function maintenanceContext({ api, env, operation }) {
  const prepared = await prepareMaintenance({ api, env });
  assert(prepared.ready && String(prepared.pr) === env.PR_NUMBER && prepared.source === env.SOURCE_HEAD_SHA,
    'Source CI or pull request changed after maintenance preparation.');
  if (operation === 'publish') {
    assert(prepared.operation === 'publish', 'This source CI does not require lockfile publication.');
  } else {
    assert(prepared.checks_passed && prepared.head === env.PR_HEAD_SHA,
      'The current pull-request head has not passed the selected CI attempt.');
    assert(prepared.head === prepared.source, 'The selected CI attempt did not test the current pull-request head.');
  }
  return { ...env, GITHUB_EVENT_NAME: 'workflow_run', PR_HEAD_SHA: operation === 'publish' ? prepared.source : prepared.head,
    SOURCE_RUN_ID: prepared.source_run_id, SOURCE_RUN_ATTEMPT: prepared.source_run_attempt };
}

async function waitForPublishedHead({ api, ctx, state, newSha, wait }) {
  for (let attempt = 0; ; attempt += 1) {
    const current = await api('GET', `repos/${ctx.repository}/pulls/${ctx.pr}`);
    const unchanged = current.number === ctx.pr && current.state === 'open' && !current.merged && !current.draft &&
      current.user?.login === 'dependabot[bot]' && current.head?.ref === state.branch && current.head?.repo?.full_name === ctx.repository &&
      current.base?.ref === 'main' && current.base?.repo?.full_name === ctx.repository;
    assert(unchanged, 'Pull request changed before follow-up CI could be approved.');
    if (current.head.sha === newSha) return;
    assert(!state.refreshed && current.head.sha === state.head,
      'Pull request changed before follow-up CI could be approved.');
    assert(attempt < HEAD_PROPAGATION_DELAYS.length,
      'GitHub has not exposed the new lockfile commit on the pull request yet. Rerun this failed job to retry without creating another commit.');
    await wait(HEAD_PROPAGATION_DELAYS[attempt]);
  }
}

function validateFollowupRun(run, workflow, ctx, state, newSha) {
  const prs = run.pull_requests;
  assert(Number.isSafeInteger(state.pull_request.head.repo.id) && state.pull_request.head.repo.id > 0 &&
    Number.isSafeInteger(state.pull_request.base.repo.id) && state.pull_request.base.repo.id > 0 &&
    Number.isSafeInteger(run.id) && run.id > 0 && run.workflow_id === workflow.id && run.path === workflow.path &&
    run.event === 'pull_request' && run.head_sha === newSha && run.head_branch === state.branch &&
    run.repository?.full_name === ctx.repository && run.head_repository?.full_name === ctx.repository &&
    run.actor?.login === 'github-actions[bot]' && Array.isArray(prs) && prs.length === 1 &&
    prs[0].number === ctx.pr && prs[0].head?.sha === newSha && prs[0].head?.ref === state.branch &&
    prs[0].base?.ref === 'main' && prs[0].head?.repo?.id === state.pull_request.head.repo.id &&
    prs[0].base?.repo?.id === state.pull_request.base.repo.id,
  'Follow-up CI does not identify the exact same-repository lockfile commit and pull request.');
}

async function approveFollowup({ api, approvalApi, env, ctx, state, metadata, newSha, wait }) {
  const workflow = await api('GET', `repos/${ctx.repository}/actions/workflows/ci.yml`);
  assert(Number.isSafeInteger(workflow.id) && workflow.id > 0 && workflow.path === '.github/workflows/ci.yml',
    'Unable to identify the trusted CI workflow.');
  let candidate;
  for (let attempt = 0; ; attempt += 1) {
    const response = await api('GET', `repos/${ctx.repository}/actions/workflows/${workflow.id}/runs?event=pull_request&head_sha=${newSha}&per_page=100`);
    assert(Array.isArray(response.workflow_runs) && Number.isSafeInteger(response.total_count) &&
      response.total_count === response.workflow_runs.length && response.total_count <= 1,
    'Follow-up CI discovery returned ambiguous or incomplete workflow runs.');
    if (response.workflow_runs.length === 1) {
      candidate = response.workflow_runs[0];
      validateFollowupRun(candidate, workflow, ctx, state, newSha);
      break;
    }
    assert(attempt < HEAD_PROPAGATION_DELAYS.length,
      'GitHub has not created the pull-request CI run yet. Rerun this failed job to retry without creating another commit.');
    await wait(HEAD_PROPAGATION_DELAYS[attempt]);
    await waitForPublishedHead({ api, ctx, state: { ...state, refreshed: true }, newSha, wait });
  }
  const run = await api('GET', `repos/${ctx.repository}/actions/runs/${candidate.id}`);
  validateFollowupRun(run, workflow, ctx, state, newSha);
  const current = await inspect({ api, env: { ...env, ALLOW_MERGED: 'false' }, allowPublishedHead: true });
  assert(current.head === newSha && current.refreshed && commitMessage(current.provenance) === commitMessage(metadata),
    'Lockfile provenance changed before follow-up CI could be approved.');
  await waitForPublishedHead({ api, ctx, state: { ...state, refreshed: true }, newSha, wait });
  if (run.conclusion === 'action_required' || run.status === 'action_required') {
    await approvalApi('POST', `repos/${ctx.repository}/actions/runs/${run.id}/approve`);
  } else {
    assert((['queued', 'in_progress', 'requested', 'pending'].includes(run.status) && run.conclusion === null) ||
      (run.status === 'completed' && run.conclusion === 'success'),
    `Follow-up CI run ${run.id} is ${String(run.status)}/${String(run.conclusion)}; inspect its failure before retrying.`);
  }
  return run.id;
}

export async function publish({ api, approvalApi, env, directory = env.LOCKFILE_REPORT_DIR, wait = delay }) {
  assert(directory, 'LOCKFILE_REPORT_DIR is required.');
  assert(typeof approvalApi === 'function', 'A separate GitHub App approval token is required before committing a lockfile.');
  const ctx = context(env);
  const [original, regenerated, text] = await Promise.all([
    readFile(join(directory, 'original-yarn.lock')), readFile(join(directory, 'regenerated-yarn.lock')), readFile(join(directory, 'metadata.json'), 'utf8'),
  ]);
  const metadata = validateMetadata(JSON.parse(text), env);
  assert(metadata.source === ctx.expected && metadata.run_id === (env.SOURCE_RUN_ID || env.GITHUB_RUN_ID) && metadata.run_attempt === (env.SOURCE_RUN_ATTEMPT || env.GITHUB_RUN_ATTEMPT),
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
  const runId = await approveFollowup({ api, approvalApi, env, ctx, state, metadata, newSha, wait });
  return { changed: true, new_sha: newSha, ci_run_id: runId };
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
  if (mode === 'prepare-maintenance') {
    const result = await prepareMaintenance({ api, env });
    await writeOutputs(env, result);
    return result;
  }
  if (mode === 'inspect-maintenance' || mode === 'publish-maintenance') {
    env = await maintenanceContext({ api, env, operation: mode === 'publish-maintenance' ? 'publish' : 'merge' });
    mode = mode === 'publish-maintenance' ? 'publish' : 'inspect';
  }
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
    assert(env.DEPENDABOT_APPROVAL_TOKEN && env.DEPENDABOT_APPROVAL_TOKEN !== env.GH_TOKEN,
      'DEPENDABOT_APPROVAL_TOKEN must be a separate GitHub App token; configure DEPENDABOT_APP_ID and DEPENDABOT_APP_PRIVATE_KEY before committing a lockfile.');
    const result = await publish({ api, approvalApi: githubApi(env.DEPENDABOT_APPROVAL_TOKEN), env });
    await writeOutputs(env, result);
    return result;
  }
  throw new Error('Expected inspect, capture, prepare-maintenance, or publish mode.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main(process.argv[2]).catch((error) => { console.error(error.message); process.exitCode = 1; });
}
