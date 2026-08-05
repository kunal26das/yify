import {useEffect, useRef, useSyncExternalStore, type ReactNode} from 'react';
import {useIsFocused} from 'expo-router';

export interface TopBarSlotContent {
    below?: ReactNode;
    searchValue?: string;
    onSearchSubmit?: (query: string) => void;
    showSearch?: boolean;
}

const EMPTY: TopBarSlotContent = {};

const listeners = new Set<() => void>();
let content: TopBarSlotContent = EMPTY;
let owner: object | null = null;

function subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function readContent(): TopBarSlotContent {
    return content;
}

function readEmpty(): TopBarSlotContent {
    return EMPTY;
}

function matches(a: TopBarSlotContent, b: TopBarSlotContent): boolean {
    return (
        a.below === b.below &&
        a.searchValue === b.searchValue &&
        a.onSearchSubmit === b.onSearchSubmit &&
        a.showSearch === b.showSearch
    );
}

function commit(next: TopBarSlotContent): void {
    if (matches(content, next)) return;
    content = next;
    for (const listener of listeners) listener();
}

export function useTopBarSlot(): TopBarSlotContent {
    return useSyncExternalStore(subscribe, readContent, readEmpty);
}

export function TopBarSlot({
    below,
    searchValue,
    onSearchSubmit,
    showSearch,
}: TopBarSlotContent): null {
    const token = useRef({}).current;
    const focused = useIsFocused();

    useEffect(() => {
        if (!focused) return;
        owner = token;
        commit({below, searchValue, onSearchSubmit, showSearch});
    }, [token, focused, below, searchValue, onSearchSubmit, showSearch]);

    useEffect(() => {
        if (!focused) {
            if (owner === token) {
                owner = null;
                commit(EMPTY);
            }
            return;
        }
        return () => {
            if (owner !== token) return;
            owner = null;
            commit(EMPTY);
        };
    }, [token, focused]);

    return null;
}
