import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {dirname, join, resolve, relative} from 'node:path';

const directory = dirname(fileURLToPath(import.meta.url));
const root = resolve(directory, '../..');
const output = resolve(process.argv[2] ?? '');
if (!process.argv[2] || !relative(root, output).startsWith('..')) throw new Error('Provide an evidence directory outside the checkout');
mkdirSync(output, {recursive: true});
const groups = JSON.parse(readFileSync(join(directory, 'mock-journeys.json'), 'utf8'));
const source = spawnSync('git', ['rev-parse', 'HEAD'], {cwd: root, encoding: 'utf8'});
if (source.status !== 0) throw new Error('Cannot resolve source commit');
const result = {schemaVersion: 1, sourceSha: source.stdout.trim(), kind: 'mocked-native-and-network-boundaries',
    integrationCoverage: false, deviceCoverage: false, groups: []};
for (const [name, files] of Object.entries(groups)) {
    const run = spawnSync(process.execPath, ['--require', join(directory, 'deny-network.cjs'), '--test', ...files],
        {cwd: root, encoding: 'utf8', timeout: 300000, maxBuffer: 16 * 1024 * 1024});
    writeFileSync(join(output, `${name}.log`), `${run.stdout ?? ''}${run.stderr ?? ''}${run.error ? `\n${run.error.message}\n` : ''}`);
    result.groups.push({name, files, status: run.status === 0 ? 'pass' : 'fail', exitCode: run.status});
    console.log(`${name}: ${run.status === 0 ? 'PASS' : 'FAIL'} (mocked boundaries; no device or live services)`);
}
writeFileSync(join(output, 'mock-journeys.json'), JSON.stringify(result, null, 2) + '\n');
if (result.groups.some(group => group.status !== 'pass')) process.exitCode = 1;
