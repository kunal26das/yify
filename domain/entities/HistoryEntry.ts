export type HistoryKind = 'movie' | 'show';

export interface HistoryEntry {
    key: string;
    title: string;
    watchedAt: number;
    imageUrl?: string;
    year?: number;
    rating?: number;
    runtimeMinutes?: number;
}
