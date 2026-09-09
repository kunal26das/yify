#!/usr/bin/env node
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot, runCommand, uploadEnvironment, uploadSourceMaps, validateSourceMaps} from './sentry-sourcemaps.mjs';

function option(args, name, fallback) {
    let value = fallback;
    for (let index = 0; index < args.length; index += 1) {
        const arg = args[index];
        if (arg.startsWith(`${name}=`)) value = arg.slice(name.length + 1);
        else if (arg === name) {
            value = args[index + 1] && !args[index + 1].startsWith('-') ? args[++index] : fallback;
        }
    }
    return value;
}

export async function runEas(cli, args, {cwd = projectRoot, env = process.env, run = runCommand, upload = uploadSourceMaps} = {}) {
    const mutation = !args.some((arg) => ['--help', '-h', '--dry-run'].includes(arg)) && ['update', 'deploy'].includes(args[0]);
    if (!mutation) return run(process.execPath, [cli, ...args], {cwd, env});

    // Fail before any publish if the private upload credential is missing.
    const uploadEnv = uploadEnvironment(cwd, env);
    const isUpdate = args[0] === 'update';
    const directory = path.resolve(cwd, option(args, isUpdate ? '--input-dir' : '--export-dir', 'dist'));
    if (isUpdate) {
        if (option(args, '--source-maps', 'true') !== 'true') {
            throw new Error('EAS Update requires external source maps for Sentry. Keep --source-maps true.');
        }
        if (args.includes('--skip-bundler')) validateSourceMaps(directory);
    } else {
        // Upload first, then remove maps so hosting never publishes application source maps.
        await upload(directory, {cwd, env: uploadEnv, strip: true, run});
    }

    const code = await run(process.execPath, [cli, ...args], {cwd, env: uploadEnv});
    if (code !== 0 || !isUpdate) return code;
    try {
        await upload(directory, {cwd, env: uploadEnv, run});
    } catch (error) {
        throw new Error(`Expo update was published, but ${error.message} Retry only: node scripts/sentry-sourcemaps.mjs ${JSON.stringify(directory)}`);
    }
    return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [cli, ...args] = process.argv.slice(2);
    try {
        if (!cli) throw new Error('An EAS CLI executable is required. Use scripts/eas.sh.');
        process.exitCode = await runEas(cli, args);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
