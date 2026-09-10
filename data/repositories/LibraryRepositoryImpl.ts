import type {KeyValueStore, LibraryRepository, LibraryState} from '@/domain';
import {
    encodeLibraryState,
    emptyLibraryState,
    LIBRARY_MAX_COLLECTION_RECORDS,
    LIBRARY_MAX_COLLECTIONS,
    LIBRARY_MAX_MARKS,
    LIBRARY_MAX_PAYLOAD_CHARS,
    LIBRARY_NAME_LIMIT,
    libraryLatestTimestamp,
    libraryMovieWatched,
    liveLibraryCollections,
    normalizeCollectionName,
    normalizeLibraryState,
    parseLibraryState,
    sameLibraryState,
} from '@/domain';

const KEY = 'state';
const MUTATION_BLOCK_KEY = 'mutationBlocked';

export class LibraryRepositoryImpl implements LibraryRepository {
    private snapshot: LibraryState | null = null;
    private mutationBlocked: boolean | null = null;
    private readonly listeners = new Set<() => void>();

    constructor(private readonly store: KeyValueStore, private readonly now: () => number = Date.now) {}

    getState(): LibraryState {
        if (!this.snapshot) this.snapshot = parseLibraryState(this.store.getString(KEY));
        return this.snapshot;
    }

    setMutationBlocked(blocked: boolean): void {
        if (blocked) {
            this.mutationBlocked = true;
            this.store.set(MUTATION_BLOCK_KEY, 'true');
        } else {
            this.store.delete(MUTATION_BLOCK_KEY);
            this.mutationBlocked = false;
        }
    }

    isWatched(movieId: number): boolean {
        return libraryMovieWatched(this.getState(), movieId);
    }

    setWatched(movieId: number, watched: boolean): void {
        this.assertWritable();
        this.validateMovieId(movieId);
        const state = this.getState();
        const key = String(movieId);
        if (state.watched[key]?.value === watched) return;
        if (!state.watched[key] && Object.keys(state.watched).length >= LIBRARY_MAX_MARKS) {
            throw new Error('Your watched list has reached its limit.');
        }
        this.write({...state, watched: {...state.watched, [key]: {at: this.nextTimestamp(), value: watched}}});
    }

    createCollection(value: string): string {
        this.assertWritable();
        const name = this.validateName(value);
        const state = this.getState();
        if (liveLibraryCollections(state).length >= LIBRARY_MAX_COLLECTIONS ||
            Object.keys(state.collections).length >= LIBRARY_MAX_COLLECTION_RECORDS) {
            throw new Error('Your collection limit has been reached.');
        }
        const at = this.nextTimestamp();
        let id: string;
        do { id = `c_${at.toString(36)}_${Math.random().toString(36).slice(2, 12)}`; } while (state.collections[id]);
        this.write({...state, collections: {...state.collections, [id]: {name, updatedAt: at, removedAt: 0}}});
        return id;
    }

    renameCollection(id: string, value: string): void {
        this.assertWritable();
        const name = this.validateName(value);
        const state = this.getState();
        const collection = Object.hasOwn(state.collections, id) ? state.collections[id] : undefined;
        if (!collection || collection.removedAt > 0 || collection.updatedAt <= state.clearedAt) return;
        if (collection.name === name) return;
        this.write({...state, collections: {...state.collections, [id]: {...collection, name, updatedAt: this.nextTimestamp()}}});
    }

    removeCollection(id: string): void {
        this.assertWritable();
        const state = this.getState();
        const collection = Object.hasOwn(state.collections, id) ? state.collections[id] : undefined;
        if (!collection || collection.removedAt > 0) return;
        this.write({...state, collections: {...state.collections, [id]: {...collection, removedAt: this.nextTimestamp()}}});
    }

    setCollectionMembership(movieId: number, collectionId: string, included: boolean): void {
        this.assertWritable();
        this.validateMovieId(movieId);
        const state = this.getState();
        const collection = Object.hasOwn(state.collections, collectionId) ? state.collections[collectionId] : undefined;
        if (!collection || collection.removedAt > 0 || collection.updatedAt <= state.clearedAt) return;
        const marks = state.memberships[collectionId] ?? {};
        const key = String(movieId);
        if (marks[key]?.value === included) return;
        const total = Object.values(state.memberships).reduce((count, items) => count + Object.keys(items).length, 0);
        if (!marks[key] && total >= LIBRARY_MAX_MARKS) throw new Error('Your collections have reached their movie limit.');
        this.write({...state, memberships: {...state.memberships,
            [collectionId]: {...marks, [key]: {at: this.nextTimestamp(), value: included}}}});
    }

    clear(): void {
        this.assertWritable();
        this.write({...emptyLibraryState(), clearedAt: this.nextTimestamp()});
    }

    applyRemote(state: LibraryState): void {
        this.write(normalizeLibraryState(state));
    }

    subscribe(listener: () => void): () => void {
        this.listeners.add(listener);
        return () => { this.listeners.delete(listener); };
    }

    private assertWritable(): void {
        if (this.mutationBlocked == null) this.mutationBlocked = this.store.getString(MUTATION_BLOCK_KEY) === 'true';
        if (this.mutationBlocked) throw new Error('Your account is still switching. Try again after sync recovers.');
    }

    private nextTimestamp(): number {
        const next = Math.max(Math.trunc(this.now()), libraryLatestTimestamp(this.getState()) + 1);
        if (!Number.isSafeInteger(next)) throw new Error('Your library could not be updated.');
        return next;
    }

    private validateMovieId(movieId: number): void {
        if (!Number.isSafeInteger(movieId) || movieId <= 0) throw new Error('Choose a valid movie.');
    }

    private validateName(value: string): string {
        const name = normalizeCollectionName(value);
        if (!name || name.length > LIBRARY_NAME_LIMIT || /[\u0000-\u001f\u007f]/.test(name)) throw new Error(`Use a collection name between 1 and ${LIBRARY_NAME_LIMIT} characters.`);
        return name;
    }

    private write(state: LibraryState): void {
        const next = normalizeLibraryState(state);
        if (sameLibraryState(this.getState(), next)) return;
        const encoded = encodeLibraryState(next);
        if (encoded.length > LIBRARY_MAX_PAYLOAD_CHARS) throw new Error('Your library has reached its storage limit.');
        this.store.set(KEY, encoded);
        this.snapshot = next;
        this.listeners.forEach(listener => listener());
    }
}
