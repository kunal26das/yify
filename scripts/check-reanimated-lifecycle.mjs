import { spawnSync } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(repo, 'tests/fixtures/reanimated-lifecycle');
const args = process.argv.slice(2);
if (args.length && (args.length !== 2 || args[0] !== '--output')) {
  throw new Error('Usage: node scripts/check-reanimated-lifecycle.mjs [--output DIRECTORY]');
}
const temporary = args.length === 0;
const output = temporary ? await mkdtemp(path.join(tmpdir(), 'yify-reanimated-')) : path.resolve(args[1]);
await mkdir(output, { recursive: true });
const installed = [
  'active', 'completed', 'paused', 'worklets-only', 'frame-window', 'queue-stopped',
  'event-window', 'query-window', 'direct-window', 'arriving-frame', 'queued-event',
  'pause-resume', 'reentrant', 'active-background', 'lock-order', 'cancel-lock-order',
  'inflight', 'late-schedule', 'duplicate', 'draw-pass',
];
const unsafe = ['frame-window', 'queue-stopped', 'event-window', 'query-window', 'direct-window', 'arriving-frame'];

function run(script, args) {
  const result = spawnSync(process.execPath, [path.join(fixture, script), ...args], {
    cwd: repo,
    stdio: 'inherit',
    timeout: 600000,
  });
  if (result.error || result.status !== 0) {
    throw new Error(`${script} failed: ${result.error?.message ?? result.signal ?? result.status}`);
  }
}

try {
  for (const variant of ['installed', 'baseline']) {
    const sources = path.join(output, variant, 'sources');
    const proof = path.join(output, variant, 'proof');
    run('prepare.mjs', ['--repo', repo, '--output', sources, '--variant', variant]);
    const modes = variant === 'installed' ? installed : ['active', ...unsafe];
    const argumentsList = ['--sources', sources, '--output', proof, ...modes.flatMap(mode => ['--mode', mode])];
    if (variant === 'baseline') argumentsList.push(...unsafe.flatMap(mode => ['--expect-unsafe', mode]));
    run('run.mjs', argumentsList);
    const receipt = JSON.parse(await readFile(path.join(proof, 'toolchain-receipt.json'), 'utf8'));
    if (!receipt.passed || receipt.results.length !== modes.length) {
      throw new Error(`Incomplete ${variant} lifecycle verification`);
    }
  }
  console.log('Reanimated lifecycle: 20 patched cases passed; unmodified source reproduced all 6 native failures.');
  if (temporary) await rm(output, { recursive: true, force: true });
} catch (error) {
  console.error(`${error.message}\nLifecycle evidence retained at ${output}`);
  process.exitCode = 1;
}
