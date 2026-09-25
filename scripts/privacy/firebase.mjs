const PROJECT = /^[a-z][a-z0-9-]{4,61}[a-z0-9]$/;
const UID = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/;
const segment = value => typeof value === 'string' && value.length > 0 && value.length <= 1500
    && !/[\/\u0000-\u001f]/.test(value) && !['.', '..'].includes(value);
const pick = (value, keys) => Object.fromEntries(keys.filter(key => Object.hasOwn(value, key)).map(key => [key, value[key]]));

export function validateIdentity(project, uid) {
    if (!PROJECT.test(project ?? '') || !UID.test(uid ?? '')) throw new Error('invalid_identity');
}

export function firebaseReader({project, uid, accessToken, fetcher = fetch, maxRequests = 10000}) {
    validateIdentity(project, uid);
    if (typeof accessToken !== 'string' || !accessToken.trim() || /[\r\n]/.test(accessToken)) throw new Error('missing_access_token');
    const root = `projects/${project}/databases/(default)/documents`;
    const base = `https://firestore.googleapis.com/v1/${root}`;
    const roots = ['users', 'journals', 'availabilityAlertState'].map(collection => `${collection}/${uid}`);
    let requests = 0;
    function scoped(path) {
        if (!roots.some(parent => path === parent || path.startsWith(`${parent}/`)) || !path.split('/').every(segment)) throw new Error('invalid_document_scope');
        return path.split('/').map(encodeURIComponent).join('/');
    }
    async function request(url, body) {
        if (++requests > maxRequests) throw new Error('request_limit');
        const response = await fetcher(url, {method: body ? 'POST' : 'GET', redirect: 'error', cache: 'no-store', credentials: 'omit',
            signal: AbortSignal.timeout(15000), headers: {Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json'},
            ...(body ? {body: JSON.stringify(body)} : {})});
        const chunks = []; let length = 0;
        if (response.body) {
            const reader = response.body.getReader();
            try {
                while (true) {
                    const {done, value} = await reader.read();
                    if (done) break;
                    length += value.byteLength;
                    if (length > 8_000_000) {await reader.cancel(); throw new Error('response_limit');}
                    chunks.push(Buffer.from(value));
                }
            } finally {reader.releaseLock();}
        }
        if (response.status === 404) return null;
        if (response.status !== 200) throw new Error('provider_read_failed');
        let data;
        try {data = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');} catch {throw new Error('invalid_response');}
        if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('invalid_response');
        return data;
    }
    async function pages(load, field) {
        const values = []; const seen = new Set(); let token;
        for (let page = 0; page < 100; page++) {
            const data = await load(token);
            if (!data) throw new Error('collection_read_failed');
            const batch = data[field] ?? [];
            if (!Array.isArray(batch) || batch.length > 100) throw new Error('invalid_page');
            values.push(...batch);
            if (!data.nextPageToken) return values;
            token = data.nextPageToken;
            if (typeof token !== 'string' || token.length > 10000 || seen.has(token)) throw new Error('invalid_pagination');
            seen.add(token);
        }
        throw new Error('page_limit');
    }
    function document(data, expected) {
        if (!data) return null;
        if (typeof data.name !== 'string' || !data.name.startsWith(`${root}/`)) throw new Error('invalid_document');
        const path = data.name.slice(root.length + 1);
        scoped(path);
        if (expected && path !== expected) throw new Error('unexpected_document');
        if (data.fields !== undefined && (!data.fields || typeof data.fields !== 'object' || Array.isArray(data.fields))) throw new Error('invalid_fields');
        return {path, ...pick(data, ['fields', 'createTime', 'updateTime']), exists: typeof data.updateTime === 'string'};
    }
    return {
        roots,
        requestCount: () => requests,
        async readDocument(path) {
            const doc = document(await request(`${base}/${scoped(path)}`), path);
            if (doc && !doc.exists) throw new Error('missing_revision');
            return doc;
        },
        async collections(path) {
            const ids = await pages(token => request(`${base}/${scoped(path)}:listCollectionIds`, {pageSize: 100, ...(token ? {pageToken: token} : {})}), 'collectionIds');
            if (!ids.every(segment) || new Set(ids).size !== ids.length) throw new Error('invalid_collection');
            return ids;
        },
        async documents(parent, collection) {
            if (!segment(collection)) throw new Error('invalid_collection');
            const path = `${parent}/${collection}`;
            const rows = await pages(token => {
                const url = new URL(`${base}/${scoped(path)}`);
                url.searchParams.set('pageSize', '100'); url.searchParams.set('showMissing', 'true');
                if (token) url.searchParams.set('pageToken', token);
                return request(url);
            }, 'documents');
            return rows.map(row => {
                const doc = document(row);
                if (!doc || !doc.path.startsWith(`${path}/`) || doc.path.slice(path.length + 1).includes('/')) throw new Error('unexpected_document');
                return doc;
            });
        },
        async account() {
            const response = await request(`https://identitytoolkit.googleapis.com/v1/projects/${project}/accounts:lookup`, {localId: [uid]});
            if (!response) throw new Error('auth_read_failed');
            const users = response.users ?? [];
            if (!Array.isArray(users) || users.length > 1 || (users[0] && users[0].localId !== uid)) throw new Error('unexpected_account');
            if (!users.length) return null;
            const user = users[0];
            const result = pick(user, ['localId', 'email', 'emailVerified', 'displayName', 'photoUrl', 'phoneNumber',
                'disabled', 'createdAt', 'lastLoginAt', 'lastRefreshAt', 'customAttributes']);
            if (user.providerUserInfo !== undefined) {
                if (!Array.isArray(user.providerUserInfo)) throw new Error('invalid_providers');
                result.providerUserInfo = user.providerUserInfo.map(provider => pick(provider,
                    ['providerId', 'rawId', 'federatedId', 'email', 'displayName', 'photoUrl', 'phoneNumber']));
            }
            return result;
        },
    };
}
