import {useSyncExternalStore} from 'react';
import type {LibraryState} from '@/domain';
import {useLibraryRepository} from '../di/DependenciesContext';

const EMPTY: LibraryState = {watched: {}, collections: {}, memberships: {}, clearedAt: 0};

export function useLibrary(): LibraryState {
    const library = useLibraryRepository();
    return useSyncExternalStore(
        (listener) => library.subscribe(listener),
        () => library.getState(),
        () => EMPTY
    );
}
