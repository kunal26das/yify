import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';

const expectedRoles = [
  ['lead', 'Product and Business Lead', 'gpt-6-astra', 'high'],
  ['designer', 'Product Designer — UX, UI and Accessibility', 'gpt-6-astra', 'high'],
  ['app_engineer', 'Android, iOS and Web Engineer', 'gpt-6-sol', 'high'],
  ['backend_engineer', 'Backend and Data Engineer', 'gpt-6-sol', 'high'],
  ['qa', 'Quality and Accessibility Engineer', 'gpt-6-sol', 'medium'],
  ['reliability', 'Reliability and Performance Engineer', 'gpt-6-astra', 'high'],
  ['security_privacy', 'Security and Privacy Engineer', 'gpt-6-astra', 'high'],
  ['reviewer', 'Independent Code and Architecture Reviewer', 'gpt-6-astra', 'high'],
  ['release_engineer', 'Release, CI and Developer Experience Engineer', 'gpt-6-sol', 'high'],
  ['growth', 'Growth and Customer Acquisition Strategist', 'gpt-6-sol', 'high'],
  ['analyst', 'Product and Revenue Analyst', 'gpt-6-sol', 'high'],
  ['monetization', 'Subscriptions, Advertising and Store Operations Specialist', 'gpt-6-sol', 'high'],
];
const prohibitedActions = ['merge', 'publish', 'production_release', 'production_config_change', 'campaign_launch', 'recurring_schedule'];
const assignmentActions = ['read', 'edit', 'test', 'review', 'prepare_release'];
const efforts = ['low', 'medium', 'high', 'xhigh', 'max', 'ultra'];
const hashPattern = /^[a-f0-9]{40}$/;

function fail(message) {
  throw new Error(message);
}

function record(value, label, keys) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) fail(`${label} must be an object`);
  const actual = Object.keys(value);
  const unknown = actual.filter((key) => !keys.includes(key));
  const missing = keys.filter((key) => !actual.includes(key));
  if (unknown.length || missing.length) fail(`${label} fields invalid: unknown [${unknown.join(', ')}], missing [${missing.join(', ')}]`);
}

function nonempty(value, label) {
  if (typeof value !== 'string' || !value.trim()) fail(`${label} must be a nonempty string`);
}

function stringList(value, label, allowEmpty = false) {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) fail(`${label} must be ${allowEmpty ? 'an' : 'a nonempty'} array`);
  value.forEach((item, index) => nonempty(item, `${label}[${index}]`));
  if (new Set(value).size !== value.length) fail(`${label} contains duplicates`);
}

function identical(actual, expected, label) {
  if (!isDeepStrictEqual(actual, expected)) fail(`${label} must be ${JSON.stringify(expected)}`);
}

function commit(value, label) {
  if (typeof value !== 'string' || !hashPattern.test(value)) fail(`${label} must be a full lowercase commit SHA`);
}

function path(value, label) {
  nonempty(value, label);
  const parts = (value.endsWith('/') ? value.slice(0, -1) : value).split('/');
  if (value.startsWith('/') || value.includes('\\') || value.includes('*') || value.includes(':') || parts.some((part) => !part || part === '.' || part === '..')) fail(`${label} must be a clean repo-relative file or directory path`);
}

function overlap(first, second) {
  const normalizedFirst = first.endsWith('/') ? first.slice(0, -1) : first;
  const normalizedSecond = second.endsWith('/') ? second.slice(0, -1) : second;
  return normalizedFirst === normalizedSecond || normalizedFirst.startsWith(`${normalizedSecond}/`) || normalizedSecond.startsWith(`${normalizedFirst}/`);
}

function ownsFile(ownership, file) {
  return ownership.some((owned) => owned.endsWith('/') ? file.startsWith(owned) : file === owned);
}

export function validateManifest(manifest) {
  record(manifest, 'manifest', ['version', 'activation', 'limits', 'authority', 'routineReadOnlyPreference', 'roles']);
  identical(manifest.version, 1, 'manifest.version');
  identical(manifest.activation, 'explicit_native_delegation', 'manifest.activation');
  record(manifest.limits, 'manifest.limits', ['maxConcurrentSpecialists', 'maxConcurrentProductionOperations', 'nestedDelegationByDefault']);
  identical(manifest.limits, { maxConcurrentSpecialists: 3, maxConcurrentProductionOperations: 1, nestedDelegationByDefault: false }, 'manifest.limits');
  record(manifest.authority, 'manifest.authority', ['decisionMaker', 'leadOnlyDecisions', 'specialistProhibitedActions']);
  identical(manifest.authority.decisionMaker, 'lead', 'manifest.authority.decisionMaker');
  identical(manifest.authority.leadOnlyDecisions, ['merge', 'production_release', 'recurring_schedule'], 'manifest.authority.leadOnlyDecisions');
  identical(manifest.authority.specialistProhibitedActions, prohibitedActions, 'manifest.authority.specialistProhibitedActions');
  record(manifest.routineReadOnlyPreference, 'manifest.routineReadOnlyPreference', ['model', 'effort']);
  identical(manifest.routineReadOnlyPreference, { model: 'gpt-6-luna', effort: 'medium' }, 'manifest.routineReadOnlyPreference');
  if (!Array.isArray(manifest.roles) || manifest.roles.length !== expectedRoles.length) fail('manifest.roles must contain exactly twelve roles');
  const seen = new Set();
  for (const [index, role] of manifest.roles.entries()) {
    record(role, `manifest.roles[${index}]`, ['id', 'title', 'preferredModel', 'defaultEffort', 'instructions']);
    if (seen.has(role.id)) fail(`duplicate role: ${role.id}`);
    seen.add(role.id);
    const expected = expectedRoles.find(([id]) => id === role.id);
    if (!expected) fail(`unknown role: ${role.id}`);
    identical(role, { id: expected[0], title: expected[1], preferredModel: expected[2], defaultEffort: expected[3], instructions: `docs/agents/roles/${expected[0]}.md` }, `role ${role.id}`);
  }
  return manifest;
}

export async function validateRepository(root) {
  const manifest = validateManifest(JSON.parse(await readFile(join(root, 'config/agent-team.json'), 'utf8')));
  const filenames = (await readdir(join(root, 'docs/agents/roles'))).sort();
  identical(filenames, expectedRoles.map(([id]) => `${id}.md`).sort(), 'role brief files');
  for (const role of manifest.roles) {
    const text = await readFile(join(root, role.instructions), 'utf8');
    if (!text.startsWith(`# ${role.title}\n`)) fail(`role ${role.id} brief title is missing`);
    if (!text.includes('CLAUDE.md') || !text.includes('docs/agents/team.md')) fail(`role ${role.id} must reference shared guidance`);
  }
  const agents = await readFile(join(root, 'AGENTS.md'), 'utf8');
  for (const target of ['CLAUDE.md', 'docs/agents/team.md', 'config/agent-team.json']) {
    if (!agents.includes(target)) fail(`AGENTS.md must reference ${target}`);
  }
  for (const target of ['CLAUDE.md', 'docs/agents/team.md', 'docs/agents/state.md', 'docs/agents/verification.md']) {
    await readFile(join(root, target), 'utf8');
  }
  return manifest;
}

export function validateAssignments(assignments, manifest) {
  validateManifest(manifest);
  if (!Array.isArray(assignments) || assignments.length > manifest.limits.maxConcurrentSpecialists) fail('assignments exceed the three-specialist limit or are not an array');
  const ids = new Set();
  const owned = [];
  for (const [index, assignment] of assignments.entries()) {
    const label = `assignments[${index}]`;
    record(assignment, label, ['taskId', 'role', 'problem', 'outcome', 'startingCommit', 'context', 'responsibility', 'fileOwnership', 'allowedTools', 'allowedActions', 'prohibitedSideEffects', 'acceptanceCriteria', 'requiredEvidence', 'dependencies', 'scope', 'nextHandoff', 'requestedModel', 'requestedEffort']);
    for (const key of ['taskId', 'problem', 'outcome', 'context', 'responsibility', 'scope', 'nextHandoff', 'requestedModel']) nonempty(assignment[key], `${label}.${key}`);
    if (ids.has(assignment.taskId)) fail(`duplicate task ID: ${assignment.taskId}`);
    ids.add(assignment.taskId);
    if (assignment.role === 'lead' || !manifest.roles.some((role) => role.id === assignment.role)) fail(`${label}.role must be a known specialist`);
    commit(assignment.startingCommit, `${label}.startingCommit`);
    stringList(assignment.fileOwnership, `${label}.fileOwnership`, true);
    stringList(assignment.allowedTools, `${label}.allowedTools`);
    stringList(assignment.allowedActions, `${label}.allowedActions`);
    stringList(assignment.prohibitedSideEffects, `${label}.prohibitedSideEffects`);
    stringList(assignment.acceptanceCriteria, `${label}.acceptanceCriteria`);
    stringList(assignment.requiredEvidence, `${label}.requiredEvidence`);
    stringList(assignment.dependencies, `${label}.dependencies`, true);
    if (assignment.dependencies.includes(assignment.taskId)) fail(`${label} cannot depend on itself`);
    if (!efforts.includes(assignment.requestedEffort)) fail(`${label}.requestedEffort is unsupported`);
    for (const action of assignment.allowedActions) {
      if (!assignmentActions.includes(action)) fail(`${label}.allowedActions contains unsupported or lead-only action: ${action}`);
    }
    for (const action of prohibitedActions) {
      if (!assignment.prohibitedSideEffects.includes(action)) fail(`${label}.prohibitedSideEffects must include ${action}`);
    }
    if (assignment.fileOwnership.length && !assignment.allowedActions.includes('edit')) fail(`${label} needs edit action for file ownership`);
    if (assignment.allowedActions.includes('edit') && !assignment.fileOwnership.length) fail(`${label} needs file ownership for edit action`);
    if (assignment.role === 'reviewer' && (assignment.fileOwnership.length || assignment.allowedActions.includes('edit'))) fail('reviewer must be read-only for the reviewed change');
    for (const file of assignment.fileOwnership) {
      path(file, `${label}.fileOwnership`);
      for (const previous of owned) {
        if (overlap(file, previous.file)) fail(`file ownership conflict: ${file} and ${previous.file}`);
      }
      owned.push({ file, taskId: assignment.taskId });
    }
  }
  return assignments;
}

export function validateReport(report, manifest) {
  validateManifest(manifest);
  record(report, 'report', ['taskId', 'role', 'status', 'findings', 'evidence', 'artifacts', 'changedFiles', 'commit', 'verification', 'remainingRisks', 'nextAction', 'configuration']);
  nonempty(report.taskId, 'report.taskId');
  if (!manifest.roles.some((role) => role.id === report.role && role.id !== 'lead')) fail('report.role must be a known specialist');
  if (!['complete', 'incomplete', 'blocked'].includes(report.status)) fail('report.status is unsupported');
  for (const key of ['findings', 'evidence', 'artifacts', 'changedFiles', 'remainingRisks']) stringList(report[key], `report.${key}`, true);
  report.changedFiles.forEach((file) => {
    path(file, 'report.changedFiles');
    if (file.endsWith('/')) fail('report.changedFiles must contain files, not directories');
  });
  if (report.commit !== null) commit(report.commit, 'report.commit');
  if (!Array.isArray(report.verification) || !report.verification.length) fail('report.verification must be a nonempty array');
  for (const [index, check] of report.verification.entries()) {
    record(check, `report.verification[${index}]`, ['check', 'status', 'evidence']);
    nonempty(check.check, `report.verification[${index}].check`);
    if (!['passed', 'failed', 'not_run'].includes(check.status)) fail(`report.verification[${index}].status is unsupported`);
    nonempty(check.evidence, `report.verification[${index}].evidence`);
  }
  nonempty(report.nextAction, 'report.nextAction');
  if (report.status === 'complete' && (!report.findings.length || !report.evidence.length)) fail('complete report requires findings and evidence');
  record(report.configuration, 'report.configuration', ['requestedModel', 'requestedEffort', 'acceptedModel', 'acceptedEffort', 'effectiveModel', 'effectiveEffort', 'effectiveEvidence']);
  nonempty(report.configuration.requestedModel, 'report.configuration.requestedModel');
  if (!efforts.includes(report.configuration.requestedEffort)) fail('report.configuration.requestedEffort is unsupported');
  for (const key of ['acceptedModel', 'effectiveModel', 'effectiveEvidence']) {
    if (report.configuration[key] !== null) nonempty(report.configuration[key], `report.configuration.${key}`);
  }
  for (const key of ['acceptedEffort', 'effectiveEffort']) {
    if (report.configuration[key] !== null && !efforts.includes(report.configuration[key])) fail(`report.configuration.${key} is unsupported`);
  }
  if ((report.configuration.effectiveModel !== null || report.configuration.effectiveEffort !== null) && report.configuration.effectiveEvidence === null) fail('effective configuration requires independent evidence');
  if (report.configuration.effectiveEvidence !== null && report.configuration.effectiveModel === null && report.configuration.effectiveEffort === null) fail('effective evidence requires an effective setting');
  return report;
}

export function validateHandoff(report, assignments, manifest) {
  validateReport(report, manifest);
  validateAssignments(assignments, manifest);
  const assignment = assignments.find((item) => item.taskId === report.taskId && item.role === report.role);
  if (!assignment) fail('report must match an assignment task ID and role');
  if (assignment.requestedModel !== report.configuration.requestedModel || assignment.requestedEffort !== report.configuration.requestedEffort) fail('report requested configuration must match its assignment');
  for (const file of report.changedFiles) {
    if (!ownsFile(assignment.fileOwnership, file)) fail(`report.changedFiles outside assignment fileOwnership: ${file}`);
  }
  return report;
}

export function validateProductionOperations(operations, manifest) {
  validateManifest(manifest);
  if (!Array.isArray(operations) || operations.length > manifest.limits.maxConcurrentProductionOperations) fail('production operations exceed the one-operation limit or are not an array');
  for (const [index, operation] of operations.entries()) {
    const label = `operations[${index}]`;
    record(operation, label, ['id', 'type', 'decisionMaker', 'target', 'startingCommit', 'authorizationEvidence']);
    nonempty(operation.id, `${label}.id`);
    if (!['release', 'rollback'].includes(operation.type)) fail(`${label}.type is unsupported`);
    if (operation.decisionMaker !== 'lead') fail(`${label} requires lead decision`);
    nonempty(operation.target, `${label}.target`);
    commit(operation.startingCommit, `${label}.startingCommit`);
    nonempty(operation.authorizationEvidence, `${label}.authorizationEvidence`);
  }
  return operations;
}

async function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const manifest = await validateRepository(root);
  const options = {};
  const args = process.argv.slice(2);
  for (let index = 0; index < args.length; index += 2) {
    const option = args[index];
    const value = args[index + 1];
    if (!['--assignments', '--report', '--operations'].includes(option) || !value || value.startsWith('--') || options[option]) fail(`unsupported or incomplete parameter: ${option}`);
    options[option] = value;
  }
  const assignments = options['--assignments'] ? JSON.parse(await readFile(resolve(options['--assignments']), 'utf8')) : null;
  const report = options['--report'] ? JSON.parse(await readFile(resolve(options['--report']), 'utf8')) : null;
  if (options['--assignments'] && options['--report']) validateHandoff(report, assignments, manifest);
  else {
    if (options['--assignments']) validateAssignments(assignments, manifest);
    if (options['--report']) validateReport(report, manifest);
  }
  if (options['--operations']) validateProductionOperations(JSON.parse(await readFile(resolve(options['--operations']), 'utf8')), manifest);
  process.stdout.write('Agent team policy valid\n');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
