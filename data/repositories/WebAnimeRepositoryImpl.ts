import type {AnimeRepository, ListAnimeParams, ListAnimeResult} from '@/domain';
import {WebCatalogClient} from '../datasources/WebCatalogClient';

/** All platforms use the server's projected metadata for anime uploads. */
export class WebAnimeRepositoryImpl implements AnimeRepository {
    constructor(private readonly client: WebCatalogClient = new WebCatalogClient()) {}

    listAnime(params: ListAnimeParams, signal?: AbortSignal): Promise<ListAnimeResult> {
        return this.client.listAnime(params, signal);
    }
}
