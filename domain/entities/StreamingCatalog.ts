import type {StreamingCountry} from './StreamingCountry';

export interface StreamingCatalog {
    status: 'ready' | 'unavailable';
    countries: StreamingCountry[];
}
