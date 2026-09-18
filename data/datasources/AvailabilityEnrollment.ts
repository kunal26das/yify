import {parseAvailabilityEnrollment, type AvailabilityDevice, type AvailabilityEnrollment,
    MAX_AVAILABILITY_DEVICES, MAX_AVAILABILITY_ENROLLMENT_CHARS} from '@/domain/availability/pilot';

const EMPTY: AvailabilityEnrollment = {version: 1, devices: []};
const FIELD = 'availabilityAlerts';

export interface AvailabilityEnrollmentStore {
    read(uid: string, token: string): Promise<AvailabilityEnrollment>;
    update(uid: string, token: string, deviceId: string, device: AvailabilityDevice | null, expected?: AvailabilityDevice): Promise<void>;
}

export class FirestoreAvailabilityEnrollment implements AvailabilityEnrollmentStore {
    constructor(private readonly fetcher: typeof fetch = fetch,
        private readonly project = process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'yify-2da67') {}

    private document(uid: string) {
        if (!/^[A-Za-z\d_-]{1,128}$/.test(uid)) throw new Error('Invalid account identifier.');
        return `projects/${this.project}/databases/(default)/documents/users/${uid}`;
    }

    private async request(url: string, token: string, init: RequestInit = {}) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10_000);
        try {
            const response = await this.fetcher(url, {...init, signal: controller.signal, redirect: 'error', credentials: 'omit',
                headers: {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'}});
            const body = await response.json().catch(() => null);
            return {ok: response.ok, status: response.status, body};
        } finally {clearTimeout(timer);}
    }

    private async snapshot(uid: string, token: string): Promise<{value: AvailabilityEnrollment; revision?: string}> {
        const response = await this.request(`https://firestore.googleapis.com/v1/${this.document(uid)}?mask.fieldPaths=${FIELD}`, token);
        if (response.status === 404) return {value: EMPTY};
        if (!response.ok) throw new Error('Unable to load availability alerts.');
        const body = response.body;
        if (typeof body?.updateTime !== 'string' || !body.updateTime) throw new Error('Unable to load availability alerts.');
        const raw = body.fields?.[FIELD]?.stringValue;
        const value = raw == null ? EMPTY : parseAvailabilityEnrollment(raw);
        if (!value) throw new Error('Availability alert settings could not be read.');
        return {value, revision: body.updateTime};
    }

    async read(uid: string, token: string) { return (await this.snapshot(uid, token)).value; }

    async update(uid: string, token: string, deviceId: string, device: AvailabilityDevice | null, expected?: AvailabilityDevice): Promise<void> {
        for (let attempt = 0; attempt < 3; attempt++) {
            const snapshot = await this.snapshot(uid, token);
            const previous = snapshot.value.devices.find(value => value.id === deviceId);
            // Metadata refresh must never recreate an enrollment removed by sign-out/opt-out.
            if (expected && (!previous || JSON.stringify(previous) !== JSON.stringify(expected))) return;
            if (!device && !previous) return;
            if (device && device.id !== deviceId) throw new Error('Invalid availability alert device.');
            const devices = snapshot.value.devices.filter(value => value.id !== deviceId);
            if (device) devices.push(device);
            if (devices.length > MAX_AVAILABILITY_DEVICES) throw new Error('Alerts are already enabled on five devices.');
            const serialized = JSON.stringify({version: 1, devices});
            if (serialized.length > MAX_AVAILABILITY_ENROLLMENT_CHARS || !parseAvailabilityEnrollment(serialized)) {
                throw new Error('Invalid availability alert settings.');
            }
            const body = {writes: [{
                update: {name: this.document(uid), fields: {[FIELD]: {stringValue: serialized}}},
                updateMask: {fieldPaths: [FIELD]},
                currentDocument: snapshot.revision ? {updateTime: snapshot.revision} : {exists: false},
            }]};
            const response = await this.request(`https://firestore.googleapis.com/v1/projects/${this.project}/databases/(default)/documents:commit`, token,
                {method: 'POST', body: JSON.stringify(body)});
            if (response.ok) return;
            if (![409, 412].includes(response.status)) {
                const error = response.body;
                if (!['ABORTED', 'FAILED_PRECONDITION', 'ALREADY_EXISTS'].includes(error?.error?.status)) {
                    throw new Error('Unable to save availability alerts. Please try again.');
                }
            }
        }
        throw new Error('Your alert settings changed on another device. Please try again.');
    }
}
