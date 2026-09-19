import type {AppConfig, AuthRepository, Dependencies, Diagnostics, PurchaseRepository} from '@/domain';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {EztvApiDataSource} from '../datasources/EztvApiDataSource';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../repositories/ShowRepositoryImpl';
import {CANONICAL_CATALOG_BASE_URL, WebCatalogClient} from '../datasources/WebCatalogClient';
import {WebAnimeRepositoryImpl} from '../repositories/WebAnimeRepositoryImpl';
import {SubscriberCatalogAccess} from '../services/SubscriberCatalogAccess';

export function createCatalogRepositories(
    appConfig: AppConfig, diagnostics: Diagnostics,
    auth?: AuthRepository, purchases?: PurchaseRepository,
): Pick<Dependencies, 'movies' | 'shows' | 'anime'> {
    const access = auth && purchases ? new SubscriberCatalogAccess(auth, purchases) : undefined;
    const animeClient = new WebCatalogClient(diagnostics, access, CANONICAL_CATALOG_BASE_URL);
    return {
        movies: new MovieRepositoryImpl(new YtsApiDataSource(() => appConfig.getApiBaseUrl(), diagnostics)),
        shows: new ShowRepositoryImpl(new EztvApiDataSource(undefined, diagnostics)),
        anime: new WebAnimeRepositoryImpl(animeClient),
    };
}
