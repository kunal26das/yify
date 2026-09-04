import type {HistoryEntry, HistoryKind} from '../entities/HistoryEntry';
import type {Movie} from '../entities/Movie';
import type {Show} from '../entities/Show';

const MOVIE_PREFIX = 'movie:';
const SHOW_PREFIX = 'show:';

const DAY_MS = 24 * 60 * 60 * 1000;

const WEEKDAYS = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

const MONTHS = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
];

export interface HistoryGroup {
    label: string;
    entries: HistoryEntry[];
}

export interface HistoryFilter {
    query?: string;
    kind?: HistoryKind | 'all';
}

export function movieHistoryKey(id: number): string {
    return `${MOVIE_PREFIX}${id}`;
}

export function showHistoryKey(imdbId: string): string {
    return `${SHOW_PREFIX}${imdbId}`;
}

export function historyKind(key: string): HistoryKind {
    return key.startsWith(SHOW_PREFIX) ? 'show' : 'movie';
}

export function historyHref(key: string): string {
    if (key.startsWith(SHOW_PREFIX)) return `/show/${key.slice(SHOW_PREFIX.length)}`;
    return `/movie/${key.slice(MOVIE_PREFIX.length)}`;
}

function movieImage(movie: Movie): string | undefined {
    const posters = movie.posterUrls ?? [];
    return [
        ...(movie.thumbnailUrls ?? []),
        movie.backgroundImageUrl,
        posters[posters.length - 1],
    ].find((url): url is string => !!url);
}

export function movieHistoryEntry(movie: Movie, watchedAt: number): HistoryEntry {
    const entry: HistoryEntry = {
        key: movieHistoryKey(movie.id),
        title: movie.title,
        watchedAt,
    };
    const image = movieImage(movie);
    if (image) entry.imageUrl = image;
    if (movie.year) entry.year = movie.year;
    if (movie.rating > 0) entry.rating = movie.rating;
    if (movie.runtimeMinutes > 0) entry.runtimeMinutes = movie.runtimeMinutes;
    return entry;
}

export function showHistoryEntry(show: Show, watchedAt: number): HistoryEntry {
    const entry: HistoryEntry = {
        key: showHistoryKey(show.imdbId),
        title: show.title,
        watchedAt,
    };
    if (show.thumbnailUrl) entry.imageUrl = show.thumbnailUrl;
    return entry;
}

function startOfDay(ms: number): number {
    const date = new Date(ms);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
}

export function historyGroupLabel(watchedAt: number, now: number): string {
    const today = startOfDay(now);
    const day = startOfDay(watchedAt);
    const daysApart = Math.round((today - day) / DAY_MS);
    if (!(daysApart > 0)) return 'Today';
    const date = new Date(day);
    if (daysApart < 7) return WEEKDAYS[date.getDay()];
    const label = `${MONTHS[date.getMonth()]} ${date.getDate()}`;
    if (date.getFullYear() === new Date(today).getFullYear()) return label;
    return `${label}, ${date.getFullYear()}`;
}

export function groupHistory(entries: HistoryEntry[], now: number): HistoryGroup[] {
    const groups: HistoryGroup[] = [];
    entries.forEach((entry) => {
        const label = historyGroupLabel(entry.watchedAt, now);
        const last = groups[groups.length - 1];
        if (last && last.label === label) {
            last.entries.push(entry);
            return;
        }
        groups.push({label, entries: [entry]});
    });
    return groups;
}

export function filterHistory(entries: HistoryEntry[], filter: HistoryFilter): HistoryEntry[] {
    const kind = filter.kind && filter.kind !== 'all' ? filter.kind : null;
    const query = (filter.query ?? '').trim().toLowerCase();
    if (!kind && !query) return entries;
    return entries.filter((entry) => {
        if (kind && historyKind(entry.key) !== kind) return false;
        if (query && !entry.title.toLowerCase().includes(query)) return false;
        return true;
    });
}
