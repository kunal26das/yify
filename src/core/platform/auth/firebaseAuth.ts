import type {AuthSession} from '@/core/domain/account';
import {INITIAL_AUTH_SESSION} from '@/core/domain/account';

export type DeleteUserResult = 'deleted' | 'requires-recent-login' | 'failed';

export interface AuthAdapter {
  start(): void;
  getSession(): AuthSession;
  subscribe(listener: () => void): () => void;
  signIn(): Promise<boolean>;
  signOut(): Promise<void>;
  reauthenticate(): Promise<boolean>;
  deleteUser(): Promise<DeleteUserResult>;
  getIdToken(forceRefresh?: boolean): Promise<string | null>;
}

const SIGNED_OUT: AuthSession = {...INITIAL_AUTH_SESSION, ready: true};

export const auth: AuthAdapter = {
  start: () => undefined,
  getSession: () => SIGNED_OUT,
  subscribe: () => () => undefined,
  signIn: async () => false,
  signOut: async () => undefined,
  reauthenticate: async () => false,
  deleteUser: async () => 'failed',
  getIdToken: async () => null,
};
