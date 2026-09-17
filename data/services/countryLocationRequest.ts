import type {CountryLocationResult} from '@/domain';

type Flight = {
    controller: AbortController;
    listeners: Set<(result: CountryLocationResult) => void>;
    timer?: ReturnType<typeof setTimeout>;
    finished: boolean;
};

export function locationCountry(value: unknown): string | undefined {
    if (typeof value !== 'string' || !/^[a-z]{2}$/i.test(value)) return undefined;
    return value.toUpperCase();
}

export function validLocationCoordinates(latitude: unknown, longitude: unknown): boolean {
    return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90
        && typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export class CountryLocationRequest {
    private flight?: Flight;

    constructor(private readonly locate: (signal: AbortSignal) => Promise<CountryLocationResult>) {}

    request(signal?: AbortSignal): Promise<CountryLocationResult> {
        if (signal?.aborted) return Promise.resolve({status: 'unavailable'});
        const flight = this.flight ?? this.start();
        return new Promise((resolve) => {
            const finish = (result: CountryLocationResult) => {
                signal?.removeEventListener('abort', cancel);
                flight.listeners.delete(finish);
                resolve(result);
            };
            const cancel = () => {
                finish({status: 'unavailable'});
                if (flight.listeners.size === 0) this.finish(flight, {status: 'unavailable'}, true);
            };
            flight.listeners.add(finish);
            signal?.addEventListener('abort', cancel, {once: true});
        });
    }

    private start(): Flight {
        const flight: Flight = {
            controller: new AbortController(),
            listeners: new Set(),
            finished: false,
        };
        this.flight = flight;
        flight.timer = setTimeout(() => this.finish(flight, {status: 'timeout'}, true), 30_000);
        void Promise.resolve()
            .then(() => flight.finished ? undefined : this.locate(flight.controller.signal))
            .then((result) => {
                if (result) this.finish(flight, result);
            })
            .catch(() => this.finish(flight, {status: 'unavailable'}));
        return flight;
    }

    private finish(flight: Flight, result: CountryLocationResult, abort = false): void {
        if (flight.finished) return;
        flight.finished = true;
        clearTimeout(flight.timer);
        if (this.flight === flight) this.flight = undefined;
        if (abort) flight.controller.abort();
        for (const listener of [...flight.listeners]) listener(result);
    }
}
