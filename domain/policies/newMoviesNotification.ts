import type {Movie} from '../entities/Movie';

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

export const NOTIFICATION_BURST_LIMIT = 5;

export interface NewMoviesFilter {
    minimumRating: number;
    genre: string;
}

export function filterNotifiableMovies(movies: Movie[], filter: NewMoviesFilter): Movie[] {
    const genre = filter.genre.trim().toLowerCase();
    return movies.filter((movie) => {
        if (filter.minimumRating > 0 && movie.rating < filter.minimumRating) return false;
        if (!genre) return true;
        return movie.genres.some((value) => value.trim().toLowerCase() === genre);
    });
}

export function isWithinQuietHours(now: Date, startHour: number, endHour: number): boolean {
    if (startHour === endHour) return false;
    const hour = now.getHours();
    if (startHour < endHour) return hour >= startHour && hour < endHour;
    return hour >= startHour || hour < endHour;
}

export function quietHoursEndAt(now: Date, startHour: number, endHour: number): Date | null {
    if (!isWithinQuietHours(now, startHour, endHour)) return null;
    const end = new Date(now.getTime());
    end.setMinutes(0, 0, 0);
    if (now.getHours() >= endHour) end.setDate(end.getDate() + 1);
    end.setHours(endHour);
    return end;
}

export function buildNotificationBatch(
    newMovies: Movie[],
    perTitle: boolean,
    limit: number
): NewMoviesNotification[] {
    if (!perTitle || newMovies.length > limit) return [buildNotificationContent(newMovies)];
    return newMovies.map((movie) => buildNotificationContent([movie]));
}

export function notificationQuerySignature(quality: string): string {
    return `q:${quality || 'all'}`;
}
