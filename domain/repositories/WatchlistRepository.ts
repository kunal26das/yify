import type {Movie} from '../entities/Movie';

export interface WatchlistRepository {
    getAll(): Movie[];

    contains(id: number): boolean;

    add(movie: Movie): void;

    remove(id: number): void;

    toggle(movie: Movie): boolean;

    clear(): void;

    applyRemote(items: Movie[]): void;

    subscribe(listener: () => void): () => void;
}
