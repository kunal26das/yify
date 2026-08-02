import {useEffect, useState} from 'react';
import {
    authStatus,
    currentBranch,
    login as coreLogin,
    loginPageUrl,
    type LogLine,
    logout as coreLogout,
    openUrl,
    repoPackageVersion,
    repoTargetVersion,
} from '../container.js';

export type AuthScreen = 'loading' | 'gate' | 'menu';

export interface AuthViewModel {
    screen: AuthScreen;
    account: string;
    version: string;
    branch: string;
    busy: boolean;
    status: string;
    lines: LogLine[];
    recheck: () => Promise<void>;
    openLoginPage: () => Promise<void>;
    login: (token: string) => Promise<void>;
    logout: () => Promise<void>;
}

function safeHeaderVersion(): string {
    try {
        return repoPackageVersion() || repoTargetVersion();
    } catch {
        return '';
    }
}

export function useAuth(): AuthViewModel {
    const [screen, setScreen] = useState<AuthScreen>('loading');
    const [account, setAccount] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState<LogLine[]>([]);

    const version = safeHeaderVersion();
    const branch = currentBranch() ?? '';

    const append = (l: LogLine) => setLines((prev) => [...prev, l]);

    const refresh = async () => {
        const s = await authStatus();
        setAccount(s.name);
        setScreen(s.loggedIn ? 'menu' : 'gate');
    };

    const recheck = async () => {
        setScreen('loading');
        await refresh();
    };

    const openLoginPage = async () => {
        const url = loginPageUrl();
        const ok = await openUrl(url);
        setStatus(
            ok
                ? 'Opened the login page in your browser — copy your access token, then paste it below.'
                : `Couldn't open a browser. Visit ${url} manually, then paste your access token below.`,
        );
    };

    const login = async (token: string) => {
        const key = token.trim();
        if (!key) {
            setStatus('Paste your access token first.');
            return;
        }
        setBusy(true);
        setStatus('Signing in…');
        setLines([]);
        const res = await coreLogin(key, append);
        setBusy(false);
        if (res.ok) {
            setStatus('Signed in.');
            await recheck();
        } else {
            setStatus('Login failed — double-check the access token and try again.');
        }
    };

    const logout = async () => {
        setBusy(true);
        setStatus('Signing out…');
        setLines([]);
        const res = await coreLogout(append);
        setBusy(false);
        setStatus(res.ok ? 'Signed out.' : "Couldn't sign out cleanly.");
        await recheck();
    };

    useEffect(() => {
        void recheck();
    }, []);

    return {
        screen,
        account,
        version,
        branch,
        busy,
        status,
        lines,
        recheck,
        openLoginPage,
        login,
        logout,
    };
}
