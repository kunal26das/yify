export interface ServerState {
  cache: Map<string, unknown>;
  limiter: {active: number; waiting: (() => void)[]};
  admission: Map<string, unknown>;
  probes: Map<string, {checkedAt: number; ok: boolean}>;
  reported: Map<string, number>;
}

interface ServerGlobal {
  __yifyServer?: ServerState;
}

export function getServerState(): ServerState {
  const scope = globalThis as ServerGlobal;
  scope.__yifyServer ??= {
    cache: new Map(),
    limiter: {active: 0, waiting: []},
    admission: new Map(),
    probes: new Map(),
    reported: new Map(),
  };
  return scope.__yifyServer;
}
