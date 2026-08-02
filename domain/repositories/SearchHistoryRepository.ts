export interface SearchHistoryRepository {
    getRecent(): string[];

    remember(term: string): string[];

    forget(term: string): string[];

    clear(): void;
}
