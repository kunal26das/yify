export type DeleteAccountResult = 'deleted' | 'cancelled' | 'failed' | 'incomplete';

export async function deleteAccount(): Promise<DeleteAccountResult> {
  return 'cancelled';
}
