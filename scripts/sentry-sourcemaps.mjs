#!/usr/bin/env node
import {spawn} from 'node:child_process';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const require = createRequire(import.meta.url);
export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function uploadEnvironment(cwd = projectRoot, inherited = process.env) {
    const credentialFile = path.join(cwd, '.env.sentry-build-plugin');
    // Match the Sentry uploader's local credential-file precedence without logging credentials.
    const local = fs.existsSync(credentialFile)
        ? require('dotenv').parse(fs.readFileSync(credentialFile, 'utf8'))
        : {};
    const env = {...inherited, ...local};
    if (!env.SENTRY_AUTH_TOKEN?.trim()) {
        throw new Error('SENTRY_AUTH_TOKEN is required before publishing. Set it in the environment or .env.sentry-build-plugin.');
    }
    return {
        ...env,
        SENTRY_ORG: env.SENTRY_ORG || 'kudos-labs',
        SENTRY_PROJECT: env.SENTRY_PROJECT || 'react-native',
        SENTRY_URL: env.SENTRY_URL || 'https://sentry.io/',
    };
}

function sourceMapFiles(directory) {
    return fs.readdirSync(directory, {withFileTypes: true}).flatMap((entry) => {
        const filename = path.join(directory, entry.name);
        if (entry.isDirectory()) return sourceMapFiles(filename);
        return entry.isFile() && entry.name.endsWith('.map') ? [filename] : [];
    });
}

export function validateSourceMaps(directory) {
    const maps = sourceMapFiles(directory);
    const bundleMaps = maps.filter((filename) => /\.(js|hbc)\.map$/.test(filename));
    if (!bundleMaps.length) {
        throw new Error(`No JavaScript source maps found in ${directory}. Export with --source-maps before publishing.`);
    }
    for (const filename of bundleMaps) {
        const map = JSON.parse(fs.readFileSync(filename, 'utf8'));
        if (!fs.existsSync(filename.slice(0, -4)) || !(map.debug_id || map.debugId)) {
            throw new Error(`Source map ${filename} needs its matching bundle and a Sentry Debug ID. Re-export with the Sentry Metro configuration.`);
        }
    }
    return maps;
}

export function runCommand(command, args, {cwd = projectRoot, env = process.env, stderrOnly = false} = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {cwd, env, stdio: ['inherit', stderrOnly ? 2 : 'inherit', 'inherit']});
        let cancelled = false;
        let killTimer;
        const forward = (signal) => {
            cancelled = true;
            child.kill(signal);
            // A child ignoring graceful cancellation must not continue a release indefinitely.
            killTimer ??= setTimeout(() => child.kill('SIGKILL'), 5_000).unref();
        };
        const terminate = () => forward('SIGTERM');
        const interrupt = () => forward('SIGINT');
        process.on('SIGTERM', terminate);
        process.on('SIGINT', interrupt);
        const cleanup = () => {
            process.off('SIGTERM', terminate);
            process.off('SIGINT', interrupt);
            clearTimeout(killTimer);
        };
        child.once('error', (error) => { cleanup(); reject(error); });
        child.once('close', (code) => { cleanup(); resolve(cancelled ? 130 : code ?? 130); });
    });
}

export async function uploadSourceMaps(directory, {cwd = projectRoot, env = process.env, strip = false, run = runCommand} = {}) {
    const uploadEnv = uploadEnvironment(cwd, env);
    const maps = validateSourceMaps(directory);
    const packagePath = require.resolve('@sentry/react-native/package.json');
    const sdk = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
    const uploader = path.resolve(path.dirname(packagePath), sdk.bin['sentry-expo-upload-sourcemaps']);
    // Keep stdout exclusively for EAS --json output, including the uploader's nested CLI output.
    const code = await run(process.execPath, [uploader, directory], {cwd, env: uploadEnv, stderrOnly: true});
    if (code !== 0) throw new Error(`Sentry source-map upload failed (exit ${code}). The export has been kept for retry.`);
    if (strip) {
        for (const filename of maps) fs.unlinkSync(filename);
        console.error(`Uploaded source maps and removed ${maps.length} map files from the public web export.`);
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const [directory, ...flags] = process.argv.slice(2);
    try {
        if (!directory || flags.some((flag) => flag !== '--strip')) {
            throw new Error('Usage: node scripts/sentry-sourcemaps.mjs <export-directory> [--strip]');
        }
        await uploadSourceMaps(path.resolve(directory), {strip: flags.includes('--strip')});
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
