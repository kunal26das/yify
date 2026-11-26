export interface Account {
  uid: string;
  name: string | null;
  email: string | null;
  photoUrl: string | null;
}

export interface AuthSession {
  ready: boolean;
  signingIn: boolean;
  available: boolean;
  account: Account | null;
  error: string | null;
}

export const INITIAL_AUTH_SESSION: AuthSession = {
  ready: false,
  signingIn: false,
  available: false,
  account: null,
  error: null,
};

export type AuthTokenFailure = 'network' | 'denied' | 'server';

export class AuthTokenError extends Error {
  readonly failure: AuthTokenFailure;

  constructor(failure: AuthTokenFailure) {
    super('Account authentication is temporarily unavailable.');
    this.name = 'AuthTokenError';
    this.failure = failure;
  }
}
