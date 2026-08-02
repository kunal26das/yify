export interface SeenMoviesRepository {
    getSeenIds(): Set<number>;

    setSeenIds(ids: Iterable<number>): void;

    getLastRunDate(): string | undefined;

    setLastRunDate(date: string): void;
}
