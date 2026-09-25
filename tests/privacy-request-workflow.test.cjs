const assert = require('node:assert/strict');
const test = require('node:test');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {spawnSync} = require('node:child_process');

const load = async () => ({...await import('../scripts/privacy/firebase.mjs'), ...await import('../scripts/privacy/workflow.mjs')});
const instant = Date.parse('2026-09-25T12:00:00Z');
const request = {requestId: 'TEST-0001', project: 'demo-yify', uid: 'test-user', right: 'access', jurisdiction: 'GDPR+DPDP',
    receivedAt: '2026-09-25T10:00:00Z', ownershipVerifiedAt: '2026-09-25T11:00:00Z'};
const name = suffix => `projects/demo-yify/databases/(default)/documents/${suffix}`;
const doc = (suffix, fields = {}) => ({name: name(suffix), fields, updateTime: '2026-09-25T09:00:00Z'});
const json = (body, status = 200) => new Response(JSON.stringify(body), {status});

function fakeProvider() {
    const calls = [];
    const fetcher = async (address, init) => {
        const url = new URL(address); const body = init.body ? JSON.parse(init.body) : null;
        calls.push({url, init, body});
        if (url.hostname === 'identitytoolkit.googleapis.com') return json({users: [{localId: request.uid, email: 'person@example.test',
            passwordHash: 'do-not-export-hash', salt: 'do-not-export-salt', refreshToken: 'do-not-export-token',
            providerUserInfo: [{providerId: 'google.com', email: 'person@example.test', accessToken: 'do-not-export-provider-token'}]}]});
        const suffix = decodeURIComponent(url.pathname.split('/documents/')[1] ?? '');
        if (suffix.endsWith(':listCollectionIds')) {
            const parent = suffix.replace(':listCollectionIds', '');
            if (parent === 'journals/test-user') return json(body.pageToken ? {collectionIds: ['archive']} : {collectionIds: ['entries'], nextPageToken: 'collections-page2'});
            if (parent === 'journals/test-user/archive/missing') return json({collectionIds: ['notes']});
            return json({});
        }
        if (suffix === 'users/test-user') return json(doc(suffix, {watchlist: {stringValue: '{"movies":[1,2]}'}, preferences: {stringValue: '{"country":"IN"}'},
            availabilityAlerts: {stringValue: '{"devices":[{"token":"private-device-token"}]}'}}));
        if (suffix === 'journals/test-user') return json({}, 404);
        if (suffix === 'journals/test-user/entries') return json(url.searchParams.has('pageToken') ? {documents: [doc(`${suffix}/second`, {note: {stringValue: 'second note'}})]}
            : {documents: [doc(`${suffix}/first`, {note: {stringValue: 'first note'}})], nextPageToken: 'documents-page2'});
        if (suffix === 'journals/test-user/archive') return json({documents: [{name: name(`${suffix}/missing`)}]});
        if (suffix === 'journals/test-user/archive/missing/notes') return json({documents: [doc(`${suffix}/old`, {note: {stringValue: 'old note'}})]});
        if (suffix === 'availabilityAlertState/test-user') return json(doc(suffix, {payload: {stringValue: '{"devices":{"stale-device":{"lastSent":1}}}'}}));
        throw new Error('unexpected_test_request');
    };
    return {calls, fetcher};
}

test('privacy CLI is completely offline by default even with credentials present', () => {
    const result = spawnSync(process.execPath, ['scripts/privacy/run.mjs'], {cwd: path.resolve(__dirname, '..'), encoding: 'utf8',
        env: {...process.env, GOOGLE_ACCESS_TOKEN: 'secret', GOOGLE_CLOUD_PROJECT: 'real-project'}});
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), {mode: 'offline-simulation', documents: 3, externalRequests: 0, providerWrites: 0, filesWritten: 0});
});

test('export paginates all journals through missing parents and reads worker state without consulting pilot membership', async () => {
    const {firebaseReader, collectAccount} = await load(); const source = fakeProvider();
    const reader = firebaseReader({...request, accessToken: 'short-lived-test-token', fetcher: source.fetcher});
    const bundle = await collectAccount({request, reader, now: () => instant});
    assert.equal(bundle.documents.length, 7);
    assert.equal(bundle.documents.find(item => item.path.endsWith('/old')).data.note, 'old note');
    assert.equal(bundle.documents.find(item => item.path === 'journals/test-user').exists, false);
    assert.deepEqual(bundle.documents.find(item => item.path === 'users/test-user').data.watchlist, {movies: [1, 2]});
    assert.equal(bundle.documents.find(item => item.path.startsWith('availabilityAlertState/')).data.payload.devices['stale-device'].lastSent, 1);
    assert.equal(bundle.provenance.providerWrites, 0);
    assert.equal(bundle.provenance.consistentSnapshot, false);
    assert.equal(bundle.erasureReview.status, 'plan-only-no-deletion-performed');
    assert.ok(bundle.erasureReview.resources.find(item => item.path === 'journals/test-user').reviewAction.includes('barrier'));
    assert.ok(bundle.completeness.providerGaps.some(gap => gap.includes('RevenueCat')));
    assert.ok(source.calls.every(call => call.init.method === 'GET' || call.url.pathname.endsWith(':lookup') || call.url.pathname.endsWith(':listCollectionIds')));
    assert.ok(source.calls.every(call => call.init.redirect === 'error'));
    assert.ok(source.calls.filter(call => call.url.pathname.endsWith('/entries')).every(call => call.url.searchParams.get('showMissing') === 'true'));
    assert.deepEqual(source.calls[0].body, {localId: ['test-user']});
    assert.ok(!JSON.stringify(bundle.account).includes('do-not-export'));
});

test('a denied source aborts collection instead of reporting a complete export', async () => {
    const {firebaseReader, collectAccount} = await load(); const source = fakeProvider();
    const reader = firebaseReader({...request, accessToken: 'test', fetcher: (url, init) => String(url).includes('availabilityAlertState')
        ? json({error: {message: 'sensitive provider detail'}}, 403) : source.fetcher(url, init)});
    await assert.rejects(collectAccount({request, reader, now: () => instant}), /^Error: provider_read_failed$/);
});

test('recursive export refuses truncation when document or byte budgets are exceeded', async () => {
    const {firebaseReader, collectAccount} = await load();
    for (const limit of [{maxDocuments: 2}, {maxBytes: 10}]) {
        const reader = firebaseReader({...request, accessToken: 'test', fetcher: fakeProvider().fetcher});
        await assert.rejects(collectAccount({request, reader, now: () => instant, ...limit}), /document_limit|export_limit/);
    }
});

test('reader rejects paths outside the verified account without issuing a request', async () => {
    const {firebaseReader} = await load(); let calls = 0;
    const reader = firebaseReader({...request, accessToken: 'test', fetcher: async () => {calls++; return json({});}});
    for (const value of ['users/other', 'availabilityAlertState/_cache', 'users/test-user/../other', 'https://example.test']) {
        await assert.rejects(reader.readDocument(value), /invalid_document_scope/);
    }
    assert.equal(calls, 0);
});

test('reader rejects foreign document names and unexpected account matches', async () => {
    const {firebaseReader} = await load();
    for (const response of [{users: [{localId: 'other'}]}, {users: [{localId: request.uid}, {localId: 'other'}]}]) {
        const reader = firebaseReader({...request, accessToken: 'test', fetcher: async () => json(response)});
        await assert.rejects(reader.account(), /unexpected_account/);
    }
    for (const response of [doc('users/other'), {name: 'projects/other/databases/(default)/documents/users/test-user'}, {name: name('users/test-user'), fields: {}}]) {
        const reader = firebaseReader({...request, accessToken: 'test', fetcher: async () => json(response)});
        await assert.rejects(reader.readDocument('users/test-user'), /invalid_document|unexpected_document|missing_revision/);
    }
});

test('collection pagination fails on repeated tokens or invalid collection paths', async () => {
    const {firebaseReader} = await load();
    for (const response of [{collectionIds: [], nextPageToken: 'repeat'}, {collectionIds: ['../other']}, {collectionIds: ['entries', 'entries']}]) {
        const reader = firebaseReader({...request, accessToken: 'test', fetcher: async () => json(response)});
        await assert.rejects(reader.collections('journals/test-user'), /invalid_pagination|invalid_collection/);
    }
});

test('request requires recorded ownership verification and explicit valid scope', async () => {
    const {validateRequest} = await load();
    assert.deepEqual(validateRequest(request, instant), request);
    for (const change of [{ownershipVerifiedAt: undefined}, {ownershipVerifiedAt: '2026-09-25T09:00:00Z'}, {uid: '../other'},
        {uid: '_cache'}, {receivedAt: '2027-01-01T00:00:00Z'}, {receivedAt: '2026-02-30T00:00:00Z'},
        {right: 'delete-now'}, {jurisdiction: 'unknown'}, {email: 'private@example.test'}]) {
        assert.throws(() => validateRequest({...request, ...change}, instant));
    }
});

test('native Firestore values preserve nested data and integer precision in readable exports', async () => {
    const {firebaseReader, collectAccount} = await load(); const source = fakeProvider();
    const reader = firebaseReader({...request, accessToken: 'test', fetcher: (url, init) => String(url).endsWith('/users/test-user')
        ? json(doc('users/test-user', {nested: {mapValue: {fields: {values: {arrayValue: {values: [{integerValue: '9007199254740993'},
            {booleanValue: false}, {nullValue: null}, {timestampValue: '2026-09-25T10:00:00Z'}]}}}}}})) : source.fetcher(url, init)});
    const bundle = await collectAccount({request, reader, now: () => instant});
    assert.deepEqual(bundle.documents[0].data.nested.values, [{integer: '9007199254740993'}, false, null, {timestampValue: '2026-09-25T10:00:00Z'}]);
});

test('request and response budgets fail without exposing credential or provider response details', async () => {
    const {firebaseReader} = await load();
    const reader = firebaseReader({...request, accessToken: 'test-secret', maxRequests: 0, fetcher: async () => {throw new Error('must not call');}});
    await assert.rejects(reader.account(), /^Error: request_limit$/);
    const oversized = firebaseReader({...request, accessToken: 'test-secret', fetcher: async () => new Response('x'.repeat(8_000_001), {status: 200})});
    await assert.rejects(oversized.account(), /^Error: response_limit$/);
});

test('deadline review clamps month ends and does not invent a statutory DPDP deadline', async () => {
    const {deadlineReview} = await load();
    assert.equal(deadlineReview({...request, receivedAt: '2026-01-31T10:00:00Z'}).gdprInitialResponseReviewBy, '2026-02-28T10:00:00.000Z');
    assert.equal(deadlineReview({...request, receivedAt: '2028-01-31T10:00:00Z'}).gdprInitialResponseReviewBy, '2028-02-29T10:00:00.000Z');
    assert.equal(deadlineReview({...request, jurisdiction: 'DPDP'}).gdprInitialResponseReviewBy, null);
});

test('bundle output is private, refuses overwrites and records a checksum without duplicating identity', async t => {
    const {firebaseReader, collectAccount, writeBundle} = await load();
    const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-workflow-')));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    const bundle = await collectAccount({request, reader: firebaseReader({...request, accessToken: 'test', fetcher: fakeProvider().fetcher}), now: () => instant});
    const directory = path.join(temporary, 'export');
    const receipt = await writeBundle(directory, bundle);
    assert.equal((await fs.stat(directory)).mode & 0o777, 0o700);
    for (const file of ['account-export.json', 'receipt.json']) assert.equal((await fs.stat(path.join(directory, file))).mode & 0o777, 0o600);
    const content = await fs.readFile(path.join(directory, 'account-export.json'));
    assert.equal(receipt.sha256, createHash('sha256').update(content).digest('hex'));
    assert.ok(!JSON.stringify(receipt).includes(request.uid));
    await assert.rejects(writeBundle(directory, bundle), /EEXIST/);
    await fs.symlink(directory, path.join(temporary, 'link'));
    await assert.rejects(writeBundle(path.join(temporary, 'link', 'other'), bundle), /output_parent_symlink/);
});

test('CLI rejects live reads with insecure request files or a mismatched project before network access', async t => {
    const {main} = await import('../scripts/privacy/run.mjs');
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-cli-'));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    const file = path.join(temporary, 'request.json'); await fs.writeFile(file, JSON.stringify(request), {mode: 0o644});
    const args = ['--live-read', '--request-file', file, '--out', path.join(temporary, 'out')];
    await assert.rejects(main(args, {}), /request_file_must_be_private/);
    await fs.chmod(file, 0o600);
    await assert.rejects(main(args, {GOOGLE_CLOUD_PROJECT: 'other-project'}), /project_confirmation_mismatch/);
    await assert.rejects(main(['--delete']), /invalid_arguments/);
});

test('export refuses relative paths and any ordinary or linked Git worktree even for ignored output', async t => {
    const {validateOutputDirectory, writeBundle} = await load();
    const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-output-')));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    await assert.rejects(validateOutputDirectory('public/private-export'), /output_requires_absolute_path/);
    await assert.rejects(validateOutputDirectory(path.resolve(__dirname, '../public/private-export')), /output_inside_git_worktree/);
    for (const type of ['main', 'linked']) {
        const repository = path.join(temporary, type);
        await fs.mkdir(repository);
        if (type === 'main') await fs.mkdir(path.join(repository, '.git'));
        else await fs.writeFile(path.join(repository, '.git'), 'gitdir: /synthetic/main/.git/worktrees/linked\n');
        for (const child of ['public', '.expo']) {
            await fs.mkdir(path.join(repository, child));
            const target = path.join(repository, child, 'export');
            await assert.rejects(validateOutputDirectory(target), /output_inside_git_worktree/);
            await assert.rejects(writeBundle(target, null), /output_inside_git_worktree/);
            await assert.rejects(fs.lstat(target), /ENOENT/);
        }
    }
});

test('CLI checks an unsafe output destination before accessing any live account source', async t => {
    const {main} = await import('../scripts/privacy/run.mjs');
    const temporary = await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(), 'privacy-preflight-')));
    t.after(() => fs.rm(temporary, {recursive: true, force: true}));
    const file = path.join(temporary, 'request.json');
    const earlier = '2026-01-01T00:00:00Z';
    await fs.writeFile(file, JSON.stringify({...request, receivedAt: earlier, ownershipVerifiedAt: earlier}), {mode: 0o600});
    const originalFetch = globalThis.fetch; let calls = 0;
    globalThis.fetch = async () => {calls++; throw new Error('must-not-access-provider');};
    t.after(() => {globalThis.fetch = originalFetch;});
    const env = {GOOGLE_CLOUD_PROJECT: request.project, GOOGLE_ACCESS_TOKEN: 'test-short-lived-token'};
    const destinations = ['public/private-export', path.resolve(__dirname, '../public/private-export')];
    const linkedParent = path.join(temporary, 'linked-parent');
    await fs.symlink(path.dirname(destinations[1]), linkedParent);
    destinations.push(path.join(linkedParent, 'private-export'));
    for (const target of destinations) {
        await assert.rejects(main(['--live-read', '--request-file', file, '--out', target], env),
            /output_requires_absolute_path|output_inside_git_worktree|output_parent_symlink/);
    }
    assert.equal(calls, 0);
});
