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

    await setDoc(ownDoc, {watchlist: '[]', watchlistUpdatedAt: 1});
    await updateDoc(ownDoc, {watchlistUpdatedAt: 2});
    await assert.rejects(deleteDoc(doc(other, 'users/owner')), denied);
    await assert.rejects(deleteDoc(doc(anonymous, 'users/owner')), denied);
    await assert.rejects(updateDoc(ownDoc, {watchlistUpdatedAt: 'invalid'}), denied);
    await assert.rejects(setDoc(ownDoc, {unexpectedField: true}), denied);
    await assert.rejects(setDoc(doc(owner, 'other/owner'), {watchlist: '[]'}), denied);
    assert.equal((await getDoc(ownDoc)).data().watchlistUpdatedAt, 2);
    await deleteDoc(ownDoc);
    assert.equal((await getDoc(ownDoc)).exists(), false);
});
