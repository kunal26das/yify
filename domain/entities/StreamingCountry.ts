import type {StreamingService} from './StreamingService';

export interface StreamingCountry {
    code: string;
    name: string;
    services: StreamingService[];
}
