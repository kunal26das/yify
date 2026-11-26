export interface BatcherOptions<K, V> {
  maxBatch: number;
  windowMs: number;
  load: (keys: K[]) => Promise<Map<K, V>>;
  missing?: (key: K) => unknown;
}

interface Waiter<V> {
  resolve: (value: V) => void;
  reject: (error: unknown) => void;
}

export class BatchMissingError extends Error {
  constructor() {
    super('missing');
    this.name = 'BatchMissingError';
  }
}

export function createBatcher<K, V>(options: BatcherOptions<K, V>): (key: K) => Promise<V> {
  const maxBatch = Math.max(1, Math.trunc(options.maxBatch));
  let pending = new Map<K, Waiter<V>[]>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  function settle(keys: K[], waiters: Map<K, Waiter<V>[]>, result: Map<K, V> | null, error: unknown): void {
    for (const key of keys) {
      for (const waiter of waiters.get(key) ?? []) {
        if (result === null) waiter.reject(error);
        else if (result.has(key)) waiter.resolve(result.get(key) as V);
        else waiter.reject(options.missing ? options.missing(key) : new BatchMissingError());
      }
    }
  }

  function run(keys: K[], waiters: Map<K, Waiter<V>[]>): void {
    let request: Promise<Map<K, V>>;
    try {
      request = options.load(keys);
    } catch (error) {
      settle(keys, waiters, null, error);
      return;
    }
    request.then(
      (result) => settle(keys, waiters, result, null),
      (error: unknown) => settle(keys, waiters, null, error),
    );
  }

  function flush(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    const waiters = pending;
    pending = new Map();
    const keys = [...waiters.keys()];
    for (let start = 0; start < keys.length; start += maxBatch) run(keys.slice(start, start + maxBatch), waiters);
  }

  return (key: K) => new Promise<V>((resolve, reject) => {
    const waiters = pending.get(key);
    if (waiters) waiters.push({resolve, reject});
    else pending.set(key, [{resolve, reject}]);
    if (pending.size >= maxBatch) flush();
    else timer ??= setTimeout(flush, options.windowMs);
  });
}
