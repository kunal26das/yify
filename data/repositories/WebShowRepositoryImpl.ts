import type {ListShowsParams, ListShowsResult, ShowEpisode, ShowRepository} from '@/domain';
import {WebCatalogClient} from '../datasources/WebCatalogClient';

export class WebShowRepositoryImpl implements ShowRepository {
    constructor(private readonly client: WebCatalogClient = new WebCatalogClient()) {}

    listShows(params: ListShowsParams): Promise<ListShowsResult> {
        return this.client.listShows(params);
    }

    listEpisodes(imdbId: string): Promise<ShowEpisode[]> {
        return this.client.listEpisodes(imdbId);
    }
}
