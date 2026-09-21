import type {AppConfig, AuthRepository, Dependencies, Diagnostics, NetworkMonitor, PurchaseRepository} from '@/domain';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {EztvApiDataSource} from '../datasources/EztvApiDataSource';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../repositories/ShowRepositoryImpl';
import {CANONICAL_CATALOG_BASE_URL, WebCatalogClient} from '../datasources/WebCatalogClient';
import {WebAnimeRepositoryImpl} from '../repositories/WebAnimeRepositoryImpl';
import {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';

export function createCatalogRepositories(
    appConfig: AppConfig, diagnostics: Diagnostics,
    auth?: AuthRepository, purchases?: PurchaseRepository, network?: NetworkMonitor,
): Pick<Dependencies, 'movies' | 'shows' | 'anime' | 'subscriberAccess'> {
    const access = auth && purchases ? new SubscriberCatalogAccess(auth, purchases,
        () => `${CANONICAL_CATALOG_BASE_URL.replace('/api/catalog', '/api/subscriber-catalog')}/access?v=2`) : undefined;
    const animeClient = new WebCatalogClient(diagnostics, access, CANONICAL_CATALOG_BASE_URL, network);
    return {
        movies: new MovieRepositoryImpl(new YtsApiDataSource(() => appConfig.getApiBaseUrl(), diagnostics, {network})),
        shows: new ShowRepositoryImpl(new EztvApiDataSource(undefined, diagnostics, undefined, network)),
        anime: new WebAnimeRepositoryImpl(animeClient),
        subscriberAccess: access,
    };
}
