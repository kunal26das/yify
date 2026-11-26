import type {AuthSession} from '@/core/domain/account';
import {INITIAL_AUTH_SESSION} from '@/core/domain/account';

const SIGNED_OUT: AuthSession = {...INITIAL_AUTH_SESSION, ready: true};

export function useSession(): AuthSession {
  return SIGNED_OUT;
}

export function getSession(): AuthSession {
  return SIGNED_OUT;
}

export function subscribeUid(listener: (uid: string | null) => void): () => void {
  listener(null);
  return () => undefined;
}

export function isNewUser(): boolean {
  return false;
}

export async function signIn(): Promise<boolean> {
  return false;
}

export function onAccountDeleted(listener: (uid: string) => Promise<void> | void): () => void {
  return () => undefined;
}

export function startSession(): void {
  return;
}
