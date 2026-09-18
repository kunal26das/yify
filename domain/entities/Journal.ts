export interface JournalMovie {
    id: number;
    title: string;
    year: number;
    runtimeMinutes: number;
    genres: string[];
    posterUrl: string | null;
}

export interface JournalEntry {
    id: string;
    movie: JournalMovie;
    watchedOn: string;
    /** Half-star units: 1–10 represents 0.5–5 stars. Null means unrated. */
    rating: number | null;
    note: string;
    updatedAt: number;
    deletedAt: number;
}

export interface JournalData {
    entries: Record<string, JournalEntry>;
    clearedAt: number;
}

export interface JournalSnapshot {
    ready: boolean;
    entries: JournalEntry[];
    syncing: boolean;
    error: string | null;
}

export interface JournalInput {
    id?: string;
    movie: JournalMovie;
    watchedOn: string;
    rating: number | null;
    note: string;
}
