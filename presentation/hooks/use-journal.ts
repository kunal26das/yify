import {useSyncExternalStore} from 'react';
import type {JournalSnapshot} from '@/domain';
import {useJournalRepository} from '../di/DependenciesContext';

const INITIAL_JOURNAL: JournalSnapshot = {ready: false, entries: [], syncing: false, error: null};

export function useJournal(): JournalSnapshot {
    const journal = useJournalRepository();
    return useSyncExternalStore(listener => journal.subscribe(listener),
        () => journal.getSnapshot(), () => INITIAL_JOURNAL);
}
