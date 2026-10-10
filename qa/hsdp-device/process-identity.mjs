import assert from 'node:assert/strict';
export function installedApplicationUid(packageDump) {
    const ids = [...packageDump.matchAll(/^\s*(?:userId|appId)=(\d+)$/gm)].map(match => Number(match[1]));
    assert(ids.length > 0 && ids.every(id => Number.isSafeInteger(id) && id >= 10000 && id === ids[0]),
        'Invalid or ambiguous installed application UID');
    return ids[0];
}
export function verifyProcessIdentity(value, expected) {
    assert.equal(value.evidenceVersion, 1);
    for (const key of ['sourceSha', 'hsdpVersion', 'packageName', 'uid']) assert.equal(value[key], expected[key], `Unexpected identity ${key}`);
    assert(Number.isInteger(value.uid) && value.uid >= 10000, 'Not an application UID');
    assert.equal(value.packageUid, value.uid, 'Package UID mismatch');
    assert(Number.isInteger(value.pid) && value.pid > 0, 'Missing app PID');
    assert(Array.isArray(value.groups) && value.groups.every(group => Number.isInteger(group) && group >= 0), 'Invalid actual process groups');
    assert(!value.groups.includes(3003), 'Actual app process has Internet group');
    assert.equal(value.internetPermission, -1, 'Actual app process has Internet permission');
    assert.deepEqual(value.requestedPermissions, [], 'Unexpected requested permission');
    assert.equal(value.sharedUserId, null, 'Unexpected shared app UID');
    for (const key of ['procUid', 'procGid']) {
        assert.equal(typeof value[key], 'string');
        const ids=value[key].trim().split(/\s+/);
        assert.equal(ids.length, 4);
        assert(ids.every(id => /^\d+$/.test(id) && Number(id) === value.uid), 'Unexpected actual process IDs');
    }
    assert.equal(typeof value.procGroups, 'string');
    assert.deepEqual(value.procGroups.trim() ? value.procGroups.trim().split(/\s+/).map(Number) : [], value.groups);
    assert.equal(value.socketCreationProbes?.length, 4, 'Incomplete in-process socket probes');
    const seen=new Set();
    for (const probe of value.socketCreationProbes) {
        assert([2,10].includes(probe.family) && [1,2].includes(probe.type), 'Unexpected socket family/type');
        const key=`${probe.family}:${probe.type}`;assert(!seen.has(key),'Duplicate socket probe');seen.add(key);
        assert.equal(probe.created, false, 'Actual app process created Internet socket');
        assert([1,13].includes(probe.errno), 'Socket probe did not fail with permission denial');
        assert.equal(probe.noAddressOrTraffic, true);
    }
    return value;
}
