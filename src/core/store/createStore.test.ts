import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createElement} from 'react';
import {renderToString} from 'react-dom/server';
import TestRenderer from 'react-test-renderer';
import type {Store} from './createStore';
import {createStore, useStore} from './createStore';

Object.assign(globalThis, {IS_REACT_ACT_ENVIRONMENT: true});

const {act} = TestRenderer;

interface Counter {
  count: number;
  label: string;
}

function counterStore(initial: Counter = {count: 0, label: 'a'}) {
  const calls = {load: 0, saved: [] as Counter[]};
  const store = createStore<Counter>({
    load: () => {
      calls.load += 1;
      return initial;
    },
    save: (state) => {
      calls.saved.push(state);
    },
    serverState: {count: -1, label: 'server'},
  });
  return {store, calls};
}

function probe<T>(store: Store<Counter>, select: (state: Counter) => T, equals?: (a: T, b: T) => boolean) {
  const renders: T[] = [];
  function Probe() {
    const value = useStore(store, select, equals);
    renders.push(value);
    return createElement('span', null, JSON.stringify(value));
  }
  return {Probe, renders};
}

const selectCount = (state: Counter) => state.count;

test('load runs on the first get, never at creation or on subscribe', () => {
  const {store, calls} = counterStore();
  const unsubscribe = store.subscribe(() => undefined);
  assert.equal(calls.load, 0);
  assert.deepEqual(store.get(), {count: 0, label: 'a'});
  assert.equal(store.get(), store.get());
  assert.equal(calls.load, 1);
  assert.deepEqual(store.serverState, {count: -1, label: 'server'});
  unsubscribe();
});

test('set loads first, then saves and notifies only when the state changes', () => {
  const {store, calls} = counterStore();
  let notified = 0;
  store.subscribe(() => {
    notified += 1;
  });
  const seen: Counter[] = [];
  store.set((previous) => {
    seen.push(previous);
    return {...previous, count: 1};
  });
  assert.deepEqual(seen, [{count: 0, label: 'a'}]);
  assert.equal(calls.load, 1);
  assert.deepEqual(store.get(), {count: 1, label: 'a'});
  assert.deepEqual(calls.saved, [{count: 1, label: 'a'}]);
  assert.equal(notified, 1);
  store.set((previous) => previous);
  assert.equal(calls.saved.length, 1);
  assert.equal(notified, 1);
});

test('a custom equals suppresses saves and notifications for equal states', () => {
  let saves = 0;
  let notified = 0;
  const store = createStore<Counter>({
    load: () => ({count: 0, label: 'a'}),
    save: () => {
      saves += 1;
    },
    equals: (a, b) => a.count === b.count,
    serverState: {count: 0, label: ''},
  });
  store.subscribe(() => {
    notified += 1;
  });
  store.set((previous) => ({...previous, label: 'b'}));
  assert.deepEqual(store.get(), {count: 0, label: 'a'});
  assert.equal(saves, 0);
  assert.equal(notified, 0);
  store.set((previous) => ({...previous, count: 2}));
  assert.equal(saves, 1);
  assert.equal(notified, 1);
});

test('listeners can unsubscribe, even while a notification is running', () => {
  const {store} = counterStore();
  const order: string[] = [];
  const unsubscribeFirst = store.subscribe(() => {
    order.push('first');
    unsubscribeSecond();
  });
  const unsubscribeSecond = store.subscribe(() => {
    order.push('second');
  });
  store.set((previous) => ({...previous, count: 1}));
  store.set((previous) => ({...previous, count: 2}));
  unsubscribeFirst();
  store.set((previous) => ({...previous, count: 3}));
  assert.deepEqual(order, ['first', 'second', 'first']);
});

test('useStore re-renders only when the selected value changes', () => {
  const {store} = counterStore();
  const {Probe, renders} = probe(store, selectCount);
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(createElement(Probe));
  });
  assert.deepEqual(renders, [0]);
  act(() => store.set((previous) => ({...previous, label: 'b'})));
  assert.deepEqual(renders, [0]);
  act(() => store.set((previous) => ({...previous, count: 1})));
  assert.deepEqual(renders, [0, 1]);
  assert.equal(renderer?.toJSON() && (renderer.toJSON() as {children: string[]}).children[0], '1');
  act(() => renderer?.unmount());
});

test('useStore keeps an equal derived selection and calls select once per state', () => {
  const {store} = counterStore();
  let selections = 0;
  const selectPair = (state: Counter) => {
    selections += 1;
    return {count: state.count};
  };
  const samePair = (a: {count: number}, b: {count: number}) => a.count === b.count;
  const {Probe, renders} = probe(store, selectPair, samePair);
  let renderer: TestRenderer.ReactTestRenderer | undefined;
  act(() => {
    renderer = TestRenderer.create(createElement(Probe));
  });
  assert.equal(selections, 1);
  act(() => store.set((previous) => ({...previous, label: 'b'})));
  assert.equal(renders.length, 1);
  assert.equal(selections, 2);
  act(() => store.set((previous) => ({...previous, count: 5})));
  assert.equal(renders.length, 2);
  assert.deepEqual(renders[1], {count: 5});
  act(() => renderer?.update(createElement(Probe)));
  assert.equal(renders.length, 3);
  assert.equal(renders[2], renders[1]);
  assert.equal(selections, 3);
  act(() => renderer?.unmount());
});

test('server rendering selects from serverState and never loads stored data', () => {
  const {store, calls} = counterStore({count: 9, label: 'stored'});
  const {Probe} = probe(store, selectCount);
  assert.equal(renderToString(createElement(Probe)), '<span>-1</span>');
  assert.equal(calls.load, 0);
});
