import os from 'node:os';
import {
    type Account,
    type Deployment,
    type ManagementApi,
    NotLoggedInError,
    type Platform,
    type Session,
    type SessionStore,
    type Workspace,
} from '../../domain/index.js';

function authHeaders(session: Session): Record<string, string> {
    return {
        Accept: 'application/vnd.code-push.v2+json',
        Authorization: `Bearer ${session.accessKey}`,
    };
}

async function getJson(
    session: Session,
    endpoint: string,
): Promise<{ status: number; body: any }> {
    const res = await fetch(`${session.serverUrl}${endpoint}`, {
        method: 'GET',
        headers: authHeaders(session),
    });
    let body: any = undefined;
    const text = await res.text();
    if (text) {
        try {
            body = JSON.parse(text);
        } catch {
            body = text;
        }
    }
    return {status: res.status, body};
}

export function createManagementApi(deps: {
    sessionStore: SessionStore;
    workspace: Workspace;
}): ManagementApi {
    const {sessionStore, workspace} = deps;

    function requireSession(): Session {
        const session = sessionStore.read();
        if (!session) throw new NotLoggedInError();
        return session;
    }

    async function isLoggedIn(): Promise<boolean> {
        const session = sessionStore.read();
        if (!session) return false;
        try {
            const {status} = await getJson(session, '/authenticated');
            return status === 200;
        } catch {
            return false;
        }
    }

    async function revokeSession(): Promise<{ ok: boolean; status?: number }> {
        const session = sessionStore.read();
        if (!session) return {ok: true};

        const machineName = os.hostname();
        const endpoints = [
            `/sessions/${encodeURIComponent(machineName)}`,
            `/accessKeys/${encodeURIComponent(machineName)}`,
        ];

        let lastStatus: number | undefined;
        for (const endpoint of endpoints) {
            try {
                const res = await fetch(`${session.serverUrl}${endpoint}`, {
                    method: 'DELETE',
                    headers: authHeaders(session),
                });
                lastStatus = res.status;
                if (res.status >= 200 && res.status < 300) {
                    return {ok: true, status: res.status};
                }
                if (res.status === 404) continue;
                return {ok: false, status: res.status};
            } catch {
            }
        }

        if (lastStatus === 404) return {ok: true, status: 404};
        return {ok: false, status: lastStatus};
    }

    async function getAccount(): Promise<Account> {
        const session = requireSession();
        const {status, body} = await getJson(session, '/account');
        if (status !== 200 || !body?.account) throw new NotLoggedInError();
        return {email: body.account.email};
    }

    async function getBaseRelease(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<unknown | null> {
        const session = requireSession();
        const app = workspace.apps[platform].name;
        const endpoint = `/apps/${encodeURIComponent(
            app,
        )}/deployments/${encodeURIComponent(
            deployment,
        )}/basebundle?appVersion=${encodeURIComponent(version)}`;
        const {status, body} = await getJson(session, endpoint);
        if (status === 404) return null;
        if (status !== 200) {
            throw new Error(
                `RevoPush API returned ${status} when checking base release for v${version}.`,
            );
        }
        const basebundle = body?.basebundle;
        if (
            !basebundle ||
            typeof basebundle !== 'object' ||
            !basebundle.bundleBlobUrl
        ) {
            return null;
        }
        return basebundle;
    }

    async function hasBaseRelease(
        platform: Platform,
        deployment: Deployment,
        version: string,
    ): Promise<boolean> {
        return (await getBaseRelease(platform, deployment, version)) !== null;
    }

    return {
        isLoggedIn,
        getAccount,
        revokeSession,
        getBaseRelease,
        hasBaseRelease,
    };
}
