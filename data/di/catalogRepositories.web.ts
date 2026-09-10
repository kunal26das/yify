import type {AppConfig, AuthRepository, Dependencies, Diagnostics, PurchaseRepository} from '@/domain';
import {WebCatalogClient} from '../datasources/WebCatalogClient';
import {WebMovieRepositoryImpl} from '../repositories/WebMovieRepositoryImpl';
import {WebShowRepositoryImpl} from '../repositories/WebShowRepositoryImpl';
import {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';

export function createCatalogRepositories(
    _appConfig: AppConfig, diagnostics: Diagnostics,
    auth?: AuthRepository, purchases?: PurchaseRepository,
): Pick<Dependencies, 'movies' | 'shows'> {
    const access = auth && purchases ? new SubscriberCatalogAccess(auth, purchases) : undefined;
    const client = new WebCatalogClient(diagnostics, access);
    return {
        movies: new WebMovieRepositoryImpl(client),
        shows: new WebShowRepositoryImpl(client),
    };
}
