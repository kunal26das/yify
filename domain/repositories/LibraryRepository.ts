import type {LibraryState} from '../entities/LibraryState';

export interface LibraryRepository {
    getState(): LibraryState;
    setMutationBlocked(blocked: boolean): void;
    isWatched(movieId: number): boolean;
    setWatched(movieId: number, watched: boolean): void;
    createCollection(name: string): string;
    renameCollection(id: string, name: string): void;
    removeCollection(id: string): void;
    setCollectionMembership(movieId: number, collectionId: string, included: boolean): void;
    clear(): void;
    applyRemote(state: LibraryState): void;
    subscribe(listener: () => void): () => void;
}
