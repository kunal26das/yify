import type {Movie} from '@/domain';

export function selectNewMovies(cachedIds: Set<number>, movies: Movie[]): Movie[] {
    return movies.filter((m) => !cachedIds.has(m.id));
}

export interface NewMoviesNotification {
    title: string;
    body: string;
    data: { movieId: number } | { count: number };
}

export function buildNotificationContent(newMovies: Movie[]): NewMoviesNotification {
    if (newMovies.length === 1) {
        const movie = newMovies[0];
        return {title: 'New movie added', body: movie.title, data: {movieId: movie.id}};
    }
    return {
        title: `${newMovies.length} new movies`,
        body: newMovies
            .slice(0, 3)
            .map((m) => m.title)
            .join(', '),
        data: {count: newMovies.length},
    };
}
