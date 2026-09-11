#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot, runCommand, uploadEnvironment, uploadSourceMaps, validateSourceMaps} from './sentry-sourcemaps.mjs';
import {completePlan, recordDeployment, saveReceipt, validatePlan, verifyPlannedSource, verifyWebExportRelease} from './sentry-release.mjs';
import {checkLivePrivacy, requiresLivePrivacyCheck} from './check-live-privacy.mjs';

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

export async function runEas(cli, args, {cwd = projectRoot, env = process.env, run = runCommand, upload = uploadSourceMaps, record = recordDeployment, verifySource = verifyPlannedSource, verifyPrivacy = checkLivePrivacy} = {}) {
    if (requiresLivePrivacyCheck(args, cwd)) await verifyPrivacy({cwd});
    const mutation = !args.some((arg) => ['--help', '-h', '--dry-run'].includes(arg)) && ['update', 'deploy'].includes(args[0]);
    if (!mutation) return run(process.execPath, [cli, ...args], {cwd, env});

    // Fail before any publish if the private upload credential is missing.
    const uploadEnv = uploadEnvironment(cwd, env);
    const isUpdate = args[0] === 'update';
    const planPath = uploadEnv.SENTRY_DEPLOYMENT_PLAN && path.resolve(cwd, uploadEnv.SENTRY_DEPLOYMENT_PLAN);
    const plan = planPath && validatePlan(JSON.parse(fs.readFileSync(planPath, 'utf8')));
    const receiptPath = planPath && `${planPath}.published.json`;
    if (planPath && (fs.existsSync(receiptPath) || fs.existsSync(`${planPath}.eas.json`))) {
        throw new Error('This Sentry plan already has a publication receipt. Inspect and retry its saved metadata only; use a new plan file for a new publication.');
    }
    if (plan && (plan.kind !== (isUpdate ? 'ota' : 'hosting') || !args.includes('--json'))) {
        throw new Error('A Sentry deployment plan must match the EAS operation and requires --json.');
    }
    const exportedEnvironment = uploadEnv.EXPO_PUBLIC_SENTRY_ENVIRONMENT;
    if (plan?.kind === 'hosting' && exportedEnvironment && exportedEnvironment !== plan.environment) {
        throw new Error('The Sentry hosting plan environment does not match EXPO_PUBLIC_SENTRY_ENVIRONMENT.');
    }
    const promotesHosting = args.some((arg) => ['--prod', '--production', '--prod=true', '--production=true'].includes(arg));
    if (plan?.kind === 'hosting' && promotesHosting && plan.environment !== 'production') {
        throw new Error('A Sentry preview hosting plan cannot promote a production deployment.');
    }
    const channel = option(args, '--channel');
    if (plan?.kind === 'ota') {
        if (!['Production', 'Staging'].includes(channel)) {
            throw new Error('A Sentry update plan requires an explicit Production or Staging Expo channel.');
        }
        if (plan.environment !== (channel === 'Production' ? 'production' : 'preview')) {
            throw new Error('The Sentry update plan environment does not match the Expo channel.');
        }
        if (uploadEnv.EXPO_UPDATE_CHANNEL && uploadEnv.EXPO_UPDATE_CHANNEL !== channel) {
            throw new Error('The Sentry update plan channel does not match EXPO_UPDATE_CHANNEL.');
        }
    }
    if (plan) verifySource(plan, cwd);
    let stdout = '';
    const directory = path.resolve(cwd, option(args, isUpdate ? '--input-dir' : '--export-dir', 'dist'));
    if (isUpdate) {
        if (option(args, '--source-maps', 'true') !== 'true') {
            throw new Error('EAS Update requires external source maps for Sentry. Keep --source-maps true.');
        }
        if (args.includes('--skip-bundler')) validateSourceMaps(directory);
    } else {
        if (plan) verifyWebExportRelease(directory, plan.releases.web);
        // Upload first, then remove maps so hosting never publishes application source maps.
        await upload(directory, {cwd, env: uploadEnv, strip: true, run});
    }

    const code = await run(process.execPath, [cli, ...args], {cwd, env: uploadEnv,
        ...(plan ? {onStdout: (chunk) => { stdout += chunk; }} : {})});
    if (code !== 0) return code;
    let receipt;
    let receiptError;
    if (plan) {
        try {
            fs.writeFileSync(`${planPath}.eas.json`, stdout, {mode: 0o600, flag: 'wx'});
            receipt = saveReceipt(receiptPath, completePlan(plan, JSON.parse(stdout)));
        } catch (error) {
            receiptError = new Error(`Expo publication succeeded, but its Sentry deployment receipt could not be verified: ${error.message} Inspect ${planPath}.eas.json; do not republish.`);
        }
    }
    if (isUpdate) {
        try {
            await upload(directory, {cwd, env: uploadEnv, run});
        } catch (error) {
            throw new Error(`Expo update was published, but ${error.message} Retry only: node scripts/sentry-sourcemaps.mjs ${JSON.stringify(directory)}${receipt ? ` then node scripts/sentry-release.mjs ${JSON.stringify(receiptPath)}` : ''}${receiptError ? ` ${receiptError.message}` : ''}`);
        }
    }
    if (receiptError) throw receiptError;
    if (receipt) {
        try {
            await record(receipt, {cwd, env: uploadEnv, receiptPath});
        } catch (error) {
            throw new Error(`Expo publication succeeded, but ${error.message} Retry only: node scripts/sentry-release.mjs ${JSON.stringify(receiptPath)}`);
        }
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
