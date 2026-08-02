export interface AuthUser {
    uid: string;
    name: string | null;
    email: string | null;
    photoUrl: string | null;
}

export interface AuthState {
    ready: boolean;
    signingIn: boolean;
    available: boolean;
    user: AuthUser | null;
    error: string | null;
}

export const INITIAL_AUTH_STATE: AuthState = {
    ready: false,
    signingIn: false,
    available: false,
    user: null,
    error: null,
};

export function createAuthStore() {
    let state = INITIAL_AUTH_STATE;
    const listeners = new Set<() => void>();

    return {
        get(): AuthState {
            return state;
        },
        set(next: Partial<AuthState>) {
            state = {...state, ...next};
            listeners.forEach((listener) => listener());
        },
        subscribe(listener: () => void): () => void {
            listeners.add(listener);
            return () => {
                listeners.delete(listener);
            };
        },
    };
}
