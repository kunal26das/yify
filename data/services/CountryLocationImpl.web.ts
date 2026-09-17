import type {CountryLocation, CountryLocationResult} from '@/domain';
import {CountryLocationRequest, locationCountry, validLocationCoordinates} from './countryLocationRequest';

type PositionResult =
    | {status: 'position'; latitude: number; longitude: number}
    | {status: 'denied' | 'unavailable' | 'timeout'};

export class CountryLocationImpl implements CountryLocation {
    private readonly requests = new CountryLocationRequest((signal) => this.locate(signal));

    requestCountry(signal?: AbortSignal): Promise<CountryLocationResult> {
        return this.requests.request(signal);
    }

    private async locate(signal: AbortSignal): Promise<CountryLocationResult> {
        const position = await this.position(signal);
        if (signal.aborted) return {status: 'unavailable'};
        if (position.status !== 'position') return position;
        return this.country(position.latitude, position.longitude, signal);
    }

    private position(signal: AbortSignal): Promise<PositionResult> {
        const geolocation = globalThis.navigator?.geolocation;
        if (!geolocation || signal.aborted) return Promise.resolve({status: 'unavailable'});
        return new Promise((resolve) => {
            let finished = false;
            const finish = (result: PositionResult) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                signal.removeEventListener('abort', cancel);
                resolve(result);
            };
            const cancel = () => finish({status: 'unavailable'});
            const timer = setTimeout(() => finish({status: 'timeout'}), 15_000);
            signal.addEventListener('abort', cancel, {once: true});
            try {
                geolocation.getCurrentPosition(
                    (position) => {
                        const latitude = position?.coords?.latitude;
                        const longitude = position?.coords?.longitude;
                        finish(validLocationCoordinates(latitude, longitude)
                            ? {status: 'position', latitude, longitude}
                            : {status: 'unavailable'});
                    },
                    (error) => finish({status: error?.code === 1 ? 'denied'
                        : error?.code === 3 ? 'timeout' : 'unavailable'}),
                    {enableHighAccuracy: false, maximumAge: 0, timeout: 15_000},
                );
            } catch {
                finish({status: 'unavailable'});
            }
        });
    }

    private country(latitude: number, longitude: number, signal: AbortSignal): Promise<CountryLocationResult> {
        if (signal.aborted) return Promise.resolve({status: 'unavailable'});
        return new Promise((resolve) => {
            const controller = new AbortController();
            let finished = false;
            const finish = (result: CountryLocationResult) => {
                if (finished) return;
                finished = true;
                clearTimeout(timer);
                signal.removeEventListener('abort', cancel);
                resolve(result);
            };
            const cancel = () => {
                controller.abort();
                finish({status: 'unavailable'});
            };
            const timer = setTimeout(() => {
                controller.abort();
                finish({status: 'timeout'});
            }, 10_000);
            signal.addEventListener('abort', cancel, {once: true});
            const url = new URL('https://api.bigdatacloud.net/data/reverse-geocode-client');
            url.searchParams.set('latitude', latitude.toFixed(2));
            url.searchParams.set('longitude', longitude.toFixed(2));
            url.searchParams.set('localityLanguage', 'en');
            void Promise.resolve().then(() => {
                if (finished) return undefined;
                return fetch(url.toString(), {
                    signal: controller.signal,
                    credentials: 'omit',
                    cache: 'no-store',
                    referrerPolicy: 'no-referrer',
                    headers: {Accept: 'application/json'},
                });
            }).then(async (response) => {
                if (finished || !response) return;
                if (!response.ok) {
                    finish({status: 'unavailable'});
                    return;
                }
                const body: unknown = await response.json();
                const country = body && typeof body === 'object' && !Array.isArray(body)
                    ? locationCountry((body as Record<string, unknown>).countryCode)
                    : undefined;
                finish(country ? {status: 'ready', country} : {status: 'unavailable'});
            }).catch(() => finish({status: 'unavailable'}));
        });
    }
}
