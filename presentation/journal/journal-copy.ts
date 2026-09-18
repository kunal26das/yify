export const JOURNAL_DELETED_MESSAGE = 'This journal was removed by an account deletion request.';

const SAFE_ERRORS = new Set([
    JOURNAL_DELETED_MESSAGE,
    'Your journal has reached its storage limit.',
    'Your journal could not be saved on this device. Free up storage and try again.',
    'This journal entry was removed.',
    'Sign in to save your journal.',
    'Wait for your journal to finish loading, then try again.',
]);

export function journalErrorMessage(error: unknown, fallback: string): string {
    const message = error instanceof Error ? error.message : error;
    return typeof message === 'string' && SAFE_ERRORS.has(message) ? message : fallback;
}
