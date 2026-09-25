import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {firebaseReader} from './firebase.mjs';
import {collectAccount, validateOutputDirectory, validateRequest, writeBundle} from './workflow.mjs';

export async function main(args = process.argv.slice(2), env = process.env, log = console.log) {
    if (!args.length || (args.length === 1 && args[0] === '--dry-run')) {
        const uid = 'synthetic-account';
        const instant = Date.parse('2026-09-25T12:00:00Z');
        const bundle = await collectAccount({request: {requestId: 'DEMO-0001', project: 'demo-yify', uid, right: 'access',
            jurisdiction: 'GDPR+DPDP', receivedAt: '2026-09-25T10:00:00Z', ownershipVerifiedAt: '2026-09-25T11:00:00Z'}, now: () => instant,
            reader: {roots: ['users', 'journals', 'availabilityAlertState'].map(collection => `${collection}/${uid}`),
                account: async () => ({localId: uid}), readDocument: async documentPath => ({path: documentPath, exists: true,
                    updateTime: '2026-09-25T09:00:00Z', fields: {payload: {stringValue: '{"example":true}'}}}),
                collections: async () => [], documents: async () => [], requestCount: () => 0}});
        log(JSON.stringify({mode: 'offline-simulation', documents: bundle.documents.length, externalRequests: 0, providerWrites: 0, filesWritten: 0}));
        return;
    }
    if (args.length !== 5 || args[0] !== '--live-read' || args[1] !== '--request-file' || args[3] !== '--out') throw new Error('invalid_arguments');
    const stat = await fs.lstat(args[2]);
    if (!stat.isFile() || (stat.mode & 0o077) || stat.size > 10000) throw new Error('request_file_must_be_private');
    const request = validateRequest(JSON.parse(await fs.readFile(args[2], 'utf8')));
    if (env.GOOGLE_CLOUD_PROJECT !== request.project) throw new Error('project_confirmation_mismatch');
    await validateOutputDirectory(args[4]);
    const reader = firebaseReader({project: request.project, uid: request.uid, accessToken: env.GOOGLE_ACCESS_TOKEN});
    const bundle = await collectAccount({request, reader});
    const receipt = await writeBundle(args[4], bundle);
    log(JSON.stringify({mode: 'live-read', documents: receipt.documents, providerWrites: 0, filesWritten: 2,
        disclosureStatus: receipt.disclosureStatus}));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch(() => {
    console.error('Privacy export stopped. No provider changes were made. Check private request configuration, read permissions, limits and output location.');
    process.exitCode = 1;
});
