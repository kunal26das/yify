import type {AuthSession} from '@/core/domain/account';
import {INITIAL_AUTH_SESSION} from '@/core/domain/account';
import type {AuthAdapter, DeleteUserResult} from './firebaseAuth';

export type {AuthAdapter, DeleteUserResult};

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
