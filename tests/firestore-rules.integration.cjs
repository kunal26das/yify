// Run against a local emulator started with this repository's firestore.rules:
// FIRESTORE_EMULATOR_HOST=127.0.0.1:8080 node --test tests/firestore-rules.integration.cjs
const assert = require('node:assert/strict');
const {test} = require('node:test');
const {initializeApp, deleteApp} = require('firebase/app');
const {
    getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc,
    deleteDoc, getDoc, terminate, setLogLevel,
} = require('firebase/firestore');

test('Firestore rules allow owner deletion while preserving access and payload restrictions', async (t) => {
    const endpoint = process.env.FIRESTORE_EMULATOR_HOST;
    assert.ok(endpoint, 'FIRESTORE_EMULATOR_HOST must point to a local emulator');
    const address = new URL(`http://${endpoint}`);
    assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(address.hostname), 'Use only a local emulator');
    setLogLevel('silent');
    const apps = [];
    const clients = [];
    function client(uid) {
        const app = initializeApp({projectId: 'demo-yify-rules'}, `rules-${uid ?? 'anonymous'}-${Date.now()}`);
        const db = getFirestore(app);
        connectFirestoreEmulator(db, address.hostname, Number(address.port), uid ? {mockUserToken: {sub: uid}} : undefined);
        apps.push(app);
        clients.push(db);
        return db;
    }
    t.after(async () => {
        await Promise.all(clients.map(terminate));
        await Promise.all(apps.map(deleteApp));
    });
    const owner = client('owner');
    const other = client('other');
    const anonymous = client(null);
    const ownDoc = doc(owner, 'users/owner');
    const denied = (error) => error.code === 'permission-denied';

    const journalDoc = doc(owner, 'journals/owner');
    await setDoc(journalDoc, {payload: '{"version":1,"entries":{},"clearedAt":0}', updatedAt: 1, deleting: false});
    assert.equal((await getDoc(journalDoc)).data().updatedAt, 1);
    await updateDoc(journalDoc, {payload: 'x'.repeat(400000), updatedAt: 2});
    await assert.rejects(updateDoc(journalDoc, {payload: 'x'.repeat(400001)}), denied);
    await assert.rejects(updateDoc(journalDoc, {payload: '界'.repeat(133334)}), denied);
    await assert.rejects(updateDoc(journalDoc, {payload: {note: 'private'}}), denied);
    await assert.rejects(updateDoc(journalDoc, {updatedAt: 'invalid'}), denied);
    await assert.rejects(updateDoc(journalDoc, {unexpected: true}), denied);
    for (const client of [other, anonymous]) {
        await assert.rejects(getDoc(doc(client, 'journals/owner')), denied);
        await assert.rejects(setDoc(doc(client, 'journals/owner'), {payload: '{}', updatedAt: 1, deleting: false}), denied);
        await assert.rejects(deleteDoc(doc(client, 'journals/owner')), denied);
    }
    await assert.rejects(updateDoc(journalDoc, {deleting: true}), denied);
    await updateDoc(journalDoc, {payload: '{"version":1,"clearedAt":0,"entries":{}}', deleting: true});
    await assert.rejects(updateDoc(journalDoc, {payload: 'old private notes', deleting: false}), denied);
    await assert.rejects(setDoc(journalDoc, {payload: '{}', updatedAt: 3, deleting: false}), denied);
    await assert.rejects(deleteDoc(journalDoc), denied);
    assert.equal((await getDoc(journalDoc)).data().payload, '{"version":1,"clearedAt":0,"entries":{}}');

    await setDoc(ownDoc, {watchlist: '[]', watchlistUpdatedAt: 1});
    await updateDoc(ownDoc, {watchlistUpdatedAt: 2});
    await updateDoc(ownDoc, {library: '{}', libraryUpdatedAt: 3});
    await updateDoc(ownDoc, {watchlist: '[1]'});
    await updateDoc(ownDoc, {availabilityAlerts: '{"version":1,"devices":[]}'});
    await updateDoc(ownDoc, {availabilityAlerts: 'x'.repeat(16000)});
    await updateDoc(ownDoc, {availabilityAlerts: '{"version":1,"devices":[]}'});
    await assert.rejects(updateDoc(ownDoc, {availabilityAlerts: 'x'.repeat(16001)}), denied);
    await assert.rejects(updateDoc(ownDoc, {availabilityAlerts: {devices: []}}), denied);
    await assert.rejects(updateDoc(doc(other, 'users/owner'), {availabilityAlerts: '{}'}), denied);
    await assert.rejects(updateDoc(doc(anonymous, 'users/owner'), {availabilityAlerts: '{}'}), denied);
    await assert.rejects(getDoc(doc(other, 'users/owner')), denied);
    await assert.rejects(getDoc(doc(anonymous, 'users/owner')), denied);
    await assert.rejects(setDoc(doc(owner, 'availabilityAlertState/owner'), {sent: true}), denied);
    await assert.rejects(getDoc(doc(owner, 'availabilityAlertState/owner')), denied);
    for (const client of [owner, other, anonymous]) {
        await assert.rejects(getDoc(doc(client, 'availabilityAlertState/_cache')), denied);
        await assert.rejects(setDoc(doc(client, 'availabilityAlertState/_cache'), {payload: '{}'}), denied);
        await assert.rejects(deleteDoc(doc(client, 'availabilityAlertState/owner')), denied);
    }
    assert.equal((await getDoc(ownDoc)).data().library, '{}');
    await assert.rejects(updateDoc(ownDoc, {library: 'x'.repeat(300001)}), denied);
    await assert.rejects(updateDoc(ownDoc, {libraryUpdatedAt: 'invalid'}), denied);
    await assert.rejects(updateDoc(doc(other, 'users/owner'), {library: '{}'}), denied);
    await assert.rejects(deleteDoc(doc(other, 'users/owner')), denied);
    await assert.rejects(deleteDoc(doc(anonymous, 'users/owner')), denied);
    await assert.rejects(updateDoc(ownDoc, {watchlistUpdatedAt: 'invalid'}), denied);
    await assert.rejects(setDoc(ownDoc, {unexpectedField: true}), denied);
    await assert.rejects(setDoc(doc(owner, 'other/owner'), {watchlist: '[]'}), denied);
    assert.equal((await getDoc(ownDoc)).data().watchlistUpdatedAt, 2);
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    const token = `${encode({alg: 'none', typ: 'JWT'})}.${encode({sub: 'owner', user_id: 'owner',
        aud: 'demo-yify-rules', iss: 'https://securetoken.google.com/demo-yify-rules', iat: 0, exp: 4102444800,
        firebase: {sign_in_provider: 'custom', identities: {}}})}.`;
    const restUrl = `http://${endpoint}/v1/projects/demo-yify-rules/databases/(default)/documents/users/owner`;
    const headers = {Authorization: `Bearer ${token}`, 'Content-Type': 'application/json'};
    const initialRead = await fetch(restUrl, {headers});
    assert.equal(initialRead.ok, true);
    const {updateTime} = await initialRead.json();
    const commitUrl = `http://${endpoint}/v1/projects/demo-yify-rules/databases/(default)/documents:commit`;
    const commit = (payload, currentDocument) => fetch(commitUrl, {method: 'POST', headers,
        body: JSON.stringify({writes: [{update: {name: 'projects/demo-yify-rules/databases/(default)/documents/users/owner',
            fields: {library: {stringValue: payload}}}, updateMask: {fieldPaths: ['library']}, currentDocument}]})});
    const updated = await commit('{"watched":{"1":true}}', {updateTime});
    assert.equal(updated.ok, true, await updated.text());
    const stale = await commit('{"watched":{"2":true}}', {updateTime});
    assert.equal(stale.ok, false);
    assert.equal((await stale.json()).error.status, 'FAILED_PRECONDITION');
    assert.equal((await getDoc(ownDoc)).data().library, '{"watched":{"1":true}}');
    const enrollmentVersion = (await (await fetch(restUrl, {headers})).json()).updateTime;
    const enrollment = JSON.stringify({version: 1, devices: [{id: '01234567-89ab-cdef', kind: 'expo',
        token: 'ExponentPushToken[fakerules012345]', country: 'IN', timeZone: 'Asia/Kolkata', updatedAt: 1}]});
    const enroll = currentDocument => fetch(commitUrl, {method: 'POST', headers,
        body: JSON.stringify({writes: [{update: {name: 'projects/demo-yify-rules/databases/(default)/documents/users/owner',
            fields: {availabilityAlerts: {stringValue: enrollment}}},
            updateMask: {fieldPaths: ['availabilityAlerts']}, currentDocument}]})});
    assert.equal((await enroll({updateTime: enrollmentVersion})).ok, true);
    assert.equal((await getDoc(ownDoc)).data().library, '{"watched":{"1":true}}');
    assert.equal((await getDoc(ownDoc)).data().watchlist, '[1]');
    assert.equal((await enroll({updateTime: enrollmentVersion})).ok, false);
    await deleteDoc(ownDoc);
    assert.equal((await getDoc(ownDoc)).exists(), false);
    assert.equal((await commit('{}', {exists: false})).ok, true);
    assert.equal((await commit('{"unexpected":true}', {exists: false})).ok, false);
    assert.equal((await getDoc(ownDoc)).data().library, '{}');
    await deleteDoc(ownDoc);
});
