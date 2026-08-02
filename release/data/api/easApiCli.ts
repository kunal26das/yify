import {
    type Account,
    type EasApi,
    NotLoggedInError,
    type SessionStore,
    type Workspace,
} from '../../domain/index.js';
import {easCliPath, easEnv, nodeBinaryPath} from '../cli/easBin.js';
import {capture} from '../cli/capture.js';

const NOT_LOGGED_IN_RE = /not logged in/i;

export function createEasApi(deps: {
    sessionStore: SessionStore;
    workspace: Workspace;
}): EasApi {
    const {sessionStore, workspace} = deps;

    async function whoami(): Promise<string | null> {
        const session = sessionStore.read();
        if (!session) return null;

        const res = await capture(
            nodeBinaryPath(),
            [easCliPath(), 'whoami', '--non-interactive'],
            {cwd: workspace.repoRoot, env: easEnv(session), timeoutMs: 60_000},
        );

        const output = `${res.stdout}${res.stderr}`.trim();
        if (!res.ok || NOT_LOGGED_IN_RE.test(output)) return null;

        const name = res.stdout.trim().split(/\r?\n/).filter(Boolean).pop();
        return name ?? null;
    }

    return {
        async isLoggedIn() {
            try {
                return (await whoami()) !== null;
            } catch {
                return false;
            }
        },

        async getAccount(): Promise<Account> {
            const name = await whoami();
            if (!name) throw new NotLoggedInError();
            return {name};
        },
    };
}
