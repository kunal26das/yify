import type {AuthSession} from '@/core/domain/account';
import type {HeaderAccount} from '@/core/ui/navigation/WebHeader';

export const UNNAMED_ACCOUNT = 'You';

export function headerAccount(session: AuthSession): HeaderAccount | null {
  const account = session.account;
  if (account === null) return null;
  return {name: account.name ?? account.email ?? UNNAMED_ACCOUNT, photoUrl: account.photoUrl};
}
