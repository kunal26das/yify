import type {StreamingAvailability, StreamingCatalog} from '../entities/Streaming';

export interface StreamingRepository {
    getCatalog(): Promise<StreamingCatalog>;
    getAvailability(imdbId: string, country: string): Promise<StreamingAvailability>;
    getCachedAvailability(imdbId: string, country: string): StreamingAvailability | null;
}
