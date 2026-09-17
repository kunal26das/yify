import type {CountryLocationResult} from '../entities/CountryLocationResult';

export interface CountryLocation {
    requestCountry(signal?: AbortSignal): Promise<CountryLocationResult>;
}
