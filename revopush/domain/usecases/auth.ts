import type {AuthStatus, OnLine} from '../entities/index.js';
import type {
    ManagementApi,
    ReleaseCli,
    SessionStore,
} from '../repositories/index.js';

const LOGIN_PAGE_BASE = 'https://app.revopush.org';

export interface AuthUseCases {
    authStatus(): Promise<AuthStatus>;

    login(accessKey: string, onLine: OnLine): Promise<{ ok: boolean }>;

    logout(onLine: OnLine): Promise<{ ok: boolean }>;
}

export function loginPageUrl(hostname: string): string {
    return `${LOGIN_PAGE_BASE}/cli-login?hostname=${encodeURIComponent(
        hostname,
    )}`;
}

export function createAuthUseCases(deps: {
    api: ManagementApi;
    cli: ReleaseCli;
    sessionStore: SessionStore;
}): AuthUseCases {
    const {api, cli, sessionStore} = deps;

    return {
        async authStatus() {
            const loggedIn = await api.isLoggedIn();
            let email = '';
            if (loggedIn) {
                try {
                    email = (await api.getAccount()).email;
                } catch {
                }
            }
            return {loggedIn, email};
        },

        async login(accessKey, onLine) {
            const key = (accessKey || '').trim();
            if (!key) return {ok: false};
            const res = await cli.run(['login', '--accessKey', key], onLine, {
                label: 'login',
                retries: 0,
            });
            return {ok: res.ok};
        },

        async logout(onLine) {
            let revokedOk = true;
            try {
                const revoke = await api.revokeSession();
                revokedOk = revoke.ok;
                onLine({
                    stream: revoke.ok ? 'system' : 'stderr',
                    text: revoke.ok
                        ? 'Access token revoked on the server.'
                        : `Could not revoke the access token on the server${
                            revoke.status ? ` (HTTP ${revoke.status})` : ''
                        }. Signing out locally anyway.`,
                    label: 'logout',
                });
            } catch (err) {
                revokedOk = false;
                onLine({
                    stream: 'stderr',
                    text: `Could not revoke the access token on the server: ${
                        (err as Error).message
                    }. Signing out locally anyway.`,
                    label: 'logout',
                });
            }

            sessionStore.clear();
            onLine({
                stream: 'system',
                text: 'Local session cleared.',
                label: 'logout',
            });

            return {ok: revokedOk};
        },
    };
}
