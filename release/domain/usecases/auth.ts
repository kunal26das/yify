import type {AuthStatus, OnLine} from '../entities/index.js';
import type {EasApi, SessionStore} from '../repositories/index.js';

const ACCESS_TOKENS_PAGE = 'https://expo.dev/settings/access-tokens';

export interface AuthUseCases {
    authStatus(): Promise<AuthStatus>;

    login(token: string, onLine: OnLine): Promise<{ ok: boolean }>;

    logout(onLine: OnLine): Promise<{ ok: boolean }>;
}

export function loginPageUrl(): string {
    return ACCESS_TOKENS_PAGE;
}

export function createAuthUseCases(deps: {
    api: EasApi;
    sessionStore: SessionStore;
}): AuthUseCases {
    const {api, sessionStore} = deps;

    return {
        async authStatus() {
            const loggedIn = await api.isLoggedIn();
            let name = '';
            if (loggedIn) {
                try {
                    name = (await api.getAccount()).name;
                } catch {
                }
            }
            return {loggedIn, name};
        },

        async login(token, onLine) {
            const value = (token || '').trim();
            if (!value) return {ok: false};

            sessionStore.save(value);
            const ok = await api.isLoggedIn();
            if (!ok) sessionStore.clear();

            onLine({
                stream: ok ? 'system' : 'stderr',
                text: ok
                    ? 'Access token accepted.'
                    : 'Expo rejected that access token. Check it was copied in full.',
                label: 'login',
            });

            return {ok};
        },

        async logout(onLine) {
            sessionStore.clear();
            onLine({
                stream: 'system',
                text: 'Local access token cleared.',
                label: 'logout',
            });
            return {ok: true};
        },
    };
}
