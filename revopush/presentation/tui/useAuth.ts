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
    email: string;
    version: string;
    branch: string;
    busy: boolean;
    status: string;
    lines: LogLine[];
    recheck: () => Promise<void>;
    openLoginPage: () => Promise<void>;
    login: (accessKey: string) => Promise<void>;
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
    const [email, setEmail] = useState('');
    const [busy, setBusy] = useState(false);
    const [status, setStatus] = useState('');
    const [lines, setLines] = useState<LogLine[]>([]);

    const version = safeHeaderVersion();
    const branch = currentBranch() ?? '';

    const append = (l: LogLine) => setLines((prev) => [...prev, l]);

    const refresh = async () => {
        const s = await authStatus();
        setEmail(s.email);
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
                ? 'Opened the login page in your browser — copy your access key, then paste it below.'
                : `Couldn't open a browser. Visit ${url} manually, then paste your access key below.`,
        );
    };

    const login = async (accessKey: string) => {
        const key = accessKey.trim();
        if (!key) {
            setStatus('Paste your access key first.');
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
            setStatus('Login failed — double-check the access key and try again.');
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
        email,
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
