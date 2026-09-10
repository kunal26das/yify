import type {AppConfig, Dependencies, Diagnostics} from '@/domain';
import {YtsApiDataSource} from '../datasources/YtsApiDataSource';
import {EztvApiDataSource} from '../datasources/EztvApiDataSource';
import {MovieRepositoryImpl} from '../repositories/MovieRepositoryImpl';
import {ShowRepositoryImpl} from '../repositories/ShowRepositoryImpl';

export function createCatalogRepositories(
    appConfig: AppConfig, diagnostics: Diagnostics,
): Pick<Dependencies, 'movies' | 'shows'> {
    return {
        movies: new MovieRepositoryImpl(new YtsApiDataSource(() => appConfig.getApiBaseUrl(), diagnostics)),
        shows: new ShowRepositoryImpl(new EztvApiDataSource(undefined, diagnostics)),
    };
}
