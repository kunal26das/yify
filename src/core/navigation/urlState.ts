import {useCallback, useMemo} from 'react';
import {useLocalSearchParams, useNavigation} from 'expo-router';

export type UrlParams = Record<string, string | string[] | undefined>;

export interface UrlCodec<S> {
  keys: readonly string[];
  parse(params: UrlParams): S;
  serialize(state: S): Record<string, string | undefined>;
}

export interface UrlState<S> {
  state: S;
  commit(next: S): void;
}

function paramValue(value: unknown): string | string[] | null {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  return null;
}

export function useUrlState<S>(codec: UrlCodec<S>): UrlState<S> {
  const params: Record<string, unknown> = useLocalSearchParams();
  const navigation = useNavigation<{setParams(params: Record<string, string | undefined>): void}>();
  const signature = JSON.stringify(codec.keys.map((key) => paramValue(params[key])));
  const state = useMemo(() => {
    const values: (string | string[] | null)[] = JSON.parse(signature);
    const picked: UrlParams = {};
    codec.keys.forEach((key, index) => {
      const value = values[index];
      if (value !== null && value !== undefined) picked[key] = value;
    });
    return codec.parse(picked);
  }, [codec, signature]);
  const commit = useCallback((next: S) => {
    const serialized = codec.serialize(next);
    const update: Record<string, string | undefined> = {};
    for (const key of codec.keys) update[key] = serialized[key];
    navigation.setParams(update);
  }, [codec, navigation]);
  return useMemo(() => ({state, commit}), [state, commit]);
}
