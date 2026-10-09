const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const sha = 'a'.repeat(40);
const main = 'b'.repeat(40);
const base = '3016dcb96803ff9304bd6fb1bdf8d944230717e0';
const group = '59be1867-4747-4b71-956e-0858de78b2ad';
const repo = 'kunal26das/yify';
const branch = 'release/storage-write-consistency-1.8.14';
const env = {
  GITHUB_REPOSITORY: repo,
  GITHUB_EVENT_NAME: 'workflow_dispatch',
  GITHUB_REF: 'refs/heads/main',
  GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/publish-android-ota.yml@refs/heads/main`,
  GITHUB_SHA: main,
  GITHUB_RUN_ID: '777',
  GITHUB_RUN_ATTEMPT: '1',
  SOURCE_SHA: sha,
  SOURCE_RUN_ID: '42',
  SOURCE_RUN_ATTEMPT: '1',
};

async function controller() {
  return import('../scripts/android-ota-controller.mjs');
}

function fixtureApi({runChanges = {}, latestChanges = {}, jobsChange, sourceRef = sha, mainRef = main} = {}) {
  const workflow = {id: 9, path: '.github/workflows/ci.yml'};
  const run = {id: 42, run_attempt: 1, workflow_id: 9, path: workflow.path,
    event: 'workflow_dispatch', head_branch: branch, head_sha: sha,
    status: 'completed', conclusion: 'success', repository: {full_name: repo, id: 5},
    head_repository: {full_name: repo, id: 5}, ...runChanges};
  const jobs = ['Verify dependency automation context', 'Typecheck and tests',
    'Web exports render and isolate catalog data', 'Typecheck and test release console']
    .map((name) => ({name, status: 'completed', conclusion: 'success',
      ...(name === 'Verify dependency automation context' ? {steps: [
        {name: 'Checkout trusted automation', status: 'completed', conclusion: 'skipped'},
        {name: 'Verify PR identity and commit chain', status: 'completed', conclusion: 'skipped'},
      ]} : {})}));
  return async (method, endpoint) => {
    assert.equal(method, 'GET');
    if (endpoint.endsWith('/git/ref/heads/main')) return {ref: 'refs/heads/main', object: {type: 'commit', sha: mainRef}};
    if (endpoint.endsWith(`/git/ref/heads/${branch}`)) return {ref: `refs/heads/${branch}`, object: {type: 'commit', sha: sourceRef}};
    if (endpoint.endsWith('/actions/workflows/ci.yml')) return workflow;
    if (endpoint.endsWith('/actions/runs/42')) return {...run, ...latestChanges};
    if (endpoint.endsWith('/actions/runs/42/attempts/1')) return run;
    if (endpoint.includes('/actions/runs/42/attempts/1/jobs')) return {jobs: jobsChange ? jobsChange(jobs) : jobs};
    throw Error(`Unexpected API request: ${endpoint}`);
  };
}

test('dispatch requires trusted main workflow, exact inputs, and first attempt', async () => {
  const {validateDispatch} = await controller();
  assert.equal(validateDispatch(env).source, sha);
  for (const change of [
    {GITHUB_REPOSITORY: 'other/repo'}, {GITHUB_REF: 'refs/heads/other'},
    {GITHUB_WORKFLOW_REF: `${repo}/.github/workflows/other.yml@refs/heads/main`},
    {GITHUB_RUN_ATTEMPT: '2'}, {SOURCE_SHA: `${sha};echo injected`},
    {SOURCE_RUN_ID: '42;true'}, {SOURCE_RUN_ATTEMPT: '0'},
  ]) assert.throws(() => validateDispatch({...env, ...change}));
});

test('exact source CI rejects PR merge, stale attempts, wrong branch, and missing jobs', async () => {
  const {verifySourceCI} = await controller();
  assert.equal((await verifySourceCI(fixtureApi(), env)).source, sha);
  await assert.rejects(verifySourceCI(fixtureApi({runChanges: {event: 'pull_request'}}), env));
  await assert.rejects(verifySourceCI(fixtureApi({runChanges: {head_sha: 'c'.repeat(40)}}), env));
  await assert.rejects(verifySourceCI(fixtureApi({runChanges: {head_branch: 'main'}}), env));
  await assert.rejects(verifySourceCI(fixtureApi({latestChanges: {run_attempt: 2}}), env));
  await assert.rejects(verifySourceCI(fixtureApi({sourceRef: 'c'.repeat(40)}), env));
  await assert.rejects(verifySourceCI(fixtureApi({mainRef: 'c'.repeat(40)}), env));
  await assert.rejects(verifySourceCI(fixtureApi({jobsChange: (jobs) => jobs.slice(1)}), env));
  await assert.rejects(verifySourceCI(fixtureApi({jobsChange: (jobs) =>
    jobs.map((job) => job.name === 'Typecheck and tests' ? {...job, conclusion: 'failure'} : job)}), env));
});

test('Production mapping rejects splits and paused channels', async () => {
  const {validateChannel} = await controller();
  const branchInfo = {id: 'branch-id', name: 'Production'};
  const channel = {name: 'Production', isPaused: false, updateBranches: [branchInfo],
    branchMapping: JSON.stringify({version: 0, data: [{branchId: 'branch-id', branchMappingLogic: 'true'}]})};
  assert.equal(validateChannel({currentPage: channel}), 'Production');
  assert.throws(() => validateChannel({currentPage: {...channel, isPaused: true}}));
  assert.throws(() => validateChannel({currentPage: {...channel, updateBranches: [branchInfo, {id: 'other', name: 'other'}]}}));
  assert.throws(() => validateChannel({currentPage: {...channel, branchMapping: JSON.stringify({version: 0,
    data: [{branchId: 'branch-id', branchMappingLogic: '50'}]})}}));
});

test('latest group and duplicate-source gates reject stale state and rollout', async () => {
  const {validateLatestGroup, validateGroupDetails} = await controller();
  const summary = {branch: 'Production', runtimeVersion: '1.8.14', group,
    platforms: 'android', isRollBackToEmbedded: false, rolloutPercentage: null};
  assert.equal(validateLatestGroup({currentPage: [summary]}, sha), group);
  for (const change of [
    {group: 'c0fb02a4-40de-469c-90da-945477f87182'}, {runtimeVersion: '1.8.15'},
    {branch: 'Staging'}, {platforms: 'ios'}, {rolloutPercentage: 20},
  ]) assert.throws(() => validateLatestGroup({currentPage: [{...summary, ...change}]}, sha));
  const details = [{id: '8ea479fc-57bc-44d9-b2db-e81ab6dc20d9', group,
    branch: 'Production', runtimeVersion: '1.8.14', platform: 'android',
    gitCommitHash: base, isRollBackToEmbedded: false}];
  assert.equal(validateGroupDetails(details, sha, {isExpected: true, requestedGroup: group}), group);
  assert.throws(() => validateGroupDetails([{...details[0], gitCommitHash: sha}], sha,
    {requestedGroup: group}));
  assert.throws(() => validateGroupDetails(details, sha, {requestedGroup: 'b'.repeat(36)}));
});

test('artifact staging copies only Android output, rejects traversal, and excludes secrets', async () => {
  const {stageArtifacts} = await controller();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-controller-'));
  const source = path.join(root, 'candidate');
  const output = path.join(root, 'evidence');
  const exportDir = path.join(source, '.expo', 'android-ota-export');
  const publication = path.join(source, '.expo', 'android-ota', '777-1');
  fs.mkdirSync(exportDir, {recursive: true});
  fs.mkdirSync(publication, {recursive: true});
  try {
    fs.writeFileSync(path.join(publication, 'plan.json'), '{"kind":"ota"}');
    fs.writeFileSync(path.join(publication, 'secret-token.txt'), 'secret');
    fs.writeFileSync(path.join(exportDir, 'metadata.json'), JSON.stringify({version: 0, bundler: 'metro',
      fileMetadata: {android: {bundle: 'bundle.js', assets: []}}}));
    fs.writeFileSync(path.join(exportDir, 'bundle.js'), 'bundle');
    fs.writeFileSync(path.join(exportDir, 'bundle.js.map'), '{}');
    fs.writeFileSync(path.join(exportDir, 'secret-token.txt'), 'secret');
    const records = stageArtifacts(source, env, output);
    assert.equal(records.length, 4);
    assert.ok(fs.existsSync(path.join(output, 'publication', 'plan.json')));
    assert.ok(fs.existsSync(path.join(output, 'android-export', 'bundle.js.map')));
    assert.ok(!fs.existsSync(path.join(output, 'publication', 'secret-token.txt')));
    assert.ok(!fs.existsSync(path.join(output, 'android-export', 'secret-token.txt')));
    fs.writeFileSync(path.join(exportDir, 'metadata.json'), JSON.stringify({version: 0, bundler: 'metro',
      fileMetadata: {android: {bundle: '../secret-token.txt', assets: []}}}));
    stageArtifacts(source, env, path.join(root, 'rejected'));
    assert.ok(fs.existsSync(path.join(root, 'rejected', 'export-rejected.txt')));
    assert.ok(!fs.existsSync(path.join(root, 'rejected', 'android-export', 'secret-token.txt')));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('publication verification binds the receipt, remote update, and active channel', async () => {
  const {verifyPublication, validatePublication} = await controller();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-publication-'));
  const directory = path.join(root, '.expo', 'android-ota', '777-1');
  fs.mkdirSync(directory, {recursive: true});
  const update = {id: '8ea479fc-57bc-44d9-b2db-e81ab6dc20d9',
    group: 'c0fb02a4-40de-469c-90da-945477f87182', branch: 'Production',
    runtimeVersion: '1.8.14', platform: 'android', gitCommitHash: sha, isRollBackToEmbedded: false};
  const channel = {name: 'Production', isPaused: false,
    updateBranches: [{id: 'branch-id', name: 'Production'}],
    branchMapping: JSON.stringify({version: 0, data: [{branchId: 'branch-id', branchMappingLogic: 'true'}]})};
  const summary = {...update, platforms: 'android'};
  const read = (change = {}) => (cwd, args) => {
    assert.equal(cwd, root);
    if (args[0] === 'update:view') {
      assert.equal(args[1], update.group);
      return [{...update, ...change.remote}];
    }
    if (args[0] === 'channel:view') return {currentPage: {...channel, ...change.channel}};
    if (args[0] === 'update:list') return {currentPage: [{...summary, ...change.summary}]};
    throw Error(`Unexpected EAS read: ${args[0]}`);
  };
  try {
    fs.writeFileSync(path.join(directory, 'plan.json.eas.json'), JSON.stringify([update]));
    assert.equal(verifyPublication(root, env, read()).update.id, update.id);
    assert.ok(fs.existsSync(path.join(directory, 'verified.json')));
    for (const change of [{platform: 'ios'}, {branch: 'Staging'}, {runtimeVersion: '1.8.15'},
      {gitCommitHash: base}, {group}, {isRollBackToEmbedded: true}]) {
      assert.throws(() => validatePublication([{...update, ...change}], sha));
    }
    assert.throws(() => validatePublication([update, update], sha));
    assert.throws(() => verifyPublication(root, env, read({remote: {id: update.group}})));
    assert.throws(() => verifyPublication(root, env, read({channel: {isPaused: true}})));
    assert.throws(() => verifyPublication(root, env, read({summary: {group}})));
    assert.throws(() => verifyPublication(root, env, read({summary: {rolloutPercentage: 10}})));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('artifact staging rejects symlinked exports and source maps', async () => {
  const {stageArtifacts} = await controller();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-symlink-'));
  const source = path.join(root, 'candidate');
  const exportDir = path.join(source, '.expo', 'android-ota-export');
  fs.mkdirSync(exportDir, {recursive: true});
  try {
    fs.writeFileSync(path.join(root, 'secret.txt'), 'secret');
    fs.writeFileSync(path.join(exportDir, 'metadata.json'), JSON.stringify({version: 0, bundler: 'metro',
      fileMetadata: {android: {bundle: 'bundle.js', assets: []}}}));
    fs.writeFileSync(path.join(exportDir, 'bundle.js'), 'bundle');
    fs.symlinkSync(path.join(root, 'secret.txt'), path.join(exportDir, 'bundle.js.map'));
    const output = path.join(root, 'rejected');
    const records = stageArtifacts(source, env, output);
    assert.ok(fs.existsSync(path.join(output, 'export-rejected.txt')));
    assert.ok(!records.some((record) => record.path.endsWith('.map')));
    assert.ok(!fs.existsSync(path.join(output, 'android-export', 'bundle.js.map')));
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});

test('native config accepts a relative checkout and the preserved baseline EAS pin', async () => {
  const {verifyNativeConfig} = await controller();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ota-config-'));
  fs.mkdirSync(path.join(root, 'release'));
  const project = '130cfded-cef0-49b3-94a4-82d3a3852ef5';
  const android = {package: 'io.github.kunal26das.yify', versionCode: 96};
  const config = {expo: {version: '1.8.14', runtimeVersion: '1.8.14', android,
    extra: {eas: {projectId: project}}, updates: {url: `https://u.expo.dev/${project}`,
      requestHeaders: {'expo-channel-name': 'Production'}}}};
  try {
    fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({version: '1.8.14', versionCode: 96}));
    fs.writeFileSync(path.join(root, 'app.json'), JSON.stringify(config));
    fs.writeFileSync(path.join(root, 'app.config.js'), `module.exports = ${JSON.stringify(config)};`);
    fs.writeFileSync(path.join(root, 'release/releases.json'), JSON.stringify({releases: [
      {platform: 'android', channel: 'Production', version: '1.8.14', runtimeVersion: '1.8.14'},
    ]}));
    const releasePackage = path.join(root, 'release/package.json');
    fs.writeFileSync(releasePackage, JSON.stringify({dependencies: {'eas-cli': '24.9.0'}}));
    assert.equal(verifyNativeConfig(path.relative(process.cwd(), root), env).versionCode, 96);
    fs.writeFileSync(releasePackage, JSON.stringify({dependencies: {'eas-cli': '24.10.0'}}));
    assert.throws(() => verifyNativeConfig(root, env), /EAS CLI differs/);
  } finally {
    fs.rmSync(root, {recursive: true, force: true});
  }
});


test('source CI proves both dependency-input steps were skipped exactly once', async () => {
  const {verifySourceCI} = await controller();
  assert.equal((await verifySourceCI(fixtureApi(), env)).source, sha);
  const changeSteps = (transform) => fixtureApi({jobsChange: (jobs) => jobs.map((job) =>
    job.name === 'Verify dependency automation context' ? {...job, steps: transform(job.steps)} : job)});
  await assert.rejects(verifySourceCI(changeSteps(() => undefined), env), /must skip dependency automation step/);
  for (const name of ['Checkout trusted automation', 'Verify PR identity and commit chain']) {
    for (const transform of [
      (steps) => steps.filter((step) => step.name !== name),
      (steps) => [...steps, steps.find((step) => step.name === name)],
      (steps) => steps.map((step) => step.name === name ? {...step, status: 'in_progress'} : step),
      (steps) => steps.map((step) => step.name === name ? {...step, conclusion: 'success'} : step),
      (steps) => steps.map((step) => step.name === name ? {...step, conclusion: 'failure'} : step),
      (steps) => steps.map((step) => step.name === name ? {...step, conclusion: null} : step),
    ]) {
      await assert.rejects(verifySourceCI(changeSteps(transform), env), /must skip dependency automation step/);
    }
  }
});


test('post-publication verification runs after publisher failure only when a receipt exists', () => {
  const workflow = fs.readFileSync(path.join(__dirname, '../.github/workflows/publish-android-ota.yml'), 'utf8');
  const verification = workflow.split('      - name: Verify published Android group and active Production mapping\n')[1]
    .split('      - name: ')[0];
  assert.match(verification, /if: always\(\) && hashFiles\('candidate\/\.expo\/android-ota\/\*\/plan\.json\.eas\.json'\) != ''/);
  assert.match(verification, /verify-publication candidate/);
  assert.ok(!workflow.includes('continue-on-error:'));
});


test('production environment preflight rejects reserved overrides without exposing values', async () => {
  const {validateProductionEnvironment, verifyProductionEnvironment} = await controller();
  const empty = 'Environment: production\nNo variables found for this environment.\n';
  assert.doesNotThrow(() => validateProductionEnvironment(empty));
  assert.doesNotThrow(() => validateProductionEnvironment('\nEnvironment: production\nEXPO_PUBLIC_NAME=value\nAPI_KEY=***** (masked)\n'));
  for (const name of ['EXPO_RUNTIME_VERSION', 'EXPO_UPDATE_CHANNEL']) {
    for (const value of ['1.8.14', 'Production', 'confidential-wrong-value', '***** (This is a secret env variable)', '']) {
      assert.throws(() => validateProductionEnvironment(`Environment: production\n${name}=${value}\n`),
        (error) => error.message.includes('reserved runtime or channel override') && !error.message.includes(`${name}=${value}`) && !error.message.includes('confidential-wrong-value'));
    }
  }
  assert.doesNotThrow(() => validateProductionEnvironment('Environment: production\nEXPO_RUNTIME_VERSION_SUFFIX=value\nPREFIX_EXPO_UPDATE_CHANNEL=value'));
  for (const output of ['', 'Environment: preview\nA=b', 'Environment: production\n',
    'Environment: production\nA=b\nmultiline-value', 'Environment: production\nEXPO_RUNTIME_VERSION=1.8.14\nOTHER=value',
    '\u001b[1mEnvironment: production\u001b[0m\nA=b', 'Environment: production\n\u001b[1mEXPO_RUNTIME_VERSION\u001b[0m=value', 'Environment: production\nA=b\nA=c']) {
    assert.throws(() => validateProductionEnvironment(output));
  }
  const scopes = [];
  assert.equal(verifyProductionEnvironment('/candidate', env, (cwd, args) => {
    assert.equal(cwd, '/candidate');
    assert.deepEqual(args.slice(0, 3), ['env:list', 'production', '--scope']);
    assert.deepEqual(args.slice(4), ['--format', 'short']);
    scopes.push(args[3]);
    return empty;
  }).productionServerOverridesChecked, true);
  assert.deepEqual(scopes, ['project', 'account']);
  assert.throws(() => verifyProductionEnvironment('/candidate', env, (cwd, args) =>
    args[3] === 'account' ? 'Environment: production\nEXPO_RUNTIME_VERSION=*****' : empty));
});
