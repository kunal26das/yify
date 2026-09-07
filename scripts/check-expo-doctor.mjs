import {spawnSync} from 'node:child_process';

const KNOWN = [
    'Check Expo config for common issues',
    'Check for app config fields that may not be synced in a non-CNG project',
];

const run = spawnSync('npx', ['expo-doctor@latest'], {
    encoding: 'utf8',
    env: {...process.env, EXPO_DOCTOR_SKIP_DEPENDENCY_VERSION_CHECK: '1'},
});

const output = `${run.stdout ?? ''}${run.stderr ?? ''}`;
process.stdout.write(output);

const failed = [...output.matchAll(/^✖ (.+)$/gm)].map((m) => m[1].trim());
const unexpected = failed.filter((name) => !KNOWN.includes(name));

if (unexpected.length) {
    console.error(`\nexpo-doctor reported ${unexpected.length} unexpected failure(s):`);
    for (const name of unexpected) console.error(`  - ${name}`);
    process.exit(1);
}

if (failed.length) {
    console.log(`\nexpo-doctor: ${failed.length} known structural failure(s) tolerated:`);
    for (const name of failed) console.log(`  - ${name}`);
}
console.log('expo-doctor check passed');
