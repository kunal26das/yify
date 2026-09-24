import { appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';
import { githubApi, inspect, maintenanceContext } from './dependabot-lockfile.mjs';

const SHA = /^[a-f0-9]{40}$/;
const OWNER = 'kunal26das';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function samePullRequest(pr, state, repository) {
  return pr.number === state.pr && pr.state === 'open' && !pr.merged && !pr.draft && pr.user?.login === 'dependabot[bot]' &&
    pr.head?.ref === state.branch && pr.head?.repo?.full_name === repository &&
    pr.head?.repo?.id === state.pull_request.head.repo.id && pr.base?.ref === 'main' &&
    pr.base?.repo?.full_name === repository && pr.base?.repo?.id === state.pull_request.base.repo.id;
}

async function list(api, path) {
  const result = [];
  for (let page = 1; page <= 20; page += 1) {
    const values = await api('GET', `${path}?per_page=100&page=${page}`);
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

export async function requestRebase({ api, rebaseApi, env, wait = delay, now = Date.now, timeoutMs = 120_000, pollMs = 5000 }) {
  assert(env.DEPENDABOT_REBASE_TOKEN && env.GH_TOKEN && env.DEPENDABOT_REBASE_TOKEN !== env.GH_TOKEN,
    'DEPENDABOT_REBASE_TOKEN must be a separate repository-restricted user token.');
  assert(env.ALLOW_MERGED !== 'true', 'Closed or merged pull requests cannot request a dependency rebase.');
  assert(Number.isFinite(timeoutMs) && timeoutMs >= 0 && Number.isFinite(pollMs) && pollMs > 0,
    'Invalid rebase acknowledgement polling bounds.');
  const trustedEnv = await maintenanceContext({ api, env, operation: 'merge' });
  const state = await inspect({ api, env: trustedEnv });
  assert(state.eligible && state.automerge && state.scope === 'release',
    'Only a verified release-console update may request an automatic rebase.');
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
  const [current, currentMain] = await Promise.all([api('GET', path), api('GET', mainPath)]);
  assert(samePullRequest(current, state, repository) && current.head.sha === state.head,
    'Pull request changed before the rebase request.');
  assert(currentMain.ref === main.ref && currentMain.object?.sha === main.object.sha,
    'Main changed before the rebase request.');
  if (requests.length === 0 && current.mergeable_state !== 'behind') {
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

export async function main(env = process.env) {
  const result = await requestRebase({ api: githubApi(env.GH_TOKEN), rebaseApi: githubApi(env.DEPENDABOT_REBASE_TOKEN), env });
  if (env.GITHUB_OUTPUT) {
    await appendFile(env.GITHUB_OUTPUT, Object.entries(result).map(([key, value]) => `${key}=${value}\n`).join(''));
  }
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((result) => console.log(JSON.stringify(result)))
    .catch((error) => { console.error(error.message); process.exitCode = 1; });
}
