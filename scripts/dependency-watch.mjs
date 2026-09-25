import {appendFile, mkdir, readFile, rename, writeFile} from 'node:fs/promises';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

export const REPOSITORY = 'kunal26das/yify';
export const MARKER = '<!-- yify-dependency-watch:v1 -->';
export const TITLE = 'Dependency pins needing review';
const VERIFIER = 'dependabot/fetch-metadata';
const MANIFESTS = ['package.json', 'crashreporting/package.json', 'tooling/package.json', 'release/package.json'];
const SHA = /^[a-f0-9]{40}$/;
const NAME = /^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/;
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);

export function semver(value) {
    if (typeof value !== 'string') return null;
    const match = VERSION.exec(value);
    if (!match || match[4]?.split('.').some(part => /^\d+$/.test(part) && part.length > 1 && part[0] === '0')) return null;
    return {numbers: match.slice(1, 4).map(BigInt), prerelease: match[4]?.split('.') ?? []};
}

export function compareVersions(a, b) {
    const left = semver(a), right = semver(b);
    assert(left && right, 'Invalid semantic version.');
    for (let i = 0; i < 3; i++) {
        if (left.numbers[i] !== right.numbers[i]) return left.numbers[i] < right.numbers[i] ? -1 : 1;
    }
    if (!left.prerelease.length || !right.prerelease.length) {
        return left.prerelease.length === right.prerelease.length ? 0 : left.prerelease.length ? -1 : 1;
    }
    for (let i = 0; i < Math.max(left.prerelease.length, right.prerelease.length); i++) {
        const x = left.prerelease[i], y = right.prerelease[i];
        if (x === y) continue;
        if (x === undefined || y === undefined) return x === undefined ? -1 : 1;
        const nx = /^\d+$/.test(x), ny = /^\d+$/.test(y);
        if (nx && ny) return BigInt(x) < BigInt(y) ? -1 : 1;
        if (nx !== ny) return nx ? -1 : 1;
        return x < y ? -1 : 1;
    }
    return 0;
}

export function resolutionPackage(selector) {
    assert(typeof selector === 'string' && selector.length <= 240 && /^[a-z0-9@*._/-]+$/.test(selector), 'Unsupported resolution selector.');
    const parts = selector.split('/');
    assert(parts.every(Boolean), 'Unsupported resolution selector.');
    const name = parts.at(-2)?.startsWith('@') ? parts.slice(-2).join('/') : parts.at(-1);
    assert(NAME.test(name), 'Resolution selector must end in a literal npm package name.');
    return name;
}

export function resolutionPins(manifests) {
    const pins = [];
    for (const [file, pkg] of Object.entries(manifests)) {
        assert(MANIFESTS.includes(file) && object(pkg), 'Invalid manifest.');
        assert(pkg.resolutions === undefined || object(pkg.resolutions), 'Invalid resolutions object.');
        for (const [selector, current] of Object.entries(pkg.resolutions ?? {})) {
            const name = resolutionPackage(selector);
            assert(semver(current), 'Resolution pins must use exact semantic versions.');
            pins.push({kind: 'npm', file, selector, name, current});
        }
    }
    assert(pins.length <= 100, 'Resolution coverage exceeds the supported size.');
    return pins.sort((a, b) => `${a.file}/${a.selector}`.localeCompare(`${b.file}/${b.selector}`));
}

export function aliasPins(manifests) {
    const pins = [];
    for (const [file, pkg] of Object.entries(manifests)) {
        assert(MANIFESTS.includes(file) && object(pkg), 'Invalid manifest.');
        for (const section of ['dependencies', 'devDependencies', 'optionalDependencies']) {
            assert(pkg[section] === undefined || object(pkg[section]), 'Invalid dependency object.');
            for (const [alias, requirement] of Object.entries(pkg[section] ?? {})) {
                if (typeof requirement !== 'string' || !requirement.startsWith('npm:')) continue;
                assert(alias.length <= 240 && alias.match(NAME)?.[0] === alias, 'Invalid npm alias name.');
                const separator = requirement.lastIndexOf('@');
                const name = requirement.slice(4, separator), current = requirement.slice(separator + 1);
                assert(separator > 4 && name.length <= 240 && name.match(NAME)?.[0] === name && semver(current),
                    'npm aliases must name a package and an exact semantic version.');
                pins.push({kind: 'npm', file, selector: `${section}.${alias}`, alias, name, current});
            }
        }
    }
    assert(pins.length <= 100, 'Alias coverage exceeds the supported size.');
    return pins.sort((a, b) => `${a.file}/${a.selector}`.localeCompare(`${b.file}/${b.selector}`));
}

function scalar(value) {
    const match = value.trim().match(/^(?:"([^"\\]*)"|'([^']*)'|([^\s#"']+))(?:\s+#.*)?$/);
    assert(match, 'Verifier checkout must use literal YAML values.');
    return match[1] ?? match[2] ?? match[3];
}

export function verifierPin(workflow) {
    assert(typeof workflow === 'string' && workflow.length < 256000, 'Invalid CI workflow.');
    const lines = workflow.split(/\r?\n/);
    const pins = [];
    for (let i = 0; i < lines.length; i++) {
        const repository = lines[i].match(/^( +)repository:\s*(.*)$/);
        if (!repository || scalar(repository[2]) !== VERIFIER) continue;
        const indent = repository[1].length;
        let start = i, end = i + 1;
        while (start > 0 && (!lines[start - 1].trim() || lines[start - 1].search(/\S/) >= indent)) start--;
        while (end < lines.length && (!lines[end].trim() || lines[end].search(/\S/) >= indent)) end++;
        assert(start > 0 && lines[start - 1].trim() === 'with:' && lines[start - 1].search(/\S/) === indent - 2,
            'Verifier checkout must use a literal with block.');
        let step = start - 2;
        while (step >= 0 && !lines[step].match(/^\s*-\s+(?:name|uses):/)) step--;
        const header = lines.slice(step, start - 1).join('\n');
        assert(step >= 0 && /(?:^|\n)\s*(?:-\s+)?uses:\s*actions\/checkout@[a-f0-9]{40}(?:\s|$)/.test(header),
            'Verifier must be checked out by a SHA-pinned checkout action.');
        const refs = lines.slice(start, end).map(line => line.match(new RegExp(`^ {${indent}}ref:\\s*(.*)$`))).filter(Boolean);
        assert(refs.length === 1 && SHA.test(scalar(refs[0][1])), 'Verifier checkout must contain one full commit SHA.');
        pins.push({kind: 'github', file: '.github/workflows/dependabot-maintenance.yml', name: VERIFIER, current: scalar(refs[0][1])});
    }
    assert(pins.length === 1, 'Expected exactly one pinned Dependabot metadata checkout.');
    return pins[0];
}

export function npmVersions(name, document, current) {
    assert(object(document) && document.name === name && object(document.versions), 'Invalid npm package metadata.');
    const latest = document['dist-tags']?.latest;
    assert(semver(latest) && document.versions[latest]?.version === latest, 'Invalid npm latest tag.');
    const stable = Object.keys(document.versions).filter(version => semver(version)?.prerelease.length === 0);
    assert(stable.length > 0, 'No stable npm release found.');
    stable.sort(compareVersions);
    const newestStable = stable.at(-1);
    assert(document.versions[newestStable]?.version === newestStable, 'Invalid npm stable release metadata.');
    const sameMajor = stable.filter(version => semver(version).numbers[0] === semver(current).numbers[0]).at(-1) ?? null;
    return {latest, newestStable, sameMajor, status: compareVersions(current, newestStable) < 0 ? 'review' : 'current'};
}

export function jsonClient({fetchImpl = fetch, token} = {}) {
    return async (url, {method = 'GET', body} = {}) => {
        const parsed = new URL(url);
        assert(['https://registry.npmjs.org', 'https://api.github.com'].includes(parsed.origin) && !parsed.username && !parsed.password,
            'Unsupported metadata host.');
        assert(method === 'GET' || (parsed.origin === 'https://api.github.com' &&
            new RegExp(`^/repos/${REPOSITORY}/issues(?:/[1-9][0-9]*)?$`).test(parsed.pathname) && ['POST', 'PATCH'].includes(method)),
            'Unsupported metadata operation.');
        const registry = parsed.origin === 'https://registry.npmjs.org';
        const byteLimit = (registry ? 16 : 8) * 1024 * 1024;
        let response;
        try {
            response = await fetchImpl(url, {method, redirect: 'error', signal: AbortSignal.timeout(20000),
                headers: {Accept: registry ? 'application/vnd.npm.install-v1+json' : 'application/json', ...(parsed.origin === 'https://api.github.com' ? {
                    'X-GitHub-Api-Version': '2022-11-28', ...(token ? {Authorization: `Bearer ${token}`} : {}),
                } : {}), ...(body ? {'Content-Type': 'application/json'} : {})},
                ...(body ? {body: JSON.stringify(body)} : {})});
        } catch {
            throw new Error('Metadata request failed or timed out.');
        }
        assert(response.ok, `Metadata request failed (HTTP ${response.status}).`);
        const chunks = []; let bytes = 0;
        for await (const chunk of response.body) {
            bytes += chunk.length;
            assert(bytes <= byteLimit, 'Metadata response exceeds the size limit.');
            chunks.push(chunk);
        }
        try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
        catch { throw new Error('Metadata response is not valid JSON.'); }
    };
}

export async function latestVerifier(request) {
    const tags = [];
    for (let page = 1; page <= 10; page++) {
        const result = await request(`https://api.github.com/repos/${VERIFIER}/tags?per_page=100&page=${page}`);
        assert(Array.isArray(result) && result.length <= 100, 'Invalid verifier tag response.');
        for (const tag of result) {
            assert(typeof tag?.name === 'string' && SHA.test(tag.commit?.sha ?? ''), 'Invalid verifier tag identity.');
            const version = tag.name.replace(/^v/, '');
            if (semver(version)?.prerelease.length === 0) tags.push({tag: tag.name, version, sha: tag.commit.sha});
        }
        if (result.length < 100) {
            assert(tags.length > 0, 'No stable verifier tag found.');
            tags.sort((a, b) => compareVersions(a.version, b.version));
            return tags.at(-1);
        }
    }
    throw new Error('Verifier tags exceed the supported page limit.');
}

export async function scan({manifests, workflow, request}) {
    const rows = [], errors = [];
    let pins = [];
    try { pins = resolutionPins(manifests); }
    catch { errors.push('Cannot inspect exact workspace/release resolution pins.'); }
    try { pins.push(...aliasPins(manifests)); }
    catch { errors.push('Cannot inspect exact workspace/release npm alias pins.'); }
    const cache = new Map();
    for (const pin of pins) {
        try {
            if (!cache.has(pin.name)) cache.set(pin.name, await request(`https://registry.npmjs.org/${encodeURIComponent(pin.name)}`));
            rows.push({...pin, ...npmVersions(pin.name, cache.get(pin.name), pin.current)});
        } catch { errors.push(`Cannot verify ${pin.file}: ${pin.selector}.`); }
    }
    try {
        const pin = verifierPin(workflow), latest = await latestVerifier(request);
        rows.push({...pin, latest: latest.tag, latestSha: latest.sha, status: pin.current === latest.sha ? 'current' : 'review'});
    } catch { errors.push('Cannot verify the Dependabot metadata checkout pin.'); }
    return {version: 1, rows, errors};
}

export function markdown(report) {
    assert(report?.version === 1 && Array.isArray(report.rows) && Array.isArray(report.errors), 'Invalid dependency report.');
    const findings = report.rows.filter(row => row.status === 'review');
    const lines = [MARKER, '# Dependency pin coverage', '', `${findings.length} pins need review. ${report.errors.length} checks could not complete.`, '',
        'This report covers exact Yarn resolution overrides, npm aliases and the separately checked-out Dependabot verifier. Newer versions require compatibility review; no dependencies are changed automatically.', '',
        '| Location / package | Pinned | npm latest / latest GitHub tag | Newest stable | Latest in pinned major | Result |',
        '| --- | --- | --- | --- | --- | --- |'];
    for (const row of report.rows) {
        if (row.kind === 'npm') lines.push(`| ${row.file}: [${row.selector}${row.alias ? ` → ${row.name}` : ''}](https://www.npmjs.com/package/${row.name}) | ${row.current} | ${row.latest} | ${row.newestStable} | ${row.sameMajor ?? 'None'} | ${row.status} |`);
        else lines.push(`| ${row.file}: [${row.name}](https://github.com/${VERIFIER}/tags) | ${row.current} | [${row.latest}](https://github.com/${VERIFIER}/releases/tag/${row.latest}) | ${row.latestSha} | — | ${row.status} |`);
    }
    if (report.errors.length) lines.push('', '## Incomplete checks', '', ...report.errors.map(error => `- ${error}`), '', 'A failed lookup is not evidence that a pin is current. Existing tracking remains open.');
    lines.push('', 'Review changelogs and compatibility before updating a pin, commit regenerated lockfiles, and run the affected build checks. A different verifier SHA needs review before replacement.', '',
        'Sources: [Yarn resolution selectors](https://classic.yarnpkg.com/lang/en/docs/selective-version-resolutions/), [npm distribution tags](https://docs.npmjs.com/cli/v11/commands/npm-dist-tag/), [GitHub repository tags](https://docs.github.com/en/rest/repos/repos#list-repository-tags).', '');
    return lines.join('\n');
}

export async function persistReport(directory, report, {write = writeFile, move = rename} = {}) {
    await mkdir(directory, {recursive: true});
    for (const [name, content] of [['report.json', `${JSON.stringify(report, null, 2)}\n`], ['report.md', markdown(report)]]) {
        await write(join(directory, `${name}.tmp`), content);
        await move(join(directory, `${name}.tmp`), join(directory, name));
    }
}

export function publicationAllowed(env, event) {
    return env.GITHUB_REPOSITORY === REPOSITORY && event?.repository?.full_name === REPOSITORY &&
        ['schedule', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) &&
        typeof event.repository.default_branch === 'string' &&
        env.GITHUB_REF === `refs/heads/${event.repository.default_branch}` && SHA.test(env.GITHUB_SHA ?? '');
}

export async function syncIssue({report, request, env, event}) {
    assert(publicationAllowed(env, event), 'Issue updates require a trusted default-branch run.');
    const matches = [];
    for (let page = 1; page <= 10; page++) {
        const issues = await request(`https://api.github.com/repos/${REPOSITORY}/issues?state=all&creator=github-actions%5Bbot%5D&per_page=100&page=${page}`);
        assert(Array.isArray(issues) && issues.length <= 100, 'Invalid issue list response.');
        matches.push(...issues.filter(issue => !issue.pull_request && issue.user?.login === 'github-actions[bot]' && issue.body?.startsWith(`${MARKER}\n`)));
        if (issues.length < 100) break;
        assert(page < 10, 'Issue search exceeds the supported page limit.');
    }
    assert(matches.length <= 1, 'Multiple tracking issues found; refusing to create another.');
    const issue = matches[0], body = markdown(report);
    const open = report.errors.length > 0 || report.rows.some(row => row.status === 'review');
    if (!issue && !open) return 'clear';
    if (!issue) {
        await request(`https://api.github.com/repos/${REPOSITORY}/issues`, {method: 'POST', body: {title: TITLE, body}});
        return 'created';
    }
    assert(Number.isSafeInteger(issue.number) && issue.number > 0 && ['open', 'closed'].includes(issue.state), 'Invalid tracking issue identity.');
    const state = open ? 'open' : 'closed';
    if (issue.state === state && issue.title === TITLE && issue.body === body) return 'unchanged';
    await request(`https://api.github.com/repos/${REPOSITORY}/issues/${issue.number}`, {
        method: 'PATCH', body: {title: TITLE, body, state, ...(state === 'closed' ? {state_reason: 'completed'} : {})},
    });
    return state === 'closed' ? 'closed' : 'updated';
}

export async function main({env = process.env, directory = root, request = jsonClient({token: env.GH_TOKEN})} = {}) {
    const output = env.DEPENDENCY_WATCH_OUTPUT;
    assert(output, 'DEPENDENCY_WATCH_OUTPUT is required.');
    const manifests = {};
    for (const filename of MANIFESTS) manifests[filename] = JSON.parse(await readFile(join(directory, filename), 'utf8'));
    const workflow = await readFile(join(directory, '.github/workflows/dependabot-maintenance.yml'), 'utf8');
    const report = await scan({manifests, workflow, request});
    await persistReport(output, report);
    if (env.GITHUB_STEP_SUMMARY) await appendFile(env.GITHUB_STEP_SUMMARY, markdown(report));
    if (env.DEPENDENCY_WATCH_PUBLISH === 'true') {
        assert(env.GH_TOKEN && env.GITHUB_EVENT_PATH, 'Issue publication requires the workflow event and token.');
        const event = JSON.parse(await readFile(env.GITHUB_EVENT_PATH, 'utf8'));
        console.log(`Dependency tracking issue: ${await syncIssue({report, request, env, event})}.`);
    }
    console.log(`Dependency coverage: ${report.rows.filter(row => row.status === 'review').length} findings, ${report.errors.length} incomplete checks.`);
    return report.errors.length ? 1 : 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
    main().then(code => { process.exitCode = code; }).catch(() => {
        console.error('Dependency coverage failed; inspect the saved report and workflow status. No clear result can be inferred.');
        process.exitCode = 1;
    });
}
