const test = require('node:test');
const assert = require('node:assert/strict');
const { readFile, mkdtemp, mkdir, writeFile, cp } = require('node:fs/promises');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
const { spawnSync } = require('node:child_process');

const root = resolve(__dirname, '..');
const sha = '3c91ecbca833aa5230d6fe11bdc41c2e88da5480';
const banned = ['merge', 'publish', 'production_release', 'production_config_change', 'campaign_launch', 'recurring_schedule'];

let api;
let manifest;

test.before(async () => {
  api = await import('../scripts/check-agent-team.mjs');
  manifest = JSON.parse(await readFile(join(root, 'config/agent-team.json'), 'utf8'));
});

function assignment(id = 'TEAM-001', role = 'app_engineer', file = 'presentation/example.tsx') {
  return {
    taskId: id,
    role,
    problem: 'A test problem',
    outcome: 'A verified outcome',
    startingCommit: sha,
    context: 'A bounded fixture',
    responsibility: 'Implement the owned file',
    fileOwnership: [file],
    allowedTools: ['repository shell'],
    allowedActions: ['read', 'edit', 'test'],
    prohibitedSideEffects: [...banned],
    acceptanceCriteria: ['The behavior is checked'],
    requiredEvidence: ['A passing focused test'],
    dependencies: [],
    scope: 'The owned file only',
    nextHandoff: 'Send to QA',
    requestedModel: 'gpt-6-sol',
    requestedEffort: 'high',
  };
}

function report() {
  return {
    taskId: 'TEAM-001',
    role: 'app_engineer',
    status: 'complete',
    findings: ['A tested change'],
    evidence: ['Focused test output'],
    artifacts: [],
    changedFiles: ['presentation/example.tsx'],
    commit: sha,
    verification: [{ check: 'focused test', status: 'passed', evidence: 'exit 0' }],
    remainingRisks: [],
    nextAction: 'Send to QA',
    configuration: {
      requestedModel: 'gpt-6-sol',
      requestedEffort: 'high',
      acceptedModel: 'gpt-6-sol',
      acceptedEffort: 'high',
      effectiveModel: null,
      effectiveEffort: null,
      effectiveEvidence: null,
    },
  };
}

test('the whole repository team policy is valid', async () => {
  assert.equal((await api.validateRepository(root)).roles.length, 12);
});

test('the whole-repository fixture rejects an extra role brief', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'yify-team-'));
  for (const file of ['AGENTS.md', 'CLAUDE.md', 'config/agent-team.json', 'docs/agents/team.md', 'docs/agents/state.md', 'docs/agents/verification.md']) {
    await mkdir(join(fixture, file, '..'), { recursive: true });
    await cp(join(root, file), join(fixture, file));
  }
  await cp(join(root, 'docs/agents/roles'), join(fixture, 'docs/agents/roles'), { recursive: true });
  await writeFile(join(fixture, 'docs/agents/roles/unknown.md'), '# Unknown\n');
  await assert.rejects(api.validateRepository(fixture), /role brief files/);
});

test('exactly twelve known roles and their settings are required', () => {
  assert.equal(api.validateManifest(manifest).roles.length, 12);
  const duplicate = structuredClone(manifest);
  duplicate.roles[1].id = 'lead';
  assert.throws(() => api.validateManifest(duplicate), /duplicate role/);
  const unknown = structuredClone(manifest);
  unknown.roles[1].id = 'unknown';
  assert.throws(() => api.validateManifest(unknown), /unknown role/);
  const changed = structuredClone(manifest);
  changed.roles[4].defaultEffort = 'high';
  assert.throws(() => api.validateManifest(changed), /role qa/);
  const extra = structuredClone(manifest);
  extra.experimentalRuntimeLoader = true;
  assert.throws(() => api.validateManifest(extra), /unknown/);
});

test('bounded assignments accept isolated write ownership', () => {
  assert.equal(api.validateAssignments([assignment(), assignment('TEAM-002', 'backend_engineer', 'data/example.ts')], manifest).length, 2);
});

test('assignments reject unknown and malformed delegation fields', () => {
  const unknown = assignment();
  unknown.automaticRoleLoading = true;
  assert.throws(() => api.validateAssignments([unknown], manifest), /unknown/);
  const missing = assignment();
  delete missing.startingCommit;
  assert.throws(() => api.validateAssignments([missing], manifest), /missing/);
  const unsupported = assignment();
  unsupported.requestedEffort = 'infinite';
  assert.throws(() => api.validateAssignments([unsupported], manifest), /unsupported/);
  const invalidRole = assignment();
  invalidRole.role = 'unknown';
  assert.throws(() => api.validateAssignments([invalidRole], manifest), /known specialist/);
  const duplicate = [assignment(), assignment('TEAM-001', 'backend_engineer', 'data/example.ts')];
  assert.throws(() => api.validateAssignments(duplicate, manifest), /duplicate task ID/);
});

test('assignments enforce concurrency and file ownership', () => {
  const many = [0, 1, 2, 3].map((index) => assignment(`TEAM-${index}`, 'app_engineer', `presentation/file${index}.tsx`));
  assert.throws(() => api.validateAssignments(many, manifest), /three-specialist/);
  assert.throws(() => api.validateAssignments([assignment('TEAM-1', 'app_engineer', 'presentation/'), assignment('TEAM-2', 'backend_engineer', 'presentation/example.tsx')], manifest), /file ownership conflict/);
  assert.throws(() => api.validateAssignments([assignment('TEAM-1', 'app_engineer', 'presentation/example.tsx'), assignment('TEAM-2', 'backend_engineer', 'presentation/example.tsx')], manifest), /file ownership conflict/);
  assert.throws(() => api.validateAssignments([assignment('TEAM-1', 'app_engineer', 'new-module'), assignment('TEAM-2', 'backend_engineer', 'new-module/example.ts')], manifest), /file ownership conflict/);
  assert.throws(() => api.validateAssignments([assignment('TEAM-1', 'app_engineer', 'new-module'), assignment('TEAM-2', 'backend_engineer', 'new-module/')], manifest), /file ownership conflict/);
  assert.equal(api.validateAssignments([assignment('TEAM-1', 'app_engineer', 'new-module'), assignment('TEAM-2', 'backend_engineer', 'new-module-extra/example.ts')], manifest).length, 2);
  assert.throws(() => api.validateAssignments([assignment('TEAM-1', 'app_engineer', '../outside.ts')], manifest), /clean repo-relative/);
  const reviewer = assignment('TEAM-3', 'reviewer');
  assert.throws(() => api.validateAssignments([reviewer], manifest), /reviewer must be read-only/);
});

test('specialists cannot be delegated release or merge authority', () => {
  const release = assignment('TEAM-1', 'release_engineer');
  release.allowedActions.push('production_release');
  assert.throws(() => api.validateAssignments([release], manifest), /lead-only action/);
  const merge = assignment();
  merge.allowedActions.push('merge');
  assert.throws(() => api.validateAssignments([merge], manifest), /lead-only action/);
  const missingBan = assignment();
  missingBan.prohibitedSideEffects.pop();
  assert.throws(() => api.validateAssignments([missingBan], manifest), /must include recurring_schedule/);
});

test('reports require complete, truthful structured fields', () => {
  assert.equal(api.validateReport(report(), manifest).status, 'complete');
  const unknown = report();
  unknown.unverifiedModel = 'gpt-6-sol';
  assert.throws(() => api.validateReport(unknown, manifest), /unknown/);
  const missing = report();
  delete missing.remainingRisks;
  assert.throws(() => api.validateReport(missing, manifest), /missing/);
  const invalidStatus = report();
  invalidStatus.status = 'done';
  assert.throws(() => api.validateReport(invalidStatus, manifest), /unsupported/);
  const uncommitted = report();
  uncommitted.commit = null;
  assert.equal(api.validateReport(uncommitted, manifest).commit, null);
  const malformedCommit = report();
  malformedCommit.commit = 'short';
  assert.throws(() => api.validateReport(malformedCommit, manifest), /full lowercase commit SHA/);
  const unsubstantiated = report();
  unsubstantiated.evidence = [];
  assert.throws(() => api.validateReport(unsubstantiated, manifest), /requires findings and evidence/);
  const unverified = report();
  unverified.configuration.effectiveModel = 'gpt-6-sol';
  assert.throws(() => api.validateReport(unverified, manifest), /independent evidence/);
});

test('report changes must belong to the matching assignment', async () => {
  assert.equal(api.validateHandoff(report(), [assignment()], manifest).status, 'complete');
  const outside = report();
  outside.changedFiles = ['data/unowned.ts'];
  assert.throws(() => api.validateHandoff(outside, [assignment()], manifest), /outside assignment fileOwnership/);
  const exactFile = report();
  exactFile.changedFiles = ['presentation/example.tsx/nested.ts'];
  assert.throws(() => api.validateHandoff(exactFile, [assignment()], manifest), /outside assignment fileOwnership/);
  const directory = report();
  directory.changedFiles = ['presentation/nested/example.tsx'];
  assert.equal(api.validateHandoff(directory, [assignment('TEAM-001', 'app_engineer', 'presentation/')], manifest).status, 'complete');
  const adjacent = report();
  adjacent.changedFiles = ['presentation-extra/example.tsx'];
  assert.throws(() => api.validateHandoff(adjacent, [assignment('TEAM-001', 'app_engineer', 'presentation/')], manifest), /outside assignment fileOwnership/);
  const fixture = await mkdtemp(join(tmpdir(), 'yify-team-handoff-'));
  const assignmentFile = join(fixture, 'assignments.json');
  const reportFile = join(fixture, 'report.json');
  await writeFile(assignmentFile, JSON.stringify([assignment()]));
  await writeFile(reportFile, JSON.stringify(outside));
  const result = spawnSync(process.execPath, ['scripts/check-agent-team.mjs', '--assignments', assignmentFile, '--report', reportFile], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /outside assignment fileOwnership/);
});

test('only one lead-decided production operation is valid', () => {
  const operation = { id: 'REL-1', type: 'release', decisionMaker: 'lead', target: 'production', startingCommit: sha, authorizationEvidence: 'Current user authorization reference' };
  assert.equal(api.validateProductionOperations([operation], manifest).length, 1);
  assert.throws(() => api.validateProductionOperations([operation, { ...operation, id: 'REL-2' }], manifest), /one-operation limit/);
  assert.throws(() => api.validateProductionOperations([{ ...operation, decisionMaker: 'release_engineer' }], manifest), /lead decision/);
  assert.throws(() => api.validateProductionOperations([{ ...operation, approvalByCredential: true }], manifest), /unknown/);
});


test('CLI validates explicitly supplied falsy JSON inputs', async () => {
  const fixture = await mkdtemp(join(tmpdir(), 'yify-team-cli-'));
  const input = join(fixture, 'input.json');
  for (const value of [null, false, 0, '']) {
    await writeFile(input, JSON.stringify(value));
    for (const option of ['--assignments', '--report', '--operations']) {
      const result = spawnSync(process.execPath, ['scripts/check-agent-team.mjs', option, input], { cwd: root, encoding: 'utf8' });
      assert.equal(result.status, 1, `${option} must reject ${JSON.stringify(value)}`);
      assert.doesNotMatch(result.stdout, /Agent team policy valid/);
    }
  }
  const assignments = join(fixture, 'assignments.json');
  await writeFile(assignments, JSON.stringify([assignment()]));
  await writeFile(input, 'null');
  const result = spawnSync(process.execPath, ['scripts/check-agent-team.mjs', '--assignments', assignments, '--report', input], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /report must be an object/);
});
