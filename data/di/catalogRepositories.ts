import type {AppConfig, AuthRepository, Dependencies, Diagnostics, NetworkMonitor, PurchaseRepository} from '@/domain';
import {CANONICAL_CATALOG_BASE_URL, WebCatalogClient} from '../datasources/WebCatalogClient';
import {WebMovieRepositoryImpl} from '../repositories/WebMovieRepositoryImpl';
import {WebShowRepositoryImpl} from '../repositories/WebShowRepositoryImpl';
import {WebAnimeRepositoryImpl} from '../repositories/WebAnimeRepositoryImpl';
import {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';

export function createCatalogRepositories(
    _appConfig: AppConfig, diagnostics: Diagnostics,
    auth?: AuthRepository, purchases?: PurchaseRepository, network?: NetworkMonitor,
): Pick<Dependencies, 'movies' | 'shows' | 'anime' | 'subscriberAccess'> {
    const subscriberBaseUrl = CANONICAL_CATALOG_BASE_URL.replace('/api/catalog', '/api/native-subscriber-catalog');
    const access = auth && purchases ? new SubscriberCatalogAccess(auth, purchases,
        () => `${subscriberBaseUrl}/access?v=2`) : undefined;
    const publicClient = new WebCatalogClient(diagnostics, undefined, CANONICAL_CATALOG_BASE_URL, network);
    const animeClient = new WebCatalogClient(diagnostics, access, CANONICAL_CATALOG_BASE_URL, network, subscriberBaseUrl);
    return {
        movies: new WebMovieRepositoryImpl(publicClient),
        shows: new WebShowRepositoryImpl(publicClient),
        anime: new WebAnimeRepositoryImpl(animeClient),
        subscriberAccess: access,
    };
}
