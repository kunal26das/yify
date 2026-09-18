import {fileURLToPath} from 'node:url';
import {firestoreStore, pushTransport, revenueCatVerifier, tmdbCatalog} from './adapters.mjs';
import {pilotConfig, runPilot} from './worker.mjs';

export async function main(args = process.argv.slice(2), env = process.env) {
    // No arguments is a completely offline simulation: no credentials, reads, writes, or pushes.
    if (!args.length || (args.length === 1 && args[0] === '--dry-run')) {
        const {demonstrate} = await import('./simulation.mjs');
        console.log(JSON.stringify({mode: 'offline-simulation', ...(await demonstrate())}));
        return;
    }
    if (args.length !== 1 || args[0] !== '--live') throw new Error('use_dry_run_or_live');
    const {uids} = pilotConfig(env);
    for (const key of ['GOOGLE_ACCESS_TOKEN', 'GOOGLE_CLOUD_PROJECT', 'TMDB_READ_ACCESS_TOKEN', 'YIFY_SUBSCRIBER_REVENUECAT_API_KEY', 'YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS']) {
        if (!env[key]) throw new Error('missing_worker_configuration');
    }
    const store = firestoreStore(env.GOOGLE_CLOUD_PROJECT, env.GOOGLE_ACCESS_TOKEN);
    const savedCache = await store.readState('_cache');
    let existing = {};
    try {existing = JSON.parse(savedCache?.data.payload ?? '{}');} catch {}
    const catalog = tmdbCatalog(env.TMDB_READ_ACCESS_TOKEN, existing);
    const stats = await runPilot({uids, store, catalog, dryRun: false,
        verifySubscription: revenueCatVerifier(env.YIFY_SUBSCRIBER_REVENUECAT_API_KEY,
            env.YIFY_SUBSCRIBER_REVENUECAT_PRODUCT_IDS.split(',').map(value => value.trim()).filter(Boolean)),
        transport: pushTransport(env.GOOGLE_CLOUD_PROJECT, env.GOOGLE_ACCESS_TOKEN, env.EXPO_PUSH_ACCESS_TOKEN)});
    await store.writeState('_cache', {payload: JSON.stringify(catalog.cache)}, savedCache?.updateTime);
    // No titles, user IDs, device tokens, API responses, or secret-bearing errors in logs.
    console.log(JSON.stringify({mode: 'live-pilot', ...stats, catalogRequests: catalog.requestCount()}));
    if (stats.errors || stats.unknown || stats.failed) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main().catch(() => {
    console.error('Availability alert run stopped. Verify the gates, identity, credentials, and service status.');
    process.exitCode = 1;
});
