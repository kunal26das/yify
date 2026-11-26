import {useMemo, useSyncExternalStore} from 'react';

export interface Store<S> {
  get(): S;
  set(update: (previous: S) => S): void;
  subscribe(listener: () => void): () => void;
  readonly serverState: S;
}

export function createStore<S>(options: {
  load: () => S;
  save?: (state: S) => void;
  equals?: (a: S, b: S) => boolean;
  serverState: S;
}): Store<S> {
  const {load, save, equals = Object.is, serverState} = options;
  const listeners = new Set<() => void>();
  let current: {state: S} | null = null;

  function get(): S {
    current ??= {state: load()};
    return current.state;
  }

  return {
    get,
    set(update) {
      const previous = get();
      const next = update(previous);
      if (equals(previous, next)) return;
      current = {state: next};
      save?.(next);
      for (const listener of [...listeners]) listener();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    serverState,
  };
}

interface Selection<T> {
  getSnapshot(): T;
  getServerSnapshot(): T;
}

function createSelection<S, T>(store: Store<S>, select: (state: S) => T, equals?: (a: T, b: T) => boolean): Selection<T> {
  let memo: {state: S; value: T} | null = null;
  let server: {value: T} | null = null;
  function pick(state: S): T {
    if (memo !== null && Object.is(memo.state, state)) return memo.value;
    const value = select(state);
    const kept = memo !== null && equals !== undefined && equals(memo.value, value) ? memo.value : value;
    memo = {state, value: kept};
    return kept;
  }
  return {
    getSnapshot: () => pick(store.get()),
    getServerSnapshot: () => {
      server ??= {value: select(store.serverState)};
      return server.value;
    },
  };
}

export function useStore<S, T>(store: Store<S>, select: (state: S) => T, equals?: (a: T, b: T) => boolean): T {
  const selection = useMemo(() => createSelection(store, select, equals), [store, select, equals]);
  return useSyncExternalStore(store.subscribe, selection.getSnapshot, selection.getServerSnapshot);
}
