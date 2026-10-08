import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { githubApi } from './dependabot-lockfile.mjs';

const REPOSITORY = 'kunal26das/yify';
const SHA = /^[a-f0-9]{40}$/;
const INTEGER = /^[1-9][0-9]*$/;
const REQUIRED_CHECKS = ['Verify dependency automation context', 'Typecheck and tests',
  'Web exports render and isolate catalog data', 'Typecheck and test release console'];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function trustedMain(env) {
  assert(env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main' &&
    SHA.test(env.GITHUB_SHA || ''), 'Main automation must run from the trusted repository and main branch.');
}

function mainCommit(main) {
  assert(main?.ref === 'refs/heads/main' && main.object?.type === 'commit' && SHA.test(main.object.sha || ''),
    'Unable to verify the current main branch.');
  return main.object.sha;
}

async function jobsForAttempt(api, path) {
  const jobs = [];
  for (let page = 1; page <= 20; page += 1) {
    const response = await api('GET', `${path}?per_page=100&page=${page}`);
    assert(Array.isArray(response.jobs), 'Unable to inspect main CI jobs.');
    jobs.push(...response.jobs);
    if (response.jobs.length < 100) return jobs;
  }
  throw new Error('Main CI job history exceeds the supported size.');
}

export async function verifyMainCI({ api, env }) {
  trustedMain(env);
  assert(env.GITHUB_EVENT_NAME === 'workflow_run' && INTEGER.test(env.SOURCE_RUN_ID || '') &&
    INTEGER.test(env.SOURCE_RUN_ATTEMPT || ''), 'An exact main CI run and attempt are required from workflow_run.');
  const root = `repos/${REPOSITORY}`;
  const [run, workflow, jobs] = await Promise.all([
    api('GET', `${root}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${env.SOURCE_RUN_ATTEMPT}`),
    api('GET', `${root}/actions/workflows/ci.yml`),
    jobsForAttempt(api, `${root}/actions/runs/${env.SOURCE_RUN_ID}/attempts/${env.SOURCE_RUN_ATTEMPT}/jobs`),
  ]);
  const [latest, main] = await Promise.all([
    api('GET', `${root}/actions/runs/${env.SOURCE_RUN_ID}`),
    api('GET', `${root}/git/ref/heads/main`),
  ]);
  const current = mainCommit(main);
  for (const candidate of [latest, run]) {
    assert(String(candidate.id) === env.SOURCE_RUN_ID && String(candidate.run_attempt) === env.SOURCE_RUN_ATTEMPT &&
      Number.isSafeInteger(workflow.id) && workflow.id > 0 && candidate.workflow_id === workflow.id &&
      workflow.path === '.github/workflows/ci.yml' && candidate.path === workflow.path &&
      ['push', 'workflow_dispatch'].includes(candidate.event) && candidate.event === run.event &&
      candidate.head_branch === 'main' && candidate.status === 'completed' && candidate.conclusion === 'success' &&
      candidate.repository?.full_name === REPOSITORY && candidate.head_repository?.full_name === REPOSITORY &&
      Number.isSafeInteger(candidate.repository?.id) && candidate.repository.id > 0 &&
      candidate.repository.id === run.repository?.id && candidate.head_repository?.id === candidate.repository.id &&
      SHA.test(candidate.head_sha || '') && candidate.head_sha === run.head_sha,
    'Source run is not the latest successful CI attempt on the trusted main branch.');
  }
  for (const name of REQUIRED_CHECKS) {
    const matches = jobs.filter((job) => job.name === name);
    assert(matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success',
      `Main CI has not passed its required check: ${name}.`);
  }
  const result = { head: run.head_sha, repositoryId: run.repository.id, workflowId: workflow.id };
  if (current !== run.head_sha || env.GITHUB_SHA !== run.head_sha) {
    return { ...result, ready: false, reason: 'The successful CI commit has been superseded on main.' };
  }
  return { ...result, ready: true };
}

export async function dispatchMergedMainCI({ api, env }) {
  trustedMain(env);
  assert(['workflow_run', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) &&
    INTEGER.test(env.PR_NUMBER || '') && SHA.test(env.PR_HEAD_SHA || ''),
  'A verified Dependabot pull request and tested head are required for main CI dispatch.');
  const root = `repos/${REPOSITORY}`;
  const pr = await api('GET', `${root}/pulls/${env.PR_NUMBER}`);
  assert(pr.number === Number(env.PR_NUMBER) && pr.state === 'closed' && pr.merged === true && !pr.draft &&
    pr.user?.login === 'dependabot[bot]' && pr.merged_by?.login === 'github-actions[bot]' &&
    pr.head?.sha === env.PR_HEAD_SHA && typeof pr.head.ref === 'string' && pr.head.ref.startsWith('dependabot/') &&
    pr.head.repo?.full_name === REPOSITORY && pr.base?.ref === 'main' && pr.base.repo?.full_name === REPOSITORY &&
    Number.isSafeInteger(pr.base.repo.id) && pr.base.repo.id > 0 && pr.head.repo.id === pr.base.repo.id &&
    SHA.test(pr.merge_commit_sha || ''),
  'Pull request is not the tested, same-repository Dependabot update merged by GitHub Actions.');
  const head = pr.merge_commit_sha;
  if (mainCommit(await api('GET', `${root}/git/ref/heads/main`)) !== head) {
    return { dispatched: false, head, pr: pr.number, reason: 'The merged dependency update has been superseded on main.' };
  }
  await api('POST', `${root}/actions/workflows/ci.yml/dispatches`, { ref: 'main' });
  return { dispatched: true, head, pr: pr.number };
}

export async function checkCurrentMain({ api, env }) {
  assert(SHA.test(env.GITHUB_SHA || ''), 'The deployment commit is invalid.');
  if (env.CHECK_CURRENT_MAIN !== 'true') return { ready: true, head: env.GITHUB_SHA };
  trustedMain(env);
  if (env.GITHUB_EVENT_NAME === 'workflow_run') {
    const result = await verifyMainCI({ api, env });
    assert(result.ready, 'Main advanced before production deployment; refusing to publish the stale commit.');
    return { ready: true, head: result.head };
  }
  const current = mainCommit(await api('GET', `repos/${REPOSITORY}/git/ref/heads/main`));
  assert(current === env.GITHUB_SHA, 'Main advanced before production deployment; refusing to publish the stale commit.');
  return { ready: true, head: current };
}

export async function main(env = process.env, mode = process.argv[2], api) {
  assert(['dispatch', 'validate', 'current'].includes(mode), 'Unsupported main CI command.');
  const operation = { dispatch: dispatchMergedMainCI, validate: verifyMainCI, current: checkCurrentMain }[mode];
  const connection = api || (mode === 'current' && env.CHECK_CURRENT_MAIN !== 'true' ? undefined : githubApi(env.GH_TOKEN));
  const result = await operation({ env, api: connection });
  if (env.GITHUB_OUTPUT) {
    await appendFile(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => {
      assert(!/[\r\n]/.test(String(value)), 'Invalid multiline main CI output.');
      return `${key}=${value}\n`;
    }).join(''));
  }
  if (env.GITHUB_STEP_SUMMARY) {
    const status = result.reason || (mode === 'dispatch' ? 'Requested main CI after the verified dependency merge.' :
      mode === 'validate' ? 'Verified successful CI for the current main commit.' : 'Verified the deployment commit.');
    await appendFile(env.GITHUB_STEP_SUMMARY, `## Main CI ${mode}\n\n${status}\n\nCommit: \`${result.head}\`.\n`);
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
