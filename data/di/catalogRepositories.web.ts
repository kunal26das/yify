import type {AppConfig, Dependencies, Diagnostics} from '@/domain';
import {WebCatalogClient} from '../datasources/WebCatalogClient';
import {WebMovieRepositoryImpl} from '../repositories/WebMovieRepositoryImpl';
import {WebShowRepositoryImpl} from '../repositories/WebShowRepositoryImpl';

export function createCatalogRepositories(
    _appConfig: AppConfig, diagnostics: Diagnostics,
): Pick<Dependencies, 'movies' | 'shows'> {
    const client = new WebCatalogClient(diagnostics);
    return {
        movies: new WebMovieRepositoryImpl(client),
        shows: new WebShowRepositoryImpl(client),
    };
}
