import type {AppConfig, AuthRepository, Dependencies, Diagnostics, PurchaseRepository} from '@/domain';
import {WebCatalogClient, webCatalogBaseUrl} from '../datasources/WebCatalogClient';
import {WebMovieRepositoryImpl} from '../repositories/WebMovieRepositoryImpl';
import {WebShowRepositoryImpl} from '../repositories/WebShowRepositoryImpl';
import {WebAnimeRepositoryImpl} from '../repositories/WebAnimeRepositoryImpl';
import {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';

export function createCatalogRepositories(
    _appConfig: AppConfig, diagnostics: Diagnostics,
    auth?: AuthRepository, purchases?: PurchaseRepository,
): Pick<Dependencies, 'movies' | 'shows' | 'anime' | 'subscriberAccess'> {
    const access = auth && purchases ? new SubscriberCatalogAccess(auth, purchases,
        () => `${webCatalogBaseUrl().replace('/api/catalog', '/api/subscriber-catalog')}/access?v=2`) : undefined;
    const client = new WebCatalogClient(diagnostics, access);
    return {
        movies: new WebMovieRepositoryImpl(client),
        shows: new WebShowRepositoryImpl(client),
        anime: new WebAnimeRepositoryImpl(client),
        subscriberAccess: access,
    };
}
