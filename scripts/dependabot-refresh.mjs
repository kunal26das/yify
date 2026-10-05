import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { githubApi, inspect, maintenanceContext } from './dependabot-lockfile.mjs';

const SHA = /^[a-f0-9]{40}$/;
const OWNER = 'kunal26das';
const INTEGER = /^[1-9][0-9]*$/;
const REQUIRED_CHECKS = ['Typecheck and tests', 'Web exports render and isolate catalog data', 'Typecheck and test release console'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function samePullRequest(pr, state, repository) {
  return pr.number === state.pr && pr.state === 'open' && !pr.merged && !pr.draft && pr.user?.login === 'dependabot[bot]' &&
    pr.head?.ref === state.branch && pr.head?.repo?.full_name === repository &&
    pr.head?.repo?.id === state.pull_request.head.repo.id && pr.base?.ref === 'main' &&
    pr.base?.repo?.full_name === repository && pr.base?.repo?.id === state.pull_request.base.repo.id;
}

async function list(api, path, key) {
  const result = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await api('GET', `${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const values = key ? response[key] : response;
    assert(Array.isArray(values), 'Unable to inspect Dependabot request acknowledgements.');
    result.push(...values);
    if (values.length < 100) return result;
  }
  throw new Error('Dependabot request history exceeds the supported size.');
}

function ownerRequests(comments, body) {
  return comments.filter((comment) => comment.user?.login === OWNER && comment.user?.type === 'User' && comment.body === body)
    .map((comment) => validateComment(comment, body)).sort((a, b) => a.id - b.id);
}

function validateComment(comment, body) {
  assert(comment && Number.isSafeInteger(comment.id) && comment.id > 0 &&
    comment.user?.login === OWNER && comment.user?.type === 'User' && comment.body === body &&
    Number.isFinite(Date.parse(comment.created_at)), 'The rebase request is not a valid owner-authored comment.');
  return comment;
}

function validateRequest(env, timeoutMs, pollMs) {
  assert(env.DEPENDABOT_REBASE_TOKEN && env.GH_TOKEN && env.DEPENDABOT_REBASE_TOKEN !== env.GH_TOKEN,
    'DEPENDABOT_REBASE_TOKEN must be a separate repository-restricted user token.');
  assert(env.ALLOW_MERGED !== 'true', 'Closed or merged pull requests cannot request a dependency rebase.');
  assert(Number.isFinite(timeoutMs) && timeoutMs >= 0 && Number.isFinite(pollMs) && pollMs > 0,
    'Invalid rebase acknowledgement polling bounds.');
}

export async function requestRebase(options) {
  const { api, env } = options;
  const trustedEnv = await maintenanceContext({ api, env, operation: 'merge' });
  const state = await inspect({ api, env: trustedEnv });
  assert(state.eligible && state.automerge && state.scope === 'release',
    'Only a verified release-console update may request an automatic rebase.');
  return postRebase({ ...options, trustedEnv, state });
}

async function postRebase({ api, rebaseApi, env, trustedEnv, state, beforePost, wait = delay, now = Date.now, timeoutMs = 120_000, pollMs = 5000 }) {
  validateRequest(env, timeoutMs, pollMs);
  const owner = await rebaseApi('GET', 'user');
  assert(owner?.login === OWNER && owner.type === 'User',
    'DEPENDABOT_REBASE_TOKEN must belong to the repository owner, kunal26das.');
  const repository = env.GITHUB_REPOSITORY;
  const path = `repos/${repository}/pulls/${state.pr}`;
  const commentsPath = `repos/${repository}/issues/${state.pr}/comments`;
  const mainPath = `repos/${repository}/git/ref/heads/main`;
  const main = await api('GET', mainPath);
  assert(main.ref === 'refs/heads/main' && main.object?.type === 'commit' && SHA.test(main.object.sha || ''),
    'Unable to verify the current main branch.');
  const body = `@dependabot rebase\n\n<!-- dependabot-rebase:v2:${state.head}:${main.object.sha} -->`;
  let requests = ownerRequests(await list(api, commentsPath), body);
  const recoveryBehind = beforePost ? await beforePost() : false;
  const [current, currentMain] = await Promise.all([api('GET', path), api('GET', mainPath)]);
  assert(samePullRequest(current, state, repository) && current.head.sha === state.head,
    'Pull request changed before the rebase request.');
  assert(currentMain.ref === main.ref && currentMain.object?.sha === main.object.sha,
    'Main changed before the rebase request.');
  if (requests.length === 0 && current.mergeable_state !== 'behind' && !recoveryBehind) {
    return { requested: false, pr: state.pr, head: state.head, main: main.object.sha };
  }
  if (requests.length === 0) {
    try {
      requests = [validateComment(await rebaseApi('POST', commentsPath, { body }), body)];
    } catch (error) {
      requests = ownerRequests(await list(api, commentsPath), body);
      assert(requests.length > 0, `Unable to confirm the rebase request; no duplicate was posted. ${error.message}`);
    }
  }
  const deadline = now() + timeoutMs;
  const attempts = Math.ceil(timeoutMs / pollMs) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const snapshot = await api('GET', path);
    assert(samePullRequest(snapshot, state, repository), 'Pull request identity changed while awaiting Dependabot.');
    if (snapshot.head.sha !== state.head) {
      const rebased = await inspect({ api, env: { ...trustedEnv, PR_HEAD_SHA: snapshot.head.sha } });
      assert(rebased.eligible && rebased.automerge && rebased.scope === state.scope && !rebased.refreshed &&
        rebased.head === rebased.source && rebased.branch === state.branch,
      'The new head is not a fresh, verified Dependabot update.');
      const confirmed = await api('GET', path);
      assert(samePullRequest(confirmed, state, repository) && confirmed.head.sha === rebased.head,
        'The rebased pull request changed during verification.');
      return { requested: true, acknowledgement: 'signed-head', pr: state.pr, head: state.head,
        main: main.object.sha, new_head: rebased.head, comment_id: requests[0].id };
    }
    const comments = await list(api, commentsPath);
    requests = [...new Map([...requests, ...ownerRequests(comments, body)].map((request) => [request.id, request])).values()]
      .sort((a, b) => a.id - b.id);
    const earliest = requests[0];
    const rejection = comments.find((item) => item.user?.login === 'dependabot[bot]' &&
      Number.isSafeInteger(item.id) && item.id > earliest.id && Date.parse(item.created_at) >= Date.parse(earliest.created_at) &&
      typeof item.body === 'string' && /^sorry\b/i.test(item.body.trim()));
    assert(!rejection, 'Dependabot rejected the rebase request; inspect its reply before retrying.');
    const reactions = await Promise.all(requests.map((request) =>
      list(api, `repos/${repository}/issues/comments/${request.id}/reactions`)));
    const acknowledged = requests.find((_, index) => reactions[index].some((reaction) =>
      reaction.content === '+1' && reaction.user?.login === 'dependabot[bot]'));
    if (acknowledged) {
      const confirmed = await api('GET', path);
      assert(samePullRequest(confirmed, state, repository) && confirmed.head.sha === state.head,
        'Pull request changed while confirming the Dependabot acknowledgement; reverify its new head.');
      return { requested: true, acknowledgement: 'dependabot-reaction', pr: state.pr,
        head: state.head, main: main.object.sha, comment_id: acknowledged.id };
    }
    if (now() >= deadline || attempt + 1 >= attempts) break;
    await wait(Math.min(pollMs, Math.max(0, deadline - now())));
  }
  throw new Error(`Dependabot has not acknowledged rebase request ${requests[0].id} within the time limit. The request is pending; rerun maintenance to observe it without posting another comment.`);
}

async function mainRecoveryContext({ api, env }) {
  assert(env.GITHUB_REPOSITORY === 'kunal26das/yify' && env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_EVENT_NAME === 'workflow_run' && env.ALLOW_MERGED !== 'true',
  'Main recovery must run from trusted default-branch workflow_run maintenance.');
  assert(INTEGER.test(env.SOURCE_RUN_ID || '') && INTEGER.test(env.SOURCE_RUN_ATTEMPT || ''),
    'An exact main CI run and attempt are required.');
  const root = `repos/${env.GITHUB_REPOSITORY}`;
  const [latest, run, workflow, main, jobs] = await Promise.all([
    api('GET', `${root}/actions/runs/${env.SOURCE_RUN_ID}`),
    api('GET', `${root}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${env.SOURCE_RUN_ATTEMPT}`),
    api('GET', `${root}/actions/workflows/ci.yml`),
    api('GET', `${root}/git/ref/heads/main`),
    list(api, `${root}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${env.SOURCE_RUN_ATTEMPT}/jobs`, 'jobs'),
  ]);
  for (const candidate of [latest, run]) {
    assert(String(candidate.id) === env.SOURCE_RUN_ID && String(candidate.run_attempt) === env.SOURCE_RUN_ATTEMPT &&
      Number.isSafeInteger(workflow.id) && workflow.id > 0 && candidate.workflow_id === workflow.id &&
      workflow.path === '.github/workflows/ci.yml' && candidate.path === workflow.path &&
      candidate.event === 'push' && candidate.head_branch === 'main' &&
      candidate.status === 'completed' && candidate.conclusion === 'success' &&
      candidate.repository?.full_name === env.GITHUB_REPOSITORY && candidate.head_repository?.full_name === env.GITHUB_REPOSITORY &&
      Number.isSafeInteger(candidate.repository?.id) && candidate.repository.id > 0 &&
      candidate.head_repository?.id === candidate.repository.id &&
      SHA.test(candidate.head_sha || '') && candidate.head_sha === env.GITHUB_SHA &&
      main.ref === 'refs/heads/main' && main.object?.type === 'commit' && main.object.sha === candidate.head_sha,
    'Source run is not the latest successful CI attempt on the current main commit.');
  }
  for (const name of REQUIRED_CHECKS) {
    const matches = jobs.filter((job) => job.name === name);
    assert(matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success',
      `Main CI has not passed its required check: ${name}.`);
  }
  return { main: main.object.sha, repositoryId: run.repository.id, workflowId: workflow.id };
}

async function failedPullRequestCI({ api, env, state, context }) {
  const root = `repos/${env.GITHUB_REPOSITORY}`;
  const runs = await list(api,
    `${root}/actions/workflows/ci.yml/runs?event=pull_request&head_sha=${state.head}`, 'workflow_runs');
  const matching = runs.filter((run) => run.head_sha === state.head && run.event === 'pull_request');
  assert(matching.every((run) => Number.isSafeInteger(run.id) && run.id > 0), 'Invalid pull-request CI run identity.');
  const recent = matching.sort((a, b) => b.id - a.id)[0];
  if (!recent) return null;
  const run = await api('GET', `${root}/actions/runs/${recent.id}`);
  if (run.status !== 'completed' || run.conclusion !== 'failure') return null;
  const association = run.pull_requests;
  assert(run.id === recent.id && Number.isSafeInteger(run.run_attempt) && run.run_attempt > 0 &&
    run.workflow_id === context.workflowId && run.path === '.github/workflows/ci.yml' &&
    run.head_sha === state.head && run.head_branch === state.branch && run.event === 'pull_request' &&
    run.repository?.full_name === env.GITHUB_REPOSITORY && run.repository?.id === context.repositoryId &&
    run.head_repository?.full_name === env.GITHUB_REPOSITORY && run.head_repository?.id === context.repositoryId &&
    ['dependabot[bot]', 'github-actions[bot]'].includes(run.actor?.login) &&
    Array.isArray(association) && association.length === 1 && association[0].number === state.pr &&
    association[0].head?.sha === state.head && association[0].head?.ref === state.branch &&
    association[0].base?.ref === 'main' && association[0].head?.repo?.id === context.repositoryId &&
    association[0].base?.repo?.id === context.repositoryId,
  'Failed CI does not identify the current verified Dependabot head.');
  const jobs = await list(api, `${root}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
  const checks = REQUIRED_CHECKS.map((name) => jobs.filter((job) => job.name === name));
  assert(checks.every((matches) => matches.length === 1 && matches[0].status === 'completed'),
    'Failed pull-request CI is missing unique completed required checks.');
  if (!checks.some(([job]) => job.conclusion === 'failure')) return null;
  return { id: run.id, attempt: run.run_attempt };
}

async function behindMain({ api, env, state, context }) {
  const comparison = await api('GET', `repos/${env.GITHUB_REPOSITORY}/compare/${state.head}...${context.main}?per_page=1`);
  assert(comparison.base_commit?.sha === state.head && Number.isSafeInteger(comparison.ahead_by) && comparison.ahead_by >= 0 &&
    ['ahead', 'behind', 'diverged', 'identical'].includes(comparison.status),
  'Unable to verify the pull-request ancestry against current main.');
  return comparison.ahead_by > 0 && ['ahead', 'diverged'].includes(comparison.status);
}

export async function recoverAfterMain(options) {
  const { api, env } = options;
  validateRequest(env, options.timeoutMs ?? 20_000, options.pollMs ?? 5000);
  const context = await mainRecoveryContext(options);
  const candidates = (await list(api, `repos/${env.GITHUB_REPOSITORY}/pulls?state=open&base=main`))
    .filter((pr) => pr.state === 'open' && !pr.merged && !pr.draft && pr.user?.login === 'dependabot[bot]' &&
      pr.head?.repo?.full_name === env.GITHUB_REPOSITORY && pr.head.repo.id === context.repositoryId &&
      pr.base?.repo?.full_name === env.GITHUB_REPOSITORY && pr.base.repo.id === context.repositoryId && pr.base.ref === 'main' &&
      pr.head?.ref?.startsWith('dependabot/npm_and_yarn/release/'));
  assert(candidates.length <= 20, 'More than 20 release-console updates require recovery; inspect the backlog manually.');
  const results = [];
  for (const candidate of candidates) {
    const trustedEnv = { ...env, PR_NUMBER: String(candidate.number), PR_HEAD_SHA: candidate.head.sha };
    try {
      const state = await inspect({ api, env: trustedEnv, allowManual: true });
      if (!state.eligible || !state.automerge || state.scope !== 'release') {
        results.push({ pr: candidate.number, requested: false, reason: state.reason || 'Not an eligible behind release-console update.' });
        continue;
      }
      assert(state.pull_request.head.repo.id === context.repositoryId && state.pull_request.base.repo.id === context.repositoryId,
        'Pull-request repository identity changed during recovery.');
      if (!await behindMain({ api, env, state, context })) {
        results.push({ pr: state.pr, requested: false, reason: 'The current head already includes main.' });
        continue;
      }
      const failed = await failedPullRequestCI({ api, env, state, context });
      if (!failed) {
        results.push({ pr: state.pr, requested: false, reason: 'Current-head CI has no completed failed required check.' });
        continue;
      }
      const beforePost = async () => {
        await mainRecoveryContext(options);
        const current = await failedPullRequestCI({ api, env, state, context });
        assert(current?.id === failed.id && current?.attempt === failed.attempt,
          'Pull-request CI changed before main recovery; wait for its own maintenance.');
        assert(await behindMain({ api, env, state, context }), 'Pull-request ancestry changed before main recovery.');
        return true;
      };
      const result = await postRebase({ timeoutMs: 20_000, ...options, trustedEnv, state, beforePost });
      results.push({ ...result, failed_run_id: failed.id, failed_run_attempt: failed.attempt });
    } catch (error) {
      results.push({ pr: candidate.number, requested: false, blocked: true, reason: error.message });
    }
  }
  const result = { main: context.main, results };
  if (env.GITHUB_STEP_SUMMARY) {
    const lines = ['## Dependabot recovery after main CI', '',
      `Verified main: \`${context.main}\`.`,
      `Source CI: [run ${env.SOURCE_RUN_ID}, attempt ${env.SOURCE_RUN_ATTEMPT}](https://github.com/${env.GITHUB_REPOSITORY}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${env.SOURCE_RUN_ATTEMPT}).`, '',
      'Recovery requests a rebase only. Fresh PR checks and lockfile verification still control merging.', ''];
    for (const item of results) lines.push(`- #${item.pr}: ${item.requested ? `Dependabot acknowledged rebase (${item.acknowledgement}).` : item.reason}`);
    if (!results.length) lines.push('No release-console updates require inspection.');
    await appendFile(env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  }
  return result;
}

export async function main(env = process.env, mode = process.argv[2]) {
  assert(mode === undefined || mode === 'recover-main', 'Unsupported Dependabot refresh command.');
  const options = { api: githubApi(env.GH_TOKEN), rebaseApi: githubApi(env.DEPENDABOT_REBASE_TOKEN), env };
  const result = mode === 'recover-main' ? await recoverAfterMain(options) : await requestRebase(options);
  assert(!result.results?.some((item) => item.blocked), 'Some recovery requests were blocked; inspect the maintenance summary.');
  if (env.GITHUB_OUTPUT) {
    await appendFile(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${typeof value === 'object' ? JSON.stringify(value) : value}\n`).join(''));
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
