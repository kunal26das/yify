import type {LibraryState} from '../entities/LibraryState';
import type {Movie} from '../entities/Movie';
import {libraryCollectionContains, libraryMovieWatched} from './libraryMerge';

export type WatchlistStatus = 'all' | 'to-watch' | 'watched';
export type WatchlistSort = 'saved' | 'title' | 'rating' | 'year';

export interface WatchlistViewOptions {
    query?: string;
    status?: WatchlistStatus;
    sort?: WatchlistSort;
    genre?: string;
    maxRuntimeMinutes?: number;
    collectionId?: string;
}

function searchable(value: string): string {
    return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

export function selectWatchlistMovies(
    movies: readonly Movie[],
    library: LibraryState,
    options: WatchlistViewOptions = {}
): Movie[] {
    const query = searchable(options.query ?? '');
    const genre = searchable(options.genre ?? '');
    const selected = movies.filter((movie) => {
        if (query && !searchable(movie.title).includes(query)) return false;
        const watched = libraryMovieWatched(library, movie.id);
        if (options.status === 'watched' && !watched) return false;
        if (options.status === 'to-watch' && watched) return false;
        if (genre && !movie.genres.some((value) => searchable(value) === genre)) return false;
        if (options.maxRuntimeMinutes && (!(movie.runtimeMinutes > 0) || movie.runtimeMinutes > options.maxRuntimeMinutes)) return false;
        if (options.collectionId && !libraryCollectionContains(library, options.collectionId, movie.id)) return false;
        return true;
    });
    if (options.sort === 'title') selected.sort((a, b) => a.title.localeCompare(b.title));
    if (options.sort === 'rating') selected.sort((a, b) => b.rating - a.rating);
    if (options.sort === 'year') selected.sort((a, b) => b.year - a.year);
    return selected;
}

export function pickWatchlistMovie(
    movies: readonly Movie[],
    library: LibraryState,
    options: WatchlistViewOptions = {},
    random: () => number = Math.random
): Movie | undefined {
    const candidates = selectWatchlistMovies(movies, library, options)
        .filter((movie) => !libraryMovieWatched(library, movie.id));
    if (candidates.length === 0) return undefined;
    const value = random();
    const fraction = Number.isFinite(value) ? Math.max(0, Math.min(value, 1)) : 0;
    return candidates[Math.min(candidates.length - 1, Math.floor(fraction * candidates.length))];
}
