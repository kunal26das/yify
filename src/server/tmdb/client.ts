export type UpstreamFailure = 'not_found' | 'rate_limited' | 'unavailable' | 'timeout' | 'auth' | 'invalid';

export class UpstreamError extends Error {
  readonly failure: UpstreamFailure;
  readonly status: number | null;
  readonly retryAfterSeconds: number | null;

  constructor(failure: UpstreamFailure, status: number | null, retryAfterSeconds: number | null) {
    super(failure);
    this.name = 'UpstreamError';
    this.failure = failure;
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export interface FetchBudget {
  remaining: number;
}

export const FETCH_BUDGET = 40;

export function createFetchBudget(remaining: number = FETCH_BUDGET): FetchBudget {
  return {remaining};
}
