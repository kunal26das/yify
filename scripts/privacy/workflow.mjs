import {createHash} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {validateIdentity} from './firebase.mjs';

export function validateRequest(value, now = Date.now()) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('invalid_request');
    const keys = ['requestId', 'project', 'uid', 'right', 'jurisdiction', 'receivedAt', 'ownershipVerifiedAt'];
    if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => typeof value[key] !== 'string')) throw new Error('invalid_request');
    validateIdentity(value.project, value.uid);
    if (!/^[A-Z0-9][A-Z0-9-]{3,63}$/.test(value.requestId)
        || !['access', 'portability', 'erasure', 'correction'].includes(value.right)
        || !['GDPR', 'DPDP', 'GDPR+DPDP', 'other'].includes(value.jurisdiction)) throw new Error('invalid_request');
    for (const key of ['receivedAt', 'ownershipVerifiedAt']) {
        if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(value[key]) || !Number.isFinite(Date.parse(value[key]))
            || Date.parse(value[key]) > now) throw new Error('invalid_request_date');
        if (new Date(value[key]).toISOString() !== (value[key].includes('.') ? value[key] : value[key].replace('Z', '.000Z'))) throw new Error('invalid_request_date');
    }
    if (Date.parse(value.ownershipVerifiedAt) < Date.parse(value.receivedAt)) throw new Error('invalid_verification_date');
    return {...value};
}

export function deadlineReview(request) {
    const received = new Date(request.receivedAt);
    const nextMonth = new Date(received);
    nextMonth.setUTCDate(1); nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
    const lastDay = new Date(Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0)).getUTCDate();
    nextMonth.setUTCDate(Math.min(received.getUTCDate(), lastDay));
    return {gdprInitialResponseReviewBy: request.jurisdiction.includes('GDPR') ? nextMonth.toISOString() : null,
        internalReviewTarget: new Date(received.getTime() + 7 * 86400000).toISOString(),
        note: 'Review local deadline rules and act without undue delay. No extension is assumed. The internal target is not a statutory DPDP deadline.'};
}

function decoded(value) {
    if ('stringValue' in value) return value.stringValue;
    if ('booleanValue' in value) return value.booleanValue;
    if ('nullValue' in value) return null;
    if ('doubleValue' in value) return value.doubleValue;
    if ('integerValue' in value) {
        const number = Number(value.integerValue);
        return Number.isSafeInteger(number) ? number : {integer: value.integerValue};
    }
    if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields ?? {}).map(([key, item]) => [key, decoded(item)]));
    if ('arrayValue' in value) return (value.arrayValue.values ?? []).map(decoded);
    return value;
}

export async function collectAccount({request, reader, now = Date.now, maxDocuments = 5000, maxBytes = 64_000_000}) {
    request = validateRequest(request, now());
    const startedAt = new Date(now()).toISOString();
    const documents = []; const visited = new Set(); let bytes = 0;
    async function visit(documentPath, source, depth) {
        if (depth > 20 || visited.has(documentPath) || visited.size >= maxDocuments) throw new Error('document_limit');
        visited.add(documentPath);
        const doc = source === undefined ? await reader.readDocument(documentPath) : source;
        const row = doc ?? {path: documentPath, exists: false};
        const data = Object.fromEntries(Object.entries(row.fields ?? {}).map(([key, value]) => [key, decoded(value)]));
        for (const key of ['watchlist', 'history', 'preferences', 'library', 'availabilityAlerts', 'payload', 'lease']) {
            if (typeof data[key] === 'string') {try {data[key] = JSON.parse(data[key]);} catch {}}
        }
        bytes += Buffer.byteLength(JSON.stringify({...row, data}));
        if (bytes > maxBytes) throw new Error('export_limit');
        documents.push({...row, data});
        for (const collection of await reader.collections(documentPath)) {
            for (const child of await reader.documents(documentPath, collection)) await visit(child.path, child, depth + 1);
        }
    }
    const account = await reader.account();
    for (const root of reader.roots) await visit(root, undefined, 0);
    const completedAt = new Date(now()).toISOString();
    const providerGaps = [
        'RevenueCat customer, aliases and purchase records; Play/App Store/Stripe billing and retention require separate requests.',
        'Firebase Analytics, Crashlytics, Sentry, AdMob/AdSense/CMP and relevant processor logs are not exported here.',
        'Support mail, backups, hosted server logs, local device caches and device-local consent records need separate assessment.',
        'Auth password hashes, salts, session credentials, MFA recovery material and unrecognized Auth fields are intentionally excluded.',
        'Only the default Firebase Auth tenant, default Firestore database and these three account roots are covered; other schemas require inventory review.',
    ];
    return {schemaVersion: 1, request, provenance: {startedAt, completedAt, scope: [...reader.roots],
        consistentSnapshot: false, providerWrites: 0, requests: reader.requestCount?.() ?? null,
        note: 'Paginated reads are not a transaction. Data may change during collection; updateTime is retained per document. Missing parents are traversed.'},
        completeness: {status: 'covered-sources-collected-provider-review-required', providerGaps},
        deadlines: deadlineReview(request), account, documents,
        erasureReview: {status: 'plan-only-no-deletion-performed', ownershipEvidence: 'Review verification record outside this bundle before any action.',
            prerequisites: ['Verify identity and request scope.', 'Review lawful retention and third-party data before release or erasure.',
                'Prevent stale-client restoration using the account deletion barrier before removing content.',
                'Stop alert delivery and inspect availabilityAlertState for the UID even if removed from the pilot allowlist.',
                'Re-read every resource and compare updateTime before approved mutation; this export is not an executable deletion batch.'],
            resources: documents.map(doc => ({path: doc.path, exists: doc.exists, observedUpdateTime: doc.updateTime ?? null,
                reviewAction: doc.path === `journals/${request.uid}` ? 'retain-or-establish-empty-deletion-barrier-after-content-erasure' : 'review-for-erasure'})),
            authAction: account ? 'review-auth-deletion-and-session-revocation' : 'no-account-found',
            providerGaps, subscriptionNotice: 'Erasure does not cancel a subscription or establish a right to a refund.'}};
}

export async function validateOutputDirectory(directory) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory)) throw new Error('output_requires_absolute_path');
    const target = path.resolve(directory);
    const parent = path.dirname(target);
    if (await fs.realpath(parent) !== parent) throw new Error('output_parent_symlink');
    if (!(await fs.stat(parent)).isDirectory()) throw new Error('output_parent_not_directory');
    for (let ancestor = parent; ; ancestor = path.dirname(ancestor)) {
        let gitEntry;
        try {gitEntry = await fs.lstat(path.join(ancestor, '.git'));} catch (error) {
            if (error.code !== 'ENOENT') throw error;
        }
        if (gitEntry) throw new Error('output_inside_git_worktree');
        if (path.dirname(ancestor) === ancestor) break;
    }
    let existing;
    try {existing = await fs.lstat(target);} catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
    if (existing) throw new Error('EEXIST: output directory must be new');
    return target;
}

export async function writeBundle(directory, bundle) {
    const target = await validateOutputDirectory(directory);
    await fs.mkdir(target, {mode: 0o700});
    const payload = `${JSON.stringify(bundle, null, 2)}\n`;
    const receipt = {schemaVersion: 1, requestId: bundle.request.requestId, createdAt: bundle.provenance.completedAt,
        providerWrites: 0, documents: bundle.documents.filter(doc => doc.exists).length,
        sha256: createHash('sha256').update(payload).digest('hex'), file: 'account-export.json',
        disclosureStatus: 'restricted-operator-review-required', purgeReviewBy: new Date(Date.parse(bundle.provenance.completedAt) + 7 * 86400000).toISOString()};
    try {
        await fs.writeFile(path.join(target, 'account-export.json'), payload, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
        await fs.writeFile(path.join(target, 'receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, {encoding: 'utf8', mode: 0o600, flag: 'wx'});
    } catch (error) {
        await fs.rm(target, {recursive: true, force: true});
        throw error;
    }
    return receipt;
}
