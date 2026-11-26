import {kv} from '@/core/storage/kv';
import {readValue, writeValue} from '@/core/storage/json';
import type {ImageHostMode, ImageHostState} from '@/core/storage/keys';
import {CODECS, KEYS} from '@/core/storage/keys';
import type {Store} from '@/core/store/createStore';
import {createStore, useStore} from '@/core/store/createStore';
import {isOnline} from './connectivity';

export type {ImageHostMode};

export const PROXY_ERROR_THRESHOLD = 3;
export const PROXY_DURATION_MS = 24 * 60 * 60 * 1000;

const DIRECT: ImageHostState = {mode: 'direct', until: 0};

interface Session {
  errors: number;
  successes: number;
}

let session: Session = {errors: 0, successes: 0};
let clock: () => number = () => Date.now();

function sameState(a: ImageHostState, b: ImageHostState): boolean {
  return a.mode === b.mode && a.until === b.until;
}

export const imageHostStore: Store<ImageHostState> = createStore<ImageHostState>({
  load: () => readValue(kv, KEYS.imageHost, CODECS.imageHost) ?? DIRECT,
  save: (state) => {
    writeValue(kv, KEYS.imageHost, CODECS.imageHost, state);
  },
  equals: sameState,
  serverState: DIRECT,
});

export function setImageHostClock(now: () => number): void {
  clock = now;
}

export function settleImageHost(): void {
  session = {errors: 0, successes: 0};
  const state = imageHostStore.get();
  if (state.mode === 'proxy' && clock() >= state.until) imageHostStore.set(() => DIRECT);
}

export function getImageHostMode(): ImageHostMode {
  return imageHostStore.get().mode;
}

export function reportImageLoad(): void {
  session = {...session, successes: session.successes + 1};
}

export function reportImageError(): void {
  if (imageHostStore.get().mode !== 'direct' || !isOnline()) return;
  session = {...session, errors: session.errors + 1};
  if (session.errors >= PROXY_ERROR_THRESHOLD && session.successes === 0) {
    imageHostStore.set(() => ({mode: 'proxy', until: clock() + PROXY_DURATION_MS}));
  }
}

function selectMode(state: ImageHostState): ImageHostMode {
  return state.mode;
}

export function useImageHostMode(): ImageHostMode {
  return useStore(imageHostStore, selectMode);
}
