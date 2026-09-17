import type {StreamingAvailability, StreamingCatalog} from '../entities/Streaming';
import type {TitleMedia} from './TmdbRepository';

export interface StreamingRepository {
    getCatalog(country: string): Promise<StreamingCatalog>;
    getAvailability(imdbId: string, country: string, media?: TitleMedia): Promise<StreamingAvailability>;
    getCachedAvailability(imdbId: string, country: string): StreamingAvailability | null;
}
