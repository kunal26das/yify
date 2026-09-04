import {useCallback, useSyncExternalStore} from 'react';
import type {HistoryEntry} from '@/domain';
import {useWatchHistoryRepository} from '../di/DependenciesContext';

const EMPTY: HistoryEntry[] = [];

export function useWatchHistory(): HistoryEntry[] {
    const history = useWatchHistoryRepository();
    return useSyncExternalStore(
        (listener) => history.subscribe(listener),
        () => history.getAll(),
        () => EMPTY
    );
}

export function useRecordHistory(): (entry: HistoryEntry) => void {
    const history = useWatchHistoryRepository();
    return useCallback((entry: HistoryEntry) => history.record(entry), [history]);
}

export function useRemoveFromHistory(): (key: string) => void {
    const history = useWatchHistoryRepository();
    return useCallback((key: string) => history.remove(key), [history]);
}

export function useClearHistory(): () => void {
    const history = useWatchHistoryRepository();
    return useCallback(() => history.clear(), [history]);
}
