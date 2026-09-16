import {AuthTokenError, type Diagnostics} from '@/domain';

const DENIED_CODES = new Set([
    'user_disabled', 'user_token_expired', 'invalid_user_token', 'requires_recent_login',
]);

export function createFirebaseIdTokenReader<User extends {uid: string}>(
    currentUser: () => User | null | undefined,
    readToken: (user: User) => Promise<string>,
    diagnostics: Diagnostics,
    diagnosticCode: (error: unknown) => string,
): () => Promise<string | null> {
    let pending: {user: User; promise: Promise<string | null>} | null = null;
    const readUser = () => {
        try {
            return currentUser();
        } catch (error) {
            diagnostics.capture(error, 'auth.token_refresh', {provider: 'google', error_code: diagnosticCode(error)});
            throw new AuthTokenError('server');
        }
    };
    return () => {
        let user: User | null | undefined;
        try {
            user = readUser();
        } catch (error) {
            return Promise.reject(error);
        }
        if (!user) return Promise.resolve(null);
        if (pending?.user.uid === user.uid) return pending.promise;
        const requestedUser = user;
        const promise = Promise.resolve().then(() => readToken(user)).then(token =>
            readUser()?.uid === requestedUser.uid ? token : null,
        ).catch((error: unknown) => {
            if (error instanceof AuthTokenError) throw error;
            if (readUser()?.uid !== requestedUser.uid) return null;
            const code = diagnosticCode(error);
            if (code === 'network_request_failed') {
                diagnostics.event('auth.token_refresh', {
                    provider: 'google', outcome: 'unavailable', error_code: code,
                });
            } else {
                diagnostics.capture(error, 'auth.token_refresh', {provider: 'google', error_code: code});
            }
            throw new AuthTokenError(code === 'network_request_failed' ? 'network' :
                DENIED_CODES.has(code) ? 'denied' : 'server');
        }).finally(() => {
            if (pending?.promise === promise) pending = null;
        });
        pending = {user, promise};
        return promise;
    };
}
