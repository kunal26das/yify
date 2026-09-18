import type {AuthRepository, KeyValueStore, PreferencesRepository} from '@/domain';
import {INITIAL_AVAILABILITY_ALERT_STATE, type AvailabilityAlerts, type AvailabilityAlertState,
    type AvailabilityPush} from '@/domain/services/AvailabilityAlerts';
import type {AvailabilityEnrollmentStore} from '../datasources/AvailabilityEnrollment';

interface Options {
    configured: boolean;
    auth: AuthRepository;
    preferences: PreferencesRepository;
    push: AvailabilityPush;
    enrollment: AvailabilityEnrollmentStore;
    store: KeyValueStore;
    access: (token: string) => Promise<boolean>;
    now?: () => number;
    timeZone?: () => string;
    onRefresh?: (listener: () => void) => void;
}

// Consent and the transport belong to this installation, never to synced preferences.
export class AvailabilityAlertsImpl implements AvailabilityAlerts {
    private state: AvailabilityAlertState = INITIAL_AVAILABILITY_ALERT_STATE;
    private readonly listeners = new Set<() => void>();
    private started = false;
    private revision = 0;
    private uid: string | null = null;
    private bearer: {uid: string; token: string} | null = null;
    private cleanup: Promise<void> = Promise.resolve();
    private busy = false;

    constructor(private readonly options: Options) {}

    getState() { return this.state; }
    subscribe(listener: () => void) { this.listeners.add(listener); return () => {this.listeners.delete(listener);}; }
    private set(patch: Partial<AvailabilityAlertState>) {
        this.state = {...this.state, ...patch};
        this.listeners.forEach(listener => listener());
    }
    private deviceId() {
        let id = this.options.store.getString('device');
        if (!id || !/^[a-zA-Z0-9-]{16,80}$/.test(id)) {
            id = `device-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
            this.options.store.set('device', id);
        }
        return id;
    }
    private owner() { return this.options.store.getString('owner') || null; }
    private country() { return this.options.preferences.getPreferences().watchRegion ?? this.options.store.getString('country') ?? 'US'; }
    private current(uid: string, revision: number) {
        return this.revision === revision && this.options.auth.getSession().account?.uid === uid;
    }

    start(): void {
        if (this.started) return;
        this.started = true;
        const changed = () => {
            const session = this.options.auth.getSession();
            if (!session.ready) return;
            const uid = session.account?.uid ?? null;
            if (this.uid === uid && this.state.ready) return;
            const previous = this.bearer;
            this.uid = uid;
            this.bearer = null;
            this.revision++;
            this.set({...INITIAL_AVAILABILITY_ALERT_STATE, ready: true});
            if (this.owner() && this.owner() !== uid) {
                this.cleanup = this.cleanup.catch(() => {}).then(async () => {
                    // Revoke transport even if an expired credential/network prevents remote cleanup.
                    await this.options.push.unregister();
                    if (previous && previous.uid === this.owner()) {
                        await this.options.enrollment.update(previous.uid, previous.token, this.deviceId(), null);
                        this.options.store.set('owner', '');
                    }
                }).catch(() => {});
            }
            if (uid) void this.refresh(this.country());
        };
        this.options.auth.subscribe(changed);
        this.options.preferences.subscribe(() => {
            if (!this.options.preferences.areNotificationsEnabled() &&
                (this.state.enabled || this.owner() === this.options.auth.getSession().account?.uid)) void this.disable();
        });
        if (this.options.configured) this.options.onRefresh?.(() => {void this.refresh(this.country());});
        changed();
    }

    async refresh(country: string): Promise<void> {
        if (!this.options.configured || this.busy) {this.set({ready: true}); return;}
        const uid = this.options.auth.getSession().account?.uid;
        if (!uid || !/^[A-Z]{2}$/.test(country)) {this.set({ready: true, available: false, enabled: false}); return;}
        const revision = ++this.revision;
        try {
            await this.cleanup;
            if (!this.current(uid, revision)) return;
            const token = await this.options.auth.getIdToken();
            if (!token || !this.current(uid, revision)) return;
            this.bearer = {uid, token};
            // A failed logout cleanup must finish on the original account before another
            // account can reuse the same installation's remote-push identity.
            if (this.owner() && this.owner() !== uid) {
                this.set({ready: true, available: false, enabled: false,
                    error: 'Sign in to your previous account to finish turning off its alerts.'});
                return;
            }
            if (this.owner() === uid && !this.options.preferences.areNotificationsEnabled()) {
                await this.disable();
                return;
            }
            if (this.owner() === uid && this.options.store.getString('consent') === 'false') {
                await this.options.push.unregister();
                await this.options.enrollment.update(uid, token, this.deviceId(), null);
                if (!this.current(uid, revision)) return;
                this.options.store.set('owner', '');
            }
            const [available, supported] = await Promise.all([this.options.access(token), this.options.push.supported()]);
            if (!this.current(uid, revision)) return;
            if (!available || !supported) {
                // Keep existing consent visible and removable even after paid access ends.
                this.set({ready: true, available: false,
                    enabled: this.owner() === uid && this.options.store.getString('consent') === 'true', error: null});
                return;
            }
            const enrollment = await this.options.enrollment.read(uid, token);
            if (!this.current(uid, revision)) return;
            const device = enrollment.devices.find(value => value.id === this.deviceId());
            const enabled = !!device;
            const timeZone = this.options.timeZone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
            if (device && (device.country !== country || device.timeZone !== timeZone)) {
                await this.options.enrollment.update(uid, token, device.id, {
                    ...device, country, timeZone, updatedAt: this.options.now?.() ?? Date.now(),
                }, device);
                if (!this.current(uid, revision)) return;
            }
            if (enabled) this.options.store.set('owner', uid);
            this.options.store.set('country', country);
            this.set({ready: true, available: true, enabled, error: null});
            if (enabled && !this.options.preferences.areNotificationsEnabled()) await this.disable();
        } catch {
            if (this.current(uid, revision)) this.set({ready: true, available: false,
                enabled: this.owner() === uid && this.options.store.getString('consent') === 'true',
                error: 'Availability alerts could not be checked. Please try again.'});
        }
    }

    async enable(country: string): Promise<boolean> {
        const uid = this.options.auth.getSession().account?.uid;
        const preferences = this.options.preferences.getPreferences();
        if (!this.options.configured || !this.state.available || this.busy || !uid ||
            !preferences.notifications || !/^[A-Z]{2}$/.test(country) ||
            !(preferences.streamingServices[country]?.length) || (this.owner() && this.owner() !== uid)) return false;
        this.busy = true;
        const revision = ++this.revision;
        this.set({pending: true, error: null});
        let registered = false;
        let attemptedWrite = false;
        let token: string | null = null;
        try {
            // Called directly from the switch gesture, before any network await (Web Push).
            const push = await this.options.push.register();
            registered = true;
            if (!this.current(uid, revision)) throw new Error('Session changed');
            token = await this.options.auth.getIdToken();
            if (!token || !this.current(uid, revision) || !await this.options.access(token)) throw new Error('Access changed');
            if (!this.current(uid, revision) || !this.options.preferences.areNotificationsEnabled()) throw new Error('Consent changed');
            this.bearer = {uid, token};
            this.options.store.set('owner', uid);
            this.options.store.set('consent', 'false');
            attemptedWrite = true;
            await this.options.enrollment.update(uid, token, this.deviceId(), {
                id: this.deviceId(), ...push, country,
                timeZone: this.options.timeZone?.() ?? Intl.DateTimeFormat().resolvedOptions().timeZone,
                updatedAt: this.options.now?.() ?? Date.now(),
            });
            if (!this.current(uid, revision) || !this.options.preferences.areNotificationsEnabled()) throw new Error('Consent changed');
            this.options.store.set('consent', 'true');
            this.options.store.set('country', country);
            this.set({enabled: true, error: null});
            return true;
        } catch {
            if (registered) {
                try {await this.options.push.unregister();} catch {}
            }
            if (attemptedWrite && token) {
                try {
                    await this.options.enrollment.update(uid, token, this.deviceId(), null);
                    this.options.store.set('owner', '');
                } catch {}
            }
            if (this.current(uid, revision)) this.set({enabled: false,
                error: 'Alerts could not be enabled. Check notification permission and try again.'});
            return false;
        } finally {
            this.busy = false;
            if (this.current(uid, revision)) this.set({pending: false});
            else if (this.options.auth.getSession().account) void this.refresh(this.country());
        }
    }

    async disable(): Promise<boolean> {
        if (this.busy) return false;
        const uid = this.options.auth.getSession().account?.uid;
        if (!uid) return false;
        this.busy = true;
        const revision = ++this.revision;
        this.set({pending: true, error: null});
        this.options.store.set('consent', 'false');
        let transportStopped = false;
        let remoteStopped = false;
        try {
            try {await this.options.push.unregister(); transportStopped = true;} catch {}
            const token = await this.options.auth.getIdToken();
            if (!token || !this.current(uid, revision)) throw new Error('Session changed');
            await this.options.enrollment.update(uid, token, this.deviceId(), null);
            remoteStopped = true;
            this.options.store.set('owner', '');
            if (this.current(uid, revision)) this.set({enabled: false});
            return true;
        } catch {
            if (this.current(uid, revision)) this.set({enabled: !(transportStopped || remoteStopped), error: transportStopped
                ? 'Alerts are off on this device. Account cleanup will retry when you reconnect.'
                : 'Alerts could not be turned off. Please try again.'});
            return transportStopped || remoteStopped;
        } finally {
            this.busy = false;
            if (this.current(uid, revision)) this.set({pending: false});
            else if (this.options.auth.getSession().account) void this.refresh(this.country());
        }
    }
}
