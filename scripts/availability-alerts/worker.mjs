import {createHash, randomUUID} from 'node:crypto';
import {alertContext, deliveryWindow, parseAvailabilityEnrollment, planAvailability} from '../../domain/availability/pilot.ts';

const hash = value => createHash('sha256').update(value).digest('hex').slice(0, 32);
const parse = (raw, fallback) => {try {return JSON.parse(raw);} catch {return fallback;}};

export function pilotConfig(env) {
    const uids = [...new Set((env.AVAILABILITY_ALERTS_PILOT_UIDS ?? '').split(',').map(value => value.trim()).filter(Boolean))];
    if (env.AVAILABILITY_ALERTS_PILOT_ENABLED !== 'true' || env.TMDB_COMMERCIAL_LICENSE_CONFIRMED !== 'true') throw new Error('pilot_disabled');
    if (!uids.length || uids.length > 20 || uids.some(uid => !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(uid))) throw new Error('invalid_pilot_allowlist');
    return {uids};
}

export async function runPilot({uids, store, catalog, verifySubscription, transport, now = Date.now, dryRun = true}) {
    if (!Array.isArray(uids) || uids.length > 20) throw new Error('pilot_limit');
    const stats = {users: 0, skipped: 0, conflicts: 0, observations: 0, unavailable: 0,
        planned: 0, accepted: 0, failed: 0, unknown: 0, disabledTokens: 0, errors: 0};
    const deadline = now() + 8 * 60_000;
    for (const uid of uids) {
        if (now() > deadline) {stats.skipped++; continue;}
        let current;
        let owned = false;
        let state = {version: 1, devices: {}};
        const owner = randomUUID();
        const write = async () => {
            // All state transitions use updateTime; a lease alone is not a concurrency guarantee.
            const next = await store.writeState(uid, {payload: JSON.stringify(state),
                lease: JSON.stringify({owner, until: now() + 10 * 60_000})}, current?.updateTime);
            if (!next) {owned = false; stats.conflicts++; throw new Error('lease_conflict');}
            current = next;
        };
        try {
            current = await store.readState(uid);
            const lease = parse(current?.data.lease, {});
            if (lease.until > now()) {stats.skipped++; continue;}
            const previous = parse(current?.data.payload, null);
            if (previous?.version === 1 && previous.devices && typeof previous.devices === 'object' && !Array.isArray(previous.devices)) state = previous;
            await write(); owned = true;
            const account = await store.readUser(uid);
            if (!account) {await store.deleteState(uid, current.updateTime); owned = false; stats.skipped++; continue;}
            const enrollment = parseAvailabilityEnrollment(account.data.availabilityAlerts);
            if (!enrollment?.devices.length) {
                state.devices = {}; await write(); stats.skipped++; continue;
            }
            state.devices = Object.fromEntries(Object.entries(state.devices).filter(([id]) => enrollment.devices.some(d => d.id === id)));
            if (!(await verifySubscription(uid))) {state.devices = {}; await write(); stats.skipped++; continue;}
            stats.users++;
            for (const device of enrollment.devices) {
                if (now() > deadline) break;
                const context = alertContext(account.data, device);
                if (!context) {delete state.devices[device.id]; continue;}
                const previousDevice = state.devices[device.id];
                const tokenHash = hash(device.token);
                if (previousDevice?.disabledTokenHash === tokenHash) {stats.skipped++; continue;}
                // Tickets acknowledge provider acceptance. Receipts are checked on later hourly runs.
                const attempt = previousDevice?.attempt;
                if (attempt?.receiptId && now() - attempt.at >= 15 * 60_000 && transport.receipt) {
                    const receipt = await transport.receipt(attempt.receiptId);
                    if (receipt?.invalidToken) {
                        previousDevice.disabledTokenHash = attempt.tokenHash; delete attempt.receiptId;
                        stats.disabledTokens++; await write();
                        if (previousDevice.disabledTokenHash === tokenHash) continue;
                    }
                    if (receipt) {delete attempt.receiptId; if (!receipt.ok) stats.failed++;}
                    else if (now() - attempt.at > 24 * 60 * 60_000) {delete attempt.receiptId; stats.unknown++;}
                }
                const observations = {};
                for (const movie of context.movies) {
                    if (now() > deadline) break;
                    const result = await catalog.observe(movie, context.country);
                    observations[movie.imdbCode] = result; stats.observations++;
                    if (result.status !== 'ready') stats.unavailable++;
                }
                const plan = planAvailability(context, previousDevice, observations, now());
                state.devices[device.id] = plan.state;
                const window = deliveryWindow(context, device, now());
                await write();
                if (!plan.deliverable.length || !window.due || plan.state.attemptedDay === window.day) continue;
                stats.planned++;
                if (dryRun) continue;
                const fresh = await store.readUser(uid);
                const registered = parseAvailabilityEnrollment(fresh?.data.availabilityAlerts)?.devices.find(d => d.id === device.id);
                const freshContext = registered && fresh ? alertContext(fresh.data, registered) : null;
                // Any account update is postponed until another run, including opt-outs and removed titles.
                if (!fresh || fresh.updateTime !== account.updateTime || !registered || registered.token !== device.token
                    || !freshContext || freshContext.signature !== context.signature || !(await verifySubscription(uid))) {
                    stats.skipped++; continue;
                }
                const eventIds = plan.deliverable.map(event => hash(event.id));
                const eventId = hash(`${device.id}|${eventIds.join(',')}`);
                const reserved = new Set(plan.deliverable.map(event => event.id));
                plan.state.pending = plan.state.pending.filter(event => !reserved.has(event.id));
                plan.state.attemptedDay = window.day;
                plan.state.attempt = {id: eventId, at: now(), status: 'reserved', tokenHash};
                // Persist before transport: an ambiguous response or process crash must not produce duplicate sends.
                await write();
                try {
                    const title = 'Something on your watchlist is ready';
                    const body = plan.deliverable.length === 1 ? 'A saved movie is now on one of your selected streaming services.'
                        : `${plan.deliverable.length} saved movies are now on your selected streaming services.`;
                    const result = await transport.send(device, {title, body,
                        data: {kind: 'availability', eventId, title, body, path: '/watchlist',
                            count: String(plan.deliverable.length), country: context.country}});
                    plan.state.attempt.status = result.status;
                    if (result.receiptId) plan.state.attempt.receiptId = result.receiptId;
                    if (result.invalidToken) {plan.state.disabledTokenHash = tokenHash; stats.disabledTokens++;}
                    if (result.status === 'accepted') stats.accepted++;
                    else {
                        stats.failed++;
                        // A definitive rejection can be retried the following day, after all eligibility checks.
                        plan.state.pending.push(...plan.deliverable);
                    }
                } catch {plan.state.attempt.status = 'unknown'; stats.unknown++;}
                await write();
            }
        } catch {stats.errors++;}
        finally {
            if (owned) try {
                const next = await store.writeState(uid, {payload: JSON.stringify(state), lease: JSON.stringify({owner, until: 0})}, current.updateTime);
                if (!next) stats.conflicts++;
            } catch {stats.errors++;}
        }
    }
    return stats;
}
