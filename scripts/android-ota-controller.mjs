#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {githubApi} from './dependabot-lockfile.mjs';

const repository = 'kunal26das/yify';
const sourceBranch = 'release/storage-write-consistency-1.8.14';
const base = '3016dcb96803ff9304bd6fb1bdf8d944230717e0';
const baseTree = 'e3abf90c92acf8c7a31b94e964a5c71584c107e2';
const project = '130cfded-cef0-49b3-94a4-82d3a3852ef5';
const expectedGroup = '59be1867-4747-4b71-956e-0858de78b2ad';
const expectedRelease = 'io.github.kunal26das.yify@1.8.14+96';
const expectedFiles = new Map([
  ['data/repositories/WatchHistoryRepositoryImpl.test.ts', '0b16b0043acb5eae42bac06212bdb2f303f07b53'],
  ['data/repositories/WatchHistoryRepositoryImpl.ts', 'c1c78c62f56632e5b9be0f20b9c21d2aa6a89244'],
  ['data/repositories/WatchlistRepositoryImpl.test.ts', '7cd97201d7e14f50f2611cbdd52b948f61fadbee'],
  ['data/repositories/WatchlistRepositoryImpl.ts', 'e64aaddc486992ba4b365f24d86aa2890f544cd5'],
]);
const requiredChecks = [
  'Verify dependency automation context',
  'Typecheck and tests',
  'Web exports render and isolate catalog data',
  'Typecheck and test release console',
];
const sha = /^[a-f0-9]{40}$/;
const integer = /^[1-9][0-9]*$/;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

function assert(value, message) {
  if (!value) throw new Error(message);
}

function git(cwd, ...args) {
  return execFileSync('git', args, {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
}

export function validateDispatch(env) {
  assert(env.GITHUB_REPOSITORY === repository && env.GITHUB_EVENT_NAME === 'workflow_dispatch' &&
    env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_WORKFLOW_REF === `${repository}/.github/workflows/publish-android-ota.yml@refs/heads/main` &&
    sha.test(env.GITHUB_SHA || ''), 'OTA controller must be dispatched from the trusted main workflow.');
  assert(env.GITHUB_RUN_ATTEMPT === '1', 'OTA publisher reruns are prohibited; recover from saved artifacts without republishing.');
  assert(sha.test(env.SOURCE_SHA || '') && integer.test(env.SOURCE_RUN_ID || '') &&
    integer.test(env.SOURCE_RUN_ATTEMPT || ''), 'Provide the exact source SHA and successful source CI run and attempt.');
  return {source: env.SOURCE_SHA, runId: env.SOURCE_RUN_ID, attempt: env.SOURCE_RUN_ATTEMPT};
}

async function jobsForAttempt(api, runId, attempt) {
  const jobs = [];
  for (let page = 1; page <= 10; page += 1) {
    const result = await api('GET', `repos/${repository}/actions/runs/${runId}/attempts/${attempt}/jobs?per_page=100&page=${page}`);
    assert(Array.isArray(result.jobs), 'Cannot inspect source CI jobs.');
    jobs.push(...result.jobs);
    if (result.jobs.length < 100) return jobs;
  }
  throw new Error('Source CI job list is too large to validate.');
}

export async function verifySourceCI(api, env) {
  const {source, runId, attempt} = validateDispatch(env);
  const root = `repos/${repository}`;
  const [mainRef, sourceRef, workflow, latest, run, jobs] = await Promise.all([
    api('GET', `${root}/git/ref/heads/main`),
    api('GET', `${root}/git/ref/heads/${sourceBranch}`),
    api('GET', `${root}/actions/workflows/ci.yml`),
    api('GET', `${root}/actions/runs/${runId}`),
    api('GET', `${root}/actions/runs/${runId}/attempts/${attempt}`),
    jobsForAttempt(api, runId, attempt),
  ]);
  assert(mainRef?.ref === 'refs/heads/main' && mainRef.object?.type === 'commit' &&
    mainRef.object.sha === env.GITHUB_SHA, 'Main advanced after OTA dispatch.');
  assert(sourceRef?.ref === `refs/heads/${sourceBranch}` && sourceRef.object?.type === 'commit' &&
    sourceRef.object.sha === source, 'Source branch is not at the requested exact commit.');
  assert(integer.test(String(workflow?.id)) && workflow.path === '.github/workflows/ci.yml',
    'Cannot identify the trusted CI workflow.');
  for (const candidate of [latest, run]) {
    assert(String(candidate?.id) === runId && String(candidate?.run_attempt) === attempt &&
      candidate.workflow_id === workflow.id && candidate.path === workflow.path &&
      candidate.event === 'workflow_dispatch' && candidate.head_branch === sourceBranch &&
      candidate.head_sha === source && candidate.status === 'completed' && candidate.conclusion === 'success' &&
      candidate.repository?.full_name === repository && candidate.head_repository?.full_name === repository &&
      integer.test(String(candidate.repository?.id)) && candidate.head_repository?.id === candidate.repository.id,
    'Source CI is not the latest successful attempt for the exact branch commit.');
  }
  for (const name of requiredChecks) {
    const matches = jobs.filter((job) => job.name === name);
    assert(matches.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'success',
      `Source CI did not pass required job: ${name}.`);
  }
  const contextJob = jobs.find((job) => job.name === 'Verify dependency automation context');
  for (const name of ['Checkout trusted automation', 'Verify PR identity and commit chain']) {
    const matches = contextJob.steps?.filter((step) => step.name === name);
    assert(matches?.length === 1 && matches[0].status === 'completed' && matches[0].conclusion === 'skipped',
      `Source CI must skip dependency automation step: ${name}.`);
  }
  return {source, runId, attempt};
}

export function verifySource(cwd, env) {
  cwd = path.resolve(cwd);
  const {source} = validateDispatch(env);
  assert(git(cwd, 'rev-parse', 'HEAD') === source, 'Candidate checkout is not at the requested source SHA.');
  assert(git(cwd, 'status', '--porcelain', '--untracked-files=normal') === '', 'Candidate checkout is dirty.');
  assert(git(cwd, 'rev-parse', `${base}^{tree}`) === baseTree, 'OTA baseline tree has changed.');
  git(cwd, 'merge-base', '--is-ancestor', base, source);
  const changes = git(cwd, 'diff', '--name-status', base, source).split('\n').sort();
  assert(JSON.stringify(changes) === JSON.stringify([
    'A\tdata/repositories/WatchHistoryRepositoryImpl.test.ts',
    'A\tdata/repositories/WatchlistRepositoryImpl.test.ts',
    'M\tdata/repositories/WatchHistoryRepositoryImpl.ts',
    'M\tdata/repositories/WatchlistRepositoryImpl.ts',
  ].sort()), 'Candidate changes extend beyond the four reviewed storage files.');
  for (const [filename, expected] of expectedFiles) {
    assert(git(cwd, 'rev-parse', `${source}:${filename}`) === expected,
      `Candidate ${filename} differs from the reviewed storage backport.`);
  }
  assert(git(cwd, 'show', `${source}:android/app/src/main/AndroidManifest.xml`).includes('expo-channel-name'),
    'Candidate is missing the committed Android update channel.');
  return {source, ...verifyNativeConfig(cwd, env)};
}

export function verifyNativeConfig(cwd, env) {
  cwd = path.resolve(cwd);
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const app = JSON.parse(fs.readFileSync(path.join(cwd, 'app.json'), 'utf8')).expo;
  const ledger = JSON.parse(fs.readFileSync(path.join(cwd, 'release/releases.json'), 'utf8'));
  const releasePkg = JSON.parse(fs.readFileSync(path.join(cwd, 'release/package.json'), 'utf8'));
  assert(pkg.version === '1.8.14' && pkg.versionCode === 96 && app.android?.package === 'io.github.kunal26das.yify' &&
    app.extra?.eas?.projectId === project && releasePkg.dependencies?.['eas-cli'] === '24.9.0',
  'Candidate version, binary code, package, Expo project, or EAS CLI differs.');
  assert(ledger.releases?.some((entry) => entry.platform === 'android' && entry.channel === 'Production' &&
    entry.version === '1.8.14' && entry.runtimeVersion === '1.8.14'),
  'The release ledger does not record the shipped Android Production runtime.');
  const configPath = path.join(cwd, 'app.config.js');
  const config = createRequire(configPath)(configPath).expo;
  assert(config.version === '1.8.14' && config.runtimeVersion === '1.8.14' &&
    config.android?.versionCode === 96 && config.android?.package === app.android.package &&
    config.updates?.url === `https://u.expo.dev/${project}` &&
    config.updates?.requestHeaders?.['expo-channel-name'] === 'Production',
  'Evaluated Expo config does not target the shipped Android binary and Production runtime.');
  assert(!env.EXPO_RUNTIME_VERSION || env.EXPO_RUNTIME_VERSION === '1.8.14', 'A different runtime override is prohibited.');
  assert(!env.EXPO_UPDATE_CHANNEL || env.EXPO_UPDATE_CHANNEL === 'Production', 'A different channel is prohibited.');
  return {runtimeVersion: '1.8.14', versionCode: 96, project};
}

function cliJson(cwd, args, env) {
  let output;
  try {
    output = execFileSync('bash', ['scripts/eas.sh', ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], maxBuffer: 10 * 1024 * 1024, env,
    });
  } catch {
    throw new Error(`EAS read ${args[0]} failed; production OTA state is unverified.`);
  }
  try { return JSON.parse(output); }
  catch { throw new Error(`EAS read ${args[0]} did not return valid JSON.`); }
}

function cliEnvironmentText(cwd, args, env) {
  try {
    return execFileSync('bash', ['scripts/eas.sh', ...args], {
      cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 10 * 1024 * 1024,
      env: {...env, FORCE_COLOR: '0', NO_COLOR: '1'},
    });
  } catch {
    throw new Error('Production environment metadata could not be verified.');
  }
}

export function validateProductionEnvironment(output) {
  assert(typeof output === 'string', 'Production environment listing is malformed.');
  const lines = output.trim().split(/\r?\n/).filter((line) => line.trim() !== '');
  assert(lines.shift() === 'Environment: production' && lines.length > 0,
    'Production environment listing is malformed.');
  if (lines.length === 1 && lines[0] === 'No variables found for this environment.') return;
  const names = new Set();
  for (const line of lines) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
    assert(match && !names.has(match[1]), 'Production environment listing is ambiguous.');
    names.add(match[1]);
  }
  assert(!names.has('EXPO_RUNTIME_VERSION') && !names.has('EXPO_UPDATE_CHANNEL'),
    'Production server environment defines a reserved runtime or channel override. Remove it before publication.');
}

export function verifyProductionEnvironment(cwd, env, read = cliEnvironmentText) {
  for (const scope of ['project', 'account']) {
    validateProductionEnvironment(read(cwd, ['env:list', 'production', '--scope', scope, '--format', 'short'], env));
  }
  return {productionServerOverridesChecked: true};
}

export function validateChannel(payload) {
  const channel = payload?.currentPage;
  assert(channel?.name === 'Production' && channel.isPaused === false &&
    Array.isArray(channel.updateBranches) && channel.updateBranches.length === 1 &&
    channel.updateBranches[0]?.name === 'Production', 'Production channel is not mapped exclusively to its expected active branch.');
  let mapping;
  try { mapping = JSON.parse(channel.branchMapping); }
  catch { throw new Error('Production branch mapping is not valid JSON.'); }
  assert(mapping?.version === 0 && Array.isArray(mapping.data) && mapping.data.length === 1 &&
    mapping.data[0]?.branchId === channel.updateBranches[0].id &&
    mapping.data[0]?.branchMappingLogic === 'true', 'Production has a paused, split, or unexpected branch mapping.');
  return channel.updateBranches[0].name;
}

export function validateLatestGroup(page, source) {
  assert(Array.isArray(page?.currentPage) && page.currentPage.length > 0, 'No Android Production update exists at runtime 1.8.14.');
  const latest = page.currentPage[0];
  assert(latest.branch === 'Production' && latest.runtimeVersion === '1.8.14' &&
    latest.group === expectedGroup && /(^|,\s*)android($|,)/i.test(latest.platforms || '') &&
    latest.isRollBackToEmbedded === false, 'Latest Production Android 1.8.14 group changed.');
  assert(latest.rolloutPercentage == null || latest.rolloutPercentage === 100,
    'An Android update rollout is active.');
  assert(source !== base, 'The baseline source cannot be republished.');
  return latest.group;
}

export function validateGroupDetails(group, source, {isExpected = false, requestedGroup} = {}) {
  assert(Array.isArray(group) && group.length > 0 && group.every((entry) =>
    uuid.test(entry?.id || '') && entry.group === group[0].group && entry.group === requestedGroup &&
    typeof entry.branch === 'string' && entry.branch.length > 0 && entry.runtimeVersion === '1.8.14'),
  'Expo update group details are incomplete or unexpectedly scoped.');
  assert(!group.some((entry) => entry.gitCommitHash === source), 'This source commit has already been published.');
  if (isExpected) {
    assert(group.some((entry) => entry.branch === 'Production' && entry.platform === 'android' && entry.gitCommitHash === base &&
      entry.isRollBackToEmbedded === false), 'Expected prior group does not match the known base source.');
  }
  return group[0].group;
}

export function verifyExpo(cwd, env, read = cliJson, readEnvironment = cliEnvironmentText) {
  const {source} = validateDispatch(env);
  verifySource(cwd, env);
  assert(typeof env.EXPO_TOKEN === 'string' && env.EXPO_TOKEN.trim(), 'Existing EXPO_TOKEN is required for a read-only Expo preflight.');
  verifyProductionEnvironment(cwd, env, readEnvironment);
  const seen = new Set();
  for (let offset = 0; offset < 500; offset += 50) {
    const page = read(cwd, ['update:list', '--all', '--platform', 'android',
      '--runtime-version', '1.8.14', '--offset', String(offset), '--limit', '50', '--json', '--non-interactive'], env);
    assert(Array.isArray(page?.currentPage), 'Expo update listing is malformed.');
    for (const summary of page.currentPage) {
      assert(typeof summary.branch === 'string' && summary.branch.length > 0 &&
        summary.runtimeVersion === '1.8.14' && uuid.test(summary.group || '') &&
        /(^|,\s*)android($|,)/i.test(summary.platforms || '') && !seen.has(summary.group),
      'Expo update listing contains an unexpected or duplicate group.');
      seen.add(summary.group);
      const details = read(cwd, ['update:view', summary.group, '--json'], env);
      validateGroupDetails(details, source, {isExpected: summary.group === expectedGroup,
        requestedGroup: summary.group});
    }
    if (page.currentPage.length < 50) break;
    assert(offset < 450, 'Expo update history exceeds the bounded duplicate-publication scan.');
  }
  assert(seen.has(expectedGroup), 'Expected latest Production update is absent from the project-wide Android history.');
  validateChannel(read(cwd, ['channel:view', 'Production', '--json', '--non-interactive', '--limit', '100'], env));
  const latestPage = read(cwd, ['update:list', '--branch', 'Production', '--platform', 'android',
    '--runtime-version', '1.8.14', '--offset', '0', '--limit', '1', '--json', '--non-interactive'], env);
  const latest = validateLatestGroup(latestPage, source);
  const evidence = {project, channel: 'Production', branch: 'Production', platform: 'android',
    runtimeVersion: '1.8.14', latestGroup: latest, source, scannedGroups: seen.size,
    productionServerOverridesChecked: true,
    checkedAt: new Date().toISOString()};
  const directory = evidenceDirectory(cwd, env);
  fs.mkdirSync(directory, {recursive: true});
  fs.writeFileSync(path.join(directory, 'preflight.json'), `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600});
  return evidence;
}

export function validatePublication(publication, source) {
  assert(Array.isArray(publication) && publication.length === 1,
    'Publication must contain exactly one Android update.');
  const update = publication[0];
  assert(uuid.test(update?.id || '') && uuid.test(update?.group || '') &&
    update.group !== expectedGroup && update.branch === 'Production' &&
    update.platform === 'android' && update.runtimeVersion === '1.8.14' &&
    update.gitCommitHash === source && update.isRollBackToEmbedded === false,
  'Published update does not match the exact Android Production source and runtime.');
  return update;
}

export function verifyPublication(cwd, env, read = cliJson) {
  const {source} = validateDispatch(env);
  const directory = evidenceDirectory(cwd, env);
  const receipt = JSON.parse(fs.readFileSync(path.join(directory, 'plan.json.eas.json'), 'utf8'));
  const published = validatePublication(receipt, source);
  const remote = validatePublication(read(cwd, ['update:view', published.group, '--json'], env), source);
  assert(remote.id === published.id && remote.group === published.group,
    'Remote update differs from the saved publication receipt.');
  validateChannel(read(cwd, ['channel:view', 'Production', '--json', '--non-interactive', '--limit', '100'], env));
  const page = read(cwd, ['update:list', '--branch', 'Production', '--platform', 'android',
    '--runtime-version', '1.8.14', '--offset', '0', '--limit', '1', '--json', '--non-interactive'], env);
  assert(Array.isArray(page?.currentPage) && page.currentPage.length === 1 &&
    page.currentPage[0].group === published.group && page.currentPage[0].branch === 'Production' &&
    page.currentPage[0].runtimeVersion === '1.8.14' && page.currentPage[0].platforms === 'android' &&
    page.currentPage[0].isRollBackToEmbedded === false &&
    (page.currentPage[0].rolloutPercentage == null || page.currentPage[0].rolloutPercentage === 100),
  'Published group is not the active latest Android Production update. Inspect receipts; do not republish.');
  const evidence = {project, channel: 'Production', source, update: remote,
    checkedAt: new Date().toISOString()};
  fs.writeFileSync(path.join(directory, 'verified.json'), `${JSON.stringify(evidence, null, 2)}\n`, {mode: 0o600});
  return evidence;
}

function evidenceDirectory(cwd, env) {
  assert(integer.test(env.GITHUB_RUN_ID || '') && env.GITHUB_RUN_ATTEMPT === '1', 'Invalid publisher run identity.');
  return path.join(cwd, '.expo', 'android-ota', `${env.GITHUB_RUN_ID}-${env.GITHUB_RUN_ATTEMPT}`);
}

export function preparePlan(cwd, env) {
  const {source} = validateDispatch(env);
  verifySource(cwd, env);
  const directory = evidenceDirectory(cwd, env);
  fs.mkdirSync(directory, {recursive: true});
  const filename = path.join(directory, 'plan.json');
  const plan = {kind: 'ota', releases: {android: expectedRelease}, commit: source,
    environment: 'production', runtimeVersion: '1.8.14'};
  fs.writeFileSync(filename, `${JSON.stringify(plan, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
  return filename;
}

function safeRelative(value) {
  assert(typeof value === 'string' && value.length > 0 && value.length <= 256 &&
    !value.startsWith('/') && !value.split('/').some((part) => part === '' || part.startsWith('.')) &&
    /^[a-zA-Z0-9._/-]+$/.test(value), 'Expo export has an unsafe artifact path.');
  return value;
}

function collectExportFiles(exportDir) {
  const metadata = JSON.parse(fs.readFileSync(path.join(exportDir, 'metadata.json'), 'utf8'));
  assert(metadata.version === 0 && metadata.bundler === 'metro' &&
    Object.keys(metadata.fileMetadata || '').join(',') === 'android', 'Export metadata is not Android-only Metro output.');
  const android = metadata.fileMetadata.android;
  assert(Array.isArray(android.assets), 'Android export has no asset manifest.');
  const bundle = safeRelative(android.bundle);
  const files = new Set(['metadata.json', bundle]);
  for (const entry of android.assets) files.add(safeRelative(entry.path));
  for (const entry of fs.readdirSync(exportDir, {recursive: true, withFileTypes: true})) {
    if (!entry.isFile() || !/\.(js|hbc)\.map$/.test(entry.name)) continue;
    const absolute = path.join(entry.parentPath, entry.name);
    const relative = safeRelative(path.relative(exportDir, absolute).replaceAll(path.sep, '/'));
    if (fs.existsSync(absolute.slice(0, -4))) {
      files.add(relative);
      files.add(relative.slice(0, -4));
    }
  }
  assert(files.has(`${bundle}.map`), 'Android export has no matching external source map.');
  if (fs.existsSync(path.join(exportDir, 'assetmap.json'))) files.add('assetmap.json');
  if (fs.existsSync(path.join(exportDir, 'eas-update-metadata.json'))) files.add('eas-update-metadata.json');
  return [...files].sort();
}

function copyRegular(sourceRoot, relative, destinationRoot, prefix) {
  const parts = safeRelative(relative).split('/');
  assert(fs.lstatSync(sourceRoot).isDirectory() && !fs.lstatSync(sourceRoot).isSymbolicLink(),
    'Refusing to archive through a symlinked export directory.');
  let current = sourceRoot;
  for (const part of parts) {
    current = path.join(current, part);
    const stat = fs.lstatSync(current);
    assert(!stat.isSymbolicLink(), 'Refusing to archive a symlink.');
  }
  assert(fs.statSync(current).isFile(), 'Refusing to archive a non-file.');
  const target = path.join(destinationRoot, ...parts);
  fs.mkdirSync(path.dirname(target), {recursive: true});
  fs.copyFileSync(current, target);
  return {path: `${prefix}/${relative}`, sha256: createHash('sha256').update(fs.readFileSync(target)).digest('hex'),
    bytes: fs.statSync(target).size};
}

export function stageArtifacts(cwd, env, output) {
  assert(integer.test(env.GITHUB_RUN_ID || '') && env.GITHUB_RUN_ATTEMPT === '1', 'Invalid publisher run identity.');
  fs.mkdirSync(output, {recursive: true});
  const records = [];
  if (fs.existsSync(cwd)) {
    const directory = evidenceDirectory(cwd, env);
    const selected = ['plan.json', 'plan.json.eas.json', 'plan.json.published.json', 'preflight.json', 'verified.json'];
    for (const relative of selected) {
      if (fs.existsSync(path.join(directory, relative))) {
        records.push(copyRegular(directory, relative, path.join(output, 'publication'), 'publication'));
      }
    }
    const exportDir = path.join(cwd, '.expo', 'android-ota-export');
    if (fs.existsSync(exportDir)) {
      try {
        for (const relative of collectExportFiles(exportDir)) {
          records.push(copyRegular(exportDir, relative, path.join(output, 'android-export'), 'android-export'));
        }
      } catch {
        fs.writeFileSync(path.join(output, 'export-rejected.txt'),
          'The Android export was incomplete or contained an unexpected file path. Inspect the original failed run without republishing.\n');
      }
    }
  }
  fs.writeFileSync(path.join(output, 'checksums.json'), `${JSON.stringify({files: records}, null, 2)}\n`);
  return records;
}

async function main() {
  const [mode, cwd = process.cwd(), output] = process.argv.slice(2);
  const env = process.env;
  let result;
  if (mode === 'verify-ci') result = await verifySourceCI(githubApi(env.GH_TOKEN), env);
  else if (mode === 'verify-source') result = verifySource(cwd, env);
  else if (mode === 'prepare-plan') result = preparePlan(cwd, env);
  else if (mode === 'verify-expo') result = verifyExpo(cwd, env);
  else if (mode === 'verify-publication') result = verifyPublication(cwd, env);
  else if (mode === 'stage-artifacts') result = stageArtifacts(cwd, env, output);
  else throw new Error('Unsupported Android OTA controller command.');
  console.log(JSON.stringify(result));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
