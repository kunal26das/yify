import type {Movie} from '@/domain';
import type {ShelfState, ShelfStatus} from './useHomeViewModel';

export const MIN_SHELF_MOVIES = 5;
const MAX_SHELF_PAGES = 5;

interface SelectedShelf {
    source: ShelfState;
    visible: ShelfState;
}

export function createHomeShelfSelector() {
    let previous = new Map<string, SelectedShelf>();

    return (shelves: readonly ShelfState[], heroMovies: readonly Movie[]) => {
        const seen = new Set<number>(heroMovies.map((movie) => movie.id));
        const needsMore: {key: string; next: number}[] = [];
        const selected = new Map<string, SelectedShelf>();
        let aboveSettled = true;

        const visibleShelves = shelves.map((shelf) => {
            const visible: Movie[] = [];
            for (const movie of shelf.movies) {
                if (visible.length >= shelf.limit) break;
                if (!seen.has(movie.id)) visible.push(movie);
            }
            for (const movie of visible) seen.add(movie.id);

            const exhausted = !shelf.hasMore || shelf.page >= MAX_SHELF_PAGES;
            const thin = shelf.status === 'loaded' && visible.length < MIN_SHELF_MOVIES && !exhausted;
            const own: ShelfStatus = shelf.status === 'loaded' && thin ? 'loading' : shelf.status;
            if (thin && shelf.page > 0) needsMore.push({key: shelf.key, next: shelf.page + 1});

            const status = aboveSettled ? own : 'loading';
            aboveSettled = aboveSettled && (own === 'loaded' || own === 'empty' || own === 'error');
            const old = previous.get(shelf.key);
            const unchanged = old?.source === shelf && old.visible.status === status &&
                old.visible.movies.length === visible.length && old.visible.movies.every((movie, index) => movie === visible[index]);
            const result = unchanged ? old.visible : {
                ...shelf,
                movies: visible,
                status,
                needsRequest: shelf.status === 'idle',
            };
            selected.set(shelf.key, {source: shelf, visible: result});
            return result;
        });

        previous = selected;
        return {shelves: visibleShelves, needsMore};
    };
}
