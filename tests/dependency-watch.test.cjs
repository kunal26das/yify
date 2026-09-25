const assert = require('node:assert/strict');
const {test} = require('node:test');
const {mkdir, mkdtemp, readFile, rm, writeFile} = require('node:fs/promises');
const {dirname, join} = require('node:path');
const {tmpdir} = require('node:os');
const api = import('../scripts/dependency-watch.mjs');
const sha = '1'.repeat(40), newer = '2'.repeat(40);
const workflow = `jobs:\n  merge:\n    steps:\n      - name: Verifier\n        uses: actions/checkout@${sha}\n        with:\n          repository: dependabot/fetch-metadata\n          ref: ${sha}\n          path: .github-tools/fetch-metadata\n`;
const manifests = {'package.json': {resolutions: {'**/xcode/uuid': '11.1.1'}}, 'crashreporting/package.json': {}, 'tooling/package.json': {}, 'release/package.json': {resolutions: {'parent/@scope/pkg': '1.0.0'}}};
const document = (name, versions, latest = versions.at(-1)) => ({name, versions: Object.fromEntries(versions.map(version => [version, {version}])), 'dist-tags': {latest}});
const metadata = url => {
    if (url.startsWith('https://api.github.com/')) return [{name: 'v3', commit: {sha}}, {name: 'v3.1.0', commit: {sha}}, {name: 'v4.0.0-beta.1', commit: {sha: newer}}];
    const name = decodeURIComponent(new URL(url).pathname.slice(1));
    return name === 'uuid' ? document(name, ['11.1.1', '14.0.2']) : document(name, ['1.0.0']);
};
const env = {GITHUB_REPOSITORY: 'kunal26das/yify', GITHUB_EVENT_NAME: 'schedule', GITHUB_REF: 'refs/heads/main', GITHUB_SHA: sha};
const event = {repository: {full_name: 'kunal26das/yify', default_branch: 'main'}};

for (const [selector, expected] of [['uuid', 'uuid'], ['**/xcode/uuid', 'uuid'], ['eas-cli/minimatch', 'minimatch'], ['@scope/pkg', '@scope/pkg'], ['@scope/parent/@other/child', '@other/child'], ['**/@scope/pkg', '@scope/pkg']]) {
    test(`resolution selector ${selector} identifies ${expected}`, async () => assert.equal((await api).resolutionPackage(selector), expected));
}

test('invalid or wildcard-only package targets fail closed', async () => {
    const {resolutionPackage, resolutionPins} = await api;
    for (const selector of ['**', '@scope/*', 'foo/', 'foo//bar', 'pkg\nsecret', '@scope', 'https://example.com/pkg']) assert.throws(() => resolutionPackage(selector));
    assert.throws(() => resolutionPins({'package.json': {resolutions: {pkg: '^1.0.0'}}}));
    assert.throws(() => resolutionPins({'other.json': {}}));
});

test('alias inventory preserves manifest locations and queries the underlying scoped or unscoped package', async () => {
    const {aliasPins} = await api;
    const inventory = {
        'package.json': {dependencies: {current: '8.0.6', first: 'npm:@babel/core@7.29.7'}},
        'tooling/package.json': {devDependencies: {typescript: 'npm:@typescript/typescript6@6.0.2', typescript7: 'npm:typescript@7.0.2'}},
        'crashreporting/package.json': {optionalDependencies: {'@local/compiler': 'npm:typescript@7.0.2'}},
    };
    const pins = aliasPins(inventory);
    assert.equal(pins.length, 4);
    assert.deepEqual(pins.find(pin => pin.alias === 'first'), {
        kind: 'npm', file: 'package.json', selector: 'dependencies.first', alias: 'first', name: '@babel/core', current: '7.29.7',
    });
    assert.equal(pins.find(pin => pin.alias === 'typescript').name, '@typescript/typescript6');
    assert.equal(pins.find(pin => pin.alias === 'typescript7').current, '7.0.2');
    assert.equal(pins.find(pin => pin.alias === '@local/compiler').selector, 'optionalDependencies.@local/compiler');
    assert.equal(pins.some(pin => pin.name === 'current'), false);
});

test('alias inventory rejects ranges, tags, malformed targets and unsafe names', async () => {
    const {aliasPins} = await api;
    for (const requirement of ['npm:@babel/core@^7.29.7', 'npm:typescript@~7.0.2', 'npm:typescript@latest',
        'npm:typescript', 'npm:@scope/pkg', 'npm:@scope/pkg@', 'npm:typescript@7.0.2\n', 'npm:../typescript@7.0.2',
        'npm:https://example.com/pkg@1.0.0', 'npm:typescript@npm:other@7.0.2']) {
        assert.throws(() => aliasPins({'tooling/package.json': {devDependencies: {compiler: requirement}}}));
    }
    for (const alias of ['../compiler', 'compiler\n', 'compiler|injected', '@scope']) {
        assert.throws(() => aliasPins({'tooling/package.json': {devDependencies: {[alias]: 'npm:typescript@7.0.2'}}}));
    }
    assert.throws(() => aliasPins({'other.json': {}}));
    assert.throws(() => aliasPins({'tooling/package.json': {devDependencies: []}}));
    assert.throws(() => aliasPins({'tooling/package.json': {devDependencies:
        Object.fromEntries(Array.from({length: 101}, (_, index) => [`compiler${index}`, 'npm:typescript@7.0.2'])),
    }}), /supported size/);
});

test('read-only alias scans reuse real package metadata and report both newer majors and compatible updates', async () => {
    const {scan, markdown} = await api;
    const calls = [];
    const inventory = {
        'package.json': {resolutions: {'@babel/core': '8.0.6'}},
        'tooling/package.json': {devDependencies: {babel7: 'npm:@babel/core@7.29.7', typescript: 'npm:@typescript/typescript6@6.0.2'}},
    };
    const request = async (url, options) => {
        assert.equal(options, undefined);
        calls.push(url);
        if (url.includes('%40babel%2Fcore')) return document('@babel/core', ['7.29.7', '7.30.0', '8.0.6']);
        if (url.includes('%40typescript%2Ftypescript6')) return document('@typescript/typescript6', ['6.0.2', '6.0.3']);
        return metadata(url);
    };
    const report = await scan({manifests: inventory, workflow, request});
    assert.deepEqual(report.errors, []);
    assert.equal(calls.filter(url => url.includes('%40babel%2Fcore')).length, 1);
    assert.equal(calls.some(url => /\/babel7(?:$|\?)/.test(url)), false);
    const babel = report.rows.find(row => row.alias === 'babel7');
    assert.equal(babel.status, 'review');
    assert.equal(babel.sameMajor, '7.30.0');
    assert.equal(babel.latest, '8.0.6');
    assert.equal(report.rows.find(row => row.alias === 'typescript').sameMajor, '6.0.3');
    const text = markdown(report);
    assert.match(text, /devDependencies\.babel7 → @babel\/core/);
    assert.match(text, /no dependencies are changed automatically/);
});

test('malformed alias coverage is visible while resolution and verifier reports remain available', async () => {
    const {scan} = await api;
    const report = await scan({manifests: {...manifests, 'tooling/package.json': {
        devDependencies: {compiler: 'npm:@babel/core@latest'},
    }}, workflow, request: metadata});
    assert.deepEqual(report.errors, ['Cannot inspect exact workspace/release npm alias pins.']);
    assert.equal(report.rows.length, 3);
    assert.equal(report.rows.some(row => row.name === 'uuid'), true);
});

test('real tooling manifest aliases are included in dependency watch coverage', async () => {
    const {aliasPins} = await api;
    const pkg = JSON.parse(await readFile(join(__dirname, '../tooling/package.json'), 'utf8'));
    const pins = aliasPins({'tooling/package.json': pkg});
    assert.deepEqual(pins.map(pin => [pin.alias, pin.name]), [
        ['babel7', '@babel/core'], ['typescript', '@typescript/typescript6'], ['typescript7', 'typescript'],
    ]);
});

test('report inventory reads both app workspaces and preserves scoped resolution package names', async t => {
    const {main} = await api;
    const directory = await mkdtemp(join(tmpdir(), 'dependency-watch-workspaces-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    const inventory = {
        ...manifests,
        'package.json': {resolutions: {'@yify/tooling/**/ts-api-utils': '2.5.0'}},
        'crashreporting/package.json': {resolutions: {'**/@scope/pkg': '1.0.0'}},
        'tooling/package.json': {resolutions: {'**/uuid': '11.1.1'}},
    };
    for (const [filename, pkg] of Object.entries(inventory)) {
        await mkdir(join(directory, dirname(filename)), {recursive: true});
        await writeFile(join(directory, filename), JSON.stringify(pkg));
    }
    await mkdir(join(directory, '.github/workflows'), {recursive: true});
    await writeFile(join(directory, '.github/workflows/dependabot-maintenance.yml'), workflow);
    const output = join(directory, 'report');
    assert.equal(await main({directory, env: {DEPENDENCY_WATCH_OUTPUT: output}, request: metadata}), 0);
    const report = JSON.parse(await readFile(join(output, 'report.json'), 'utf8'));
    assert.equal(report.rows.find(row => row.file === 'tooling/package.json').status, 'review');
    assert.equal(report.rows.find(row => row.file === 'crashreporting/package.json').name, '@scope/pkg');
    assert.equal(report.rows.find(row => row.selector === '@yify/tooling/**/ts-api-utils').name, 'ts-api-utils');
});

test('semantic comparison handles numeric parts, prereleases and ignored build metadata', async () => {
    const {compareVersions, semver} = await api;
    const ordered = ['1.0.0-alpha', '1.0.0-alpha.2', '1.0.0-alpha.10', '1.0.0-beta', '1.0.0-rc.1', '1.0.0', '1.0.2', '1.0.10', '2.0.0'];
    for (let i = 1; i < ordered.length; i++) assert.equal(compareVersions(ordered[i - 1], ordered[i]), -1);
    assert.equal(compareVersions('1.0.0+first', '1.0.0+second'), 0);
    for (const version of ['01.0.0', '1.0.0-01', '^1.0.0', '1.0', null, '1.0.0\n']) assert.equal(semver(version), null);
});

test('npm report separates latest tag, highest stable and newest release in pinned major', async () => {
    const {npmVersions} = await api;
    assert.deepEqual(npmVersions('pkg', document('pkg', ['1.9.0', '1.10.0', '2.0.0', '3.0.0-beta.1']), '1.9.0'), {
        latest: '3.0.0-beta.1', newestStable: '2.0.0', sameMajor: '1.10.0', status: 'review',
    });
    assert.equal(npmVersions('pkg', document('pkg', ['1.0.0']), '2.0.0').status, 'current');
    for (const malformed of [{}, document('wrong', ['1.0.0']), document('pkg', ['1.0.0'], '9.0.0'), document('pkg', ['1.0.0-beta'])]) assert.throws(() => npmVersions('pkg', malformed, '1.0.0'));
});

test('checkout parsing binds the repository to its own ref and ignores earlier checkout refs', async () => {
    const {verifierPin} = await api;
    const other = `      - name: Source\n        uses: actions/checkout@${sha}\n        with:\n          ref: main\n`;
    assert.equal(verifierPin(workflow.replace('      - name: Verifier', `${other}      - name: Verifier`)).current, sha);
    assert.equal(verifierPin(workflow.replace('dependabot/fetch-metadata', "'dependabot/fetch-metadata' # source")).name, 'dependabot/fetch-metadata');
    for (const invalid of [workflow.replace(`ref: ${sha}`, 'ref: main'), workflow.replace('repository:', 'other:'), `${workflow}${workflow}`, workflow.replace(`ref: ${sha}`, `ref: ${sha}\n          ref: ${newer}`), workflow.replace(`checkout@${sha}`, 'checkout@v7')]) assert.throws(() => verifierPin(invalid));
});

test('tag selection ignores moving major tags and prereleases, sorts numerically and peels tag-list commit identity', async () => {
    const {latestVerifier} = await api;
    const result = await latestVerifier(async () => [{name: 'v3', commit: {sha}}, {name: 'v4.0.0-beta.1', commit: {sha}}, {name: 'v3.9.0', commit: {sha}}, {name: 'v3.10.0', commit: {sha: newer}}]);
    assert.deepEqual(result, {tag: 'v3.10.0', version: '3.10.0', sha: newer});
    for (const value of [{}, [], [{name: 'v1.0.0', commit: {sha: 'main'}}]]) await assert.rejects(latestVerifier(async () => value));
});

test('tag pagination is bounded and never silently treats truncated data as current', async () => {
    const {latestVerifier} = await api;
    let calls = 0;
    await assert.rejects(latestVerifier(async () => { calls++; return Array.from({length: 100}, () => ({name: 'v1.0.0', commit: {sha}})); }), /page limit/);
    assert.equal(calls, 10);
});

test('read-only scanning uses package names rather than resolution paths, catches partial upstream failures', async () => {
    const {scan} = await api; const urls = [];
    const report = await scan({manifests, workflow, request: async url => { urls.push(url); return metadata(url); }});
    assert.equal(report.rows.length, 3); assert.deepEqual(report.errors, []);
    assert.ok(urls.includes('https://registry.npmjs.org/%40scope%2Fpkg'));
    assert.equal(report.rows.find(row => row.name === 'uuid').status, 'review');
    const failure = await scan({manifests, workflow, request: async url => {
        if (url.includes('%40scope')) throw new Error('Private auth token must not leak');
        return metadata(url);
    }});
    assert.equal(failure.errors.length, 1);
    assert.doesNotMatch(JSON.stringify(failure), /Private|token/);
});

test('JSON transport keeps tokens off npm, rejects redirects and never executes package data', async () => {
    const {jsonClient} = await api; const calls = [];
    const request = jsonClient({token: 'private-token', fetchImpl: async (url, options) => { calls.push({url, options}); return new Response('{"ok":true}'); }});
    await request('https://registry.npmjs.org/uuid'); await request('https://api.github.com/repos/dependabot/fetch-metadata/tags');
    assert.equal(calls[0].options.headers.Authorization, undefined);
    assert.equal(calls[0].options.headers.Accept, 'application/vnd.npm.install-v1+json');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer private-token');
    assert.equal(calls[1].options.headers.Accept, 'application/json');
    assert.equal(calls[0].options.redirect, 'error');
    await assert.rejects(request('https://evil.example/package'));
    await assert.rejects(request('https://registry.npmjs.org/uuid', {method: 'POST'}));
    for (const response of [new Response('secret', {status: 500}), new Response('private-not-json'), new Response('x'.repeat(16 * 1024 * 1024 + 1))]) {
        await assert.rejects(jsonClient({fetchImpl: async () => response})('https://registry.npmjs.org/uuid'), error => !/secret|private/.test(error.message));
    }
    await assert.rejects(jsonClient({fetchImpl: async () => new Response('x'.repeat(8 * 1024 * 1024 + 1))})(
        'https://api.github.com/repos/dependabot/fetch-metadata/tags'), /size limit/);
    await assert.rejects(jsonClient({fetchImpl: async () => { throw new Error('token=private'); }})('https://registry.npmjs.org/uuid'), /failed or timed out/);
});

test('abbreviated npm metadata may exceed 8 MiB while staying within the registry limit', async () => {
    const {jsonClient} = await api;
    const data = document('typescript', ['7.0.2']);
    const body = `${JSON.stringify(data)}${' '.repeat(8 * 1024 * 1024)}`;
    const result = await jsonClient({fetchImpl: async () => new Response(body)})('https://registry.npmjs.org/typescript');
    assert.deepEqual(result, data);
});

test('report files persist fully and failed replacement preserves the earlier report', async t => {
    const {persistReport, scan} = await api;
    const directory = await mkdtemp(join(tmpdir(), 'dependency-watch-')); t.after(() => rm(directory, {recursive: true, force: true}));
    const report = await scan({manifests, workflow, request: metadata});
    await persistReport(directory, report);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')), report);
    assert.match(await readFile(join(directory, 'report.md'), 'utf8'), /uuid/);
    await assert.rejects(persistReport(directory, {version: 1, rows: [], errors: []}, {move: async () => { throw new Error('disk full'); }}), /disk full/);
    assert.deepEqual(JSON.parse(await readFile(join(directory, 'report.json'), 'utf8')), report);
});

test('issue publication rejects branch tests, forks and pull request events before any network call', async () => {
    const {syncIssue, publicationAllowed} = await api;
    assert.equal(publicationAllowed({...env, GITHUB_EVENT_NAME: 'workflow_dispatch'}, event), true);
    for (const changed of [{GITHUB_REF: 'refs/heads/test'}, {GITHUB_REPOSITORY: 'someone/fork'}, {GITHUB_EVENT_NAME: 'pull_request_target'}, {GITHUB_SHA: 'main'}]) {
        await assert.rejects(syncIssue({report: {version: 1, rows: [], errors: []}, env: {...env, ...changed}, event, request: async () => assert.fail('No network call allowed')}), /default-branch/);
    }
});

test('one issue is created, unchanged reruns do nothing, and resolution closes the same issue', async () => {
    const {scan, syncIssue, MARKER, TITLE} = await api;
    const report = await scan({manifests, workflow, request: metadata});
    let issue; const writes = [];
    const request = async (url, options) => {
        if (!options) return issue ? [issue] : [];
        writes.push({url, ...options});
        if (options.method === 'POST') issue = {...options.body, number: 12, user: {login: 'github-actions[bot]'}, state: 'open'};
        else issue = {...issue, ...options.body};
        return issue;
    };
    assert.equal(await syncIssue({report, request, env, event}), 'created');
    assert.ok(issue.body.startsWith(MARKER)); assert.equal(issue.title, TITLE);
    assert.equal(await syncIssue({report, request, env, event}), 'unchanged'); assert.equal(writes.length, 1);
    const clear = {...report, rows: report.rows.map(row => ({...row, status: 'current'}))};
    assert.equal(await syncIssue({report: clear, request, env, event}), 'closed');
    assert.equal(issue.state, 'closed'); assert.equal(writes.length, 2);
    assert.equal(await syncIssue({report: clear, request, env, event}), 'unchanged'); assert.equal(writes.length, 2);
    assert.equal(await syncIssue({report, request, env, event}), 'updated'); assert.equal(writes.length, 3);
    assert.equal(issue.state, 'open');
    assert.ok(writes.every(call => !call.url.includes('comments')));
});

test('upstream failure keeps tracking open; duplicate issues and API failures never cause duplicate creation', async () => {
    const {syncIssue, MARKER, TITLE} = await api;
    const issue = {number: 1, title: TITLE, user: {login: 'github-actions[bot]'}, state: 'open', body: `${MARKER}\nPrevious findings`};
    const report = {version: 1, rows: [], errors: ['Cannot verify root resolution pins.']};
    const writes = [];
    await syncIssue({report, env, event, request: async (_url, options) => { if (options) { writes.push(options); return issue; } return [issue]; }});
    assert.equal(writes[0].body.state, 'open');
    await assert.rejects(syncIssue({report, env, event, request: async () => [issue, {...issue, number: 2}]}), /Multiple/);
    await assert.rejects(syncIssue({report, env, event, request: async (_url, options) => { if (options) throw new Error('GitHub write failed'); return [issue]; }}), /write failed/);
    assert.equal(await syncIssue({report: {version: 1, rows: [], errors: []}, env, event, request: async () => []}), 'clear');
});

test('failed report persistence stops before any issue lookup or mutation', async t => {
    const {main} = await api;
    const directory = await mkdtemp(join(tmpdir(), 'dependency-watch-main-'));
    t.after(() => rm(directory, {recursive: true, force: true}));
    await mkdir(join(directory, 'release'));
    await mkdir(join(directory, '.github/workflows'), {recursive: true});
    for (const [name, pkg] of Object.entries(manifests)) {
        await mkdir(join(directory, dirname(name)), {recursive: true});
        await writeFile(join(directory, name), JSON.stringify(pkg));
    }
    await writeFile(join(directory, '.github/workflows/dependabot-maintenance.yml'), workflow);
    const output = join(directory, 'not-a-directory');
    await writeFile(output, 'Keep this file');
    await assert.rejects(main({directory, env: {...env, GH_TOKEN: 'private', DEPENDENCY_WATCH_PUBLISH: 'true', DEPENDENCY_WATCH_OUTPUT: output},
        request: async (url, options) => {
            assert.equal(options, undefined);
            assert.equal(url.includes('/issues'), false);
            return metadata(url);
        },
    }));
    assert.equal(await readFile(output, 'utf8'), 'Keep this file');
});

test('workflow never grants issue writes to manual branch reports or executes installed dependency code', async () => {
    const text = await readFile(join(__dirname, '../.github/workflows/dependency-watch.yml'), 'utf8');
    assert.match(text, /\npermissions:\n  contents: read\n\n/);
    assert.doesNotMatch(text.split('\n  track:')[0], /issues: write|DEPENDENCY_WATCH_PUBLISH/);
    assert.doesNotMatch(text, /pull_request_target/);
    assert.match(text, /    permissions:\n      contents: read\n      issues: write\n/);
    assert.match(text, /github\.ref == format\('refs\/heads\/\{0\}', github\.event\.repository\.default_branch\)/);
    assert.match(text, /ref: \$\{\{ github.sha \}\}/);
    assert.match(text.split('\n  track:')[1], /name: Test trusted reporting code\n        run: node --test tests\/dependency-watch.test.cjs\n      - name: Refresh public metadata/);
    assert.doesNotMatch(text, /yarn install|npm install|npx|issues\/.*comments/);
});
