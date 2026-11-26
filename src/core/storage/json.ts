import type {KeyValueStore} from './kv';

export interface Codec<T> {
  version: number;
  decode(data: unknown): T | null;
  encode(value: T): unknown;
  upgrade?(fromVersion: number, data: unknown): T | null;
}

interface Envelope {
  v: number;
  d: unknown;
}

function parseEnvelope(text: string): Envelope | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed) || !Object.hasOwn(parsed, 'd')) return null;
  const {v, d} = parsed as {v?: unknown; d: unknown};
  if (typeof v !== 'number' || !Number.isSafeInteger(v) || v < 1) return null;
  return {v, d};
}

export function readValue<T>(store: KeyValueStore, key: string, codec: Codec<T>): T | null {
  const text = store.getString(key);
  if (text === undefined) return null;
  const envelope = parseEnvelope(text);
  if (envelope === null || envelope.v > codec.version) return null;
  if (envelope.v === codec.version) return codec.decode(envelope.d);
  return codec.upgrade ? codec.upgrade(envelope.v, envelope.d) : null;
}

export function writeValue<T>(store: KeyValueStore, key: string, codec: Codec<T>, value: T): boolean {
  return store.setString(key, JSON.stringify({v: codec.version, d: codec.encode(value)}));
}
