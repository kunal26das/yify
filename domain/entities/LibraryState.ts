export interface LibraryMark {
    at: number;
    value: boolean;
}

export interface LibraryCollection {
    name: string;
    updatedAt: number;
    removedAt: number;
}

export interface LibraryState {
    watched: Record<string, LibraryMark>;
    collections: Record<string, LibraryCollection>;
    memberships: Record<string, Record<string, LibraryMark>>;
    clearedAt: number;
}
