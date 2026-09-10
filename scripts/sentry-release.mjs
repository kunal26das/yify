#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {projectRoot, uploadEnvironment} from './sentry-sourcemaps.mjs';

const repository = 'kunal26das/yify';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(value, name, pattern = /^[^\s\x00-\x1f]{1,200}$/) {
    if (typeof value !== 'string' || !pattern.test(value)) throw new Error(`Invalid deployment ${name}.`);
    return value;
}

function httpsUrl(value) {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
        throw new Error('Deployment URLs must use HTTPS without credentials, query parameters or fragments.');
    }
    return url.href;
}

export function validateReceipt(input) {
    if (input?.status !== 'succeeded') throw new Error('A successful deployment receipt is required.');
    if (!Array.isArray(input.releases) || !input.releases.length || input.releases.length > 3) {
        throw new Error('A receipt must name the exact SDK releases that were deployed.');
    }
    const dateFinished = new Date(input.dateFinished);
    if (!input.dateFinished || !Number.isFinite(dateFinished.valueOf()) || dateFinished.valueOf() > Date.now() + 60_000) {
        throw new Error('A valid past deployment completion time is required.');
    }
    return {
        status: 'succeeded',
        releases: [...new Set(input.releases.map((release) => text(release, 'release')))],
        commit: text(input.commit, 'source commit', /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i),
        environment: text(input.environment, 'environment', /^(production|preview|verification)$/),
        name: text(input.name, 'name', /^[a-zA-Z0-9:._-]{1,200}$/),
        url: httpsUrl(input.url),
        dateFinished: dateFinished.toISOString(),
    };
}

export function validatePlan(input) {
    if (!['ota', 'hosting'].includes(input?.kind)) throw new Error('Deployment plan kind must be ota or hosting.');
    const platforms = input.kind === 'hosting' ? ['web'] : ['android', 'ios'];
    if (!input.releases || !Object.keys(input.releases).length || Object.keys(input.releases).some((key) => !platforms.includes(key))) {
        throw new Error('The deployment plan must map published platforms to exact SDK release names.');
    }
    for (const release of Object.values(input.releases)) text(release, 'release');
    text(input.commit, 'source commit', /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i);
    text(input.environment, 'environment', /^(production|preview|verification)$/);
    if (input.kind === 'ota') text(input.runtimeVersion, 'runtime version');
    return input;
}

export function verifyPlannedSource(plan, cwd = projectRoot) {
    let head;
    let changes;
    try {
        const options = {cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']};
        head = execFileSync('git', ['rev-parse', 'HEAD'], options).trim();
        changes = execFileSync('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim();
    } catch {
        throw new Error('Cannot verify the Sentry deployment plan source checkout.');
    }
    if (head !== plan.commit || changes) {
        throw new Error('The Sentry deployment plan requires a clean checkout at its exact source commit.');
    }
}

export function verifyWebExportRelease(directory, expected) {
    const clientDirectory = fs.existsSync(path.join(directory, 'client')) ? path.join(directory, 'client') : directory;
    const webDirectory = path.join(clientDirectory, '_expo', 'static', 'js', 'web');
    let prelude;
    try {
        const entries = fs.readdirSync(webDirectory, {withFileTypes: true})
            .filter((entry) => entry.isFile() && /^entry(?:-[\w.-]+)?\.js$/.test(entry.name));
        if (entries.length !== 1) throw new Error('Ambiguous web entry bundle.');
        const descriptor = fs.openSync(path.join(webDirectory, entries[0].name), 'r');
        try {
            const buffer = Buffer.alloc(16_384);
            prelude = buffer.subarray(0, fs.readSync(descriptor, buffer, 0, buffer.length, 0)).toString('utf8');
        } finally {
            fs.closeSync(descriptor);
        }
    } catch {
        throw new Error('Cannot verify the exported Sentry web release. Re-export the web application before publishing.');
    }
    const matches = [...prelude.matchAll(/var SENTRY_RELEASE;SENTRY_RELEASE=\{name:\s*("(?:[^"\\]|\\.)*"),\s*version:\s*("(?:[^"\\]|\\.)*")\};/g)];
    if (matches.length !== 1) {
        throw new Error('The web export has no unambiguous Sentry release prelude. Re-export before publishing.');
    }
    const actual = `${JSON.parse(matches[0][1])}@${JSON.parse(matches[0][2])}`;
    if (actual !== expected) {
        throw new Error(`The web export Sentry release is ${actual}, but the deployment plan expects ${expected}. Re-export before publishing.`);
    }
}

export function completePlan(input, publication, finishedAt = new Date().toISOString()) {
    const plan = validatePlan(input);
    if (plan.kind === 'hosting') {
        text(publication?.identifier, 'hosting identifier', /^[a-zA-Z0-9_-]{1,128}$/);
        if (plan.environment === 'production' && !publication.production?.url) {
            throw new Error('The hosting receipt does not confirm production promotion.');
        }
        if (plan.environment !== 'production' && publication.production?.url) {
            throw new Error('The hosting receipt confirms production promotion but its plan is not production.');
        }
        return validateReceipt({status: 'succeeded', releases: [plan.releases.web], commit: plan.commit,
            environment: plan.environment, name: `expo-hosting:${publication.identifier}`,
            url: publication.url, dateFinished: finishedAt});
    }
    if (!Array.isArray(publication) || !publication.length) throw new Error('EAS did not return an update receipt.');
    const groups = new Set(publication.map((update) => update.group));
    if (groups.size !== 1 || !uuid.test(publication[0].group)) throw new Error('Expected one verified Expo update group.');
    for (const update of publication) {
        if (!uuid.test(update.id) || update.isRollBackToEmbedded || update.gitCommitHash !== plan.commit ||
            update.runtimeVersion !== plan.runtimeVersion || !plan.releases[update.platform]) {
            throw new Error('The published update does not match the planned source commit, runtime and platforms.');
        }
    }
    if (Object.keys(plan.releases).some((platform) => !publication.some((update) => update.platform === platform))) {
        throw new Error('The published update is missing a planned platform.');
    }
    return validateReceipt({status: 'succeeded', releases: publication.map((update) => plan.releases[update.platform]),
        commit: plan.commit, environment: plan.environment, name: `expo-update:${publication[0].group}`,
        url: `https://expo.dev/accounts/kunal26das/projects/yify/updates/${publication[0].group}`,
        dateFinished: publication.reduce((latest, update) => update.createdAt > latest ? update.createdAt : latest, '')});
}

export function saveReceipt(filename, receipt) {
    const validated = validateReceipt(receipt);
    fs.mkdirSync(path.dirname(filename), {recursive: true});
    try {
        fs.writeFileSync(filename, `${JSON.stringify(validated, null, 2)}\n`, {mode: 0o600, flag: 'wx'});
    } catch (error) {
        if (error.code === 'EEXIST') {
            throw new Error(`A publication receipt already exists at ${filename}. Preserve it and retry metadata only: node scripts/sentry-release.mjs ${JSON.stringify(filename)}`);
        }
        throw error;
    }
    return validated;
}

export async function recordDeployment(input, {cwd = projectRoot, env = process.env, fetch: request = globalThis.fetch, receiptPath} = {}) {
    const receipt = validateReceipt(input);
    const uploadEnv = uploadEnvironment(cwd, env);
    const base = new URL(`/api/0/organizations/${encodeURIComponent(uploadEnv.SENTRY_ORG)}/releases/`, uploadEnv.SENTRY_URL);
    if (base.protocol !== 'https:' || base.username || base.password) throw new Error('Sentry API must use HTTPS without URL credentials.');
    const target = {url: base.origin, organization: uploadEnv.SENTRY_ORG, project: uploadEnv.SENTRY_PROJECT};
    const identity = createHash('sha256').update(JSON.stringify({receipt, target})).digest('hex');
    const savedReceipt = receiptPath && fs.existsSync(receiptPath)
        ? JSON.parse(fs.readFileSync(receiptPath, 'utf8')) : input;
    if (JSON.stringify(validateReceipt(savedReceipt)) !== JSON.stringify(receipt)) {
        throw new Error('The saved Sentry receipt belongs to another publication. Use a unique receipt file for each publication.');
    }
    const recorded = new Map();
    const attempted = new Set();
    if (savedReceipt.sentry) {
        const checkpoint = savedReceipt.sentry;
        if (JSON.stringify(checkpoint.target) !== JSON.stringify(target)) {
            throw new Error('The saved Sentry checkpoint targets a different URL, organization or project.');
        }
        if (checkpoint.identity !== identity || !Array.isArray(checkpoint.deployments)) {
            throw new Error('The saved Sentry checkpoint does not match this receipt.');
        }
        if (checkpoint.attemptedReleases !== undefined && !Array.isArray(checkpoint.attemptedReleases)) {
            throw new Error('The saved Sentry attempted-deployment checkpoint is invalid.');
        }
        for (const version of checkpoint.attemptedReleases || []) {
            if (!receipt.releases.includes(version) || attempted.has(version)) throw new Error('The saved Sentry attempted-deployment checkpoint is invalid.');
            attempted.add(version);
        }
        for (const entry of checkpoint.deployments) {
            if (!receipt.releases.includes(entry.release) || !/^\d+$/.test(entry.deploymentId) || recorded.has(entry.release)) {
                throw new Error('The saved Sentry deployment checkpoint is invalid.');
            }
            recorded.set(entry.release, entry.deploymentId);
        }
    }
    const persistCheckpoint = () => {
        if (receiptPath) {
            const temporary = `${receiptPath}.tmp`;
            const sentry = {identity, target,
                status: recorded.size === receipt.releases.length ? 'recorded' : recorded.size ? 'partial' : 'pending',
                deployments: [...recorded].map(([release, id]) => ({release, deploymentId: id})),
                attemptedReleases: [...attempted]};
            fs.writeFileSync(temporary, `${JSON.stringify({...receipt, sentry}, null, 2)}\n`, {mode: 0o600});
            fs.renameSync(temporary, receiptPath);
        }
    };
    const remember = (version, deploymentId) => {
        if (!/^\d+$/.test(String(deploymentId))) throw new Error('Sentry did not return a valid deployment ID. Inspect the saved receipt before retrying.');
        recorded.set(version, String(deploymentId));
        attempted.delete(version);
        persistCheckpoint();
    };
    const headers = {Authorization: `Bearer ${uploadEnv.SENTRY_AUTH_TOKEN}`, 'Content-Type': 'application/json'};
    const call = async (url, method = 'GET', body) => {
        const target = new URL(url, base);
        if (target.origin !== base.origin || !target.pathname.startsWith(base.pathname)) {
            throw new Error('Refusing a Sentry pagination URL outside the release API.');
        }
        let response;
        try {
            response = await request(target, {method, headers, redirect: 'error', signal: AbortSignal.timeout(20_000),
                ...(body ? {body: JSON.stringify(body)} : {})});
        } catch {
            throw new Error('Sentry release metadata request did not complete. Retry the saved receipt only.');
        }
        if (response.status === 404 && method === 'GET') return {missing: true};
        if (!response.ok) throw new Error(`Sentry release metadata request failed (HTTP ${response.status}). Retry the saved receipt only.`);
        return {data: await response.json(), link: response.headers.get('link')};
    };
    const list = async (url) => {
        const values = [];
        for (let page = 0; url && page < 100; page += 1) {
            const result = await call(url);
            if (result.missing || !Array.isArray(result.data)) throw new Error('Could not inspect existing Sentry release metadata.');
            values.push(...result.data);
            const next = result.link?.split(',').find((entry) => /rel="next"/.test(entry) && /results="true"/.test(entry));
            url = next?.match(/<([^>]+)>/)?.[1];
        }
        if (url) throw new Error('Sentry release pagination exceeded its safety limit.');
        return values;
    };
    const result = [];
    for (const version of receipt.releases) {
        if (recorded.has(version)) {
            result.push({release: version, deploymentId: recorded.get(version), alreadyRecorded: true});
            continue;
        }
        const releaseUrl = new URL(`${encodeURIComponent(version)}/`, base);
        const existing = await call(releaseUrl);
        const deployUrl = new URL('deploys/', releaseUrl);
        const deploys = existing.missing ? [] : await list(deployUrl);
        const already = deploys.find((deploy) => deploy.name === receipt.name && deploy.environment === receipt.environment);
        if (already) {
            if (already.url !== receipt.url) throw new Error('An existing Sentry deployment has the same identity but a different URL.');
            remember(version, already.id);
            result.push({release: version, deploymentId: String(already.id), alreadyRecorded: true});
            continue;
        }
        if (attempted.has(version)) {
            throw new Error('A previous Sentry deployment POST has no confirmed response, and the visible deployment does not match this receipt. Refusing an automatic retry that could create a duplicate; inspect the original workflow receipt and logs.');
        }
        const later = deploys.find((deploy) => deploy.environment === receipt.environment &&
            (!Number.isFinite(Date.parse(deploy.dateFinished)) || Date.parse(deploy.dateFinished) >= Date.parse(receipt.dateFinished)));
        if (later) {
            throw new Error('Sentry only lists the latest deployment per environment. This older receipt has no saved Sentry checkpoint, so its prior recording cannot be verified. Refusing to create a possible duplicate; inspect the original workflow receipt and logs.');
        }
        const commits = existing.missing ? [] : await list(new URL('commits/', releaseUrl));
        const knownCommits = commits.map((commit) => ({id: commit.id, repository: commit.repository?.name || repository}));
        if (!knownCommits.some((commit) => commit.id === receipt.commit && commit.repository === repository)) {
            knownCommits.push({id: receipt.commit, repository});
        }
        const metadata = {ref: receipt.commit, url: `https://github.com/${repository}/commit/${receipt.commit}`,
            dateReleased: existing.data?.dateReleased || receipt.dateFinished, commits: knownCommits};
        if (existing.missing) await call(base, 'POST', {version, projects: [uploadEnv.SENTRY_PROJECT], ...metadata});
        else await call(releaseUrl, 'PUT', metadata);
        attempted.add(version);
        persistCheckpoint();
        const deployed = await call(deployUrl, 'POST', {environment: receipt.environment, name: receipt.name,
            url: receipt.url, dateFinished: receipt.dateFinished, projects: [uploadEnv.SENTRY_PROJECT]});
        remember(version, deployed.data.id);
        result.push({release: version, deploymentId: String(deployed.data.id), alreadyRecorded: false});
    }
    return result;
}

export function githubPagesReceipt(env, url, finishedAt = new Date().toISOString()) {
    if (env.GITHUB_REPOSITORY !== repository) throw new Error('Unexpected GitHub deployment repository.');
    text(env.GITHUB_RUN_ID, 'GitHub run ID', /^\d+$/);
    text(env.GITHUB_RUN_ATTEMPT, 'GitHub run attempt', /^\d+$/);
    return validateReceipt({status: 'succeeded', releases: [env.SENTRY_RELEASE], commit: env.GITHUB_SHA,
        environment: 'production', name: `github-pages:${env.GITHUB_RUN_ID}:${env.GITHUB_RUN_ATTEMPT}`,
        url, dateFinished: finishedAt});
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try {
        const [filename, ...args] = process.argv.slice(2);
        let receipt;
        let receiptPath;
        if (filename === '--github-pages' && args.length === 2) {
            receiptPath = path.resolve(args[1]);
            receipt = saveReceipt(receiptPath, githubPagesReceipt(process.env, args[0]));
        } else if (filename && args.length === 0) {
            receiptPath = path.resolve(filename);
            receipt = JSON.parse(fs.readFileSync(receiptPath, 'utf8'));
        } else {
            throw new Error('Usage: node scripts/sentry-release.mjs <successful-deployment-receipt.json>');
        }
        const result = await recordDeployment(receipt, {receiptPath});
        console.error(`Sentry release metadata recorded: ${result.map((entry) => entry.release).join(', ')}.`);
    } catch (error) {
        console.error(error.message);
        process.exitCode = 1;
    }
}
