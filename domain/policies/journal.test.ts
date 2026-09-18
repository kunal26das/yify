import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);
const {loadTypeScript} = require('../../tests/helpers/load-typescript.cjs');
const policy = loadTypeScript('domain/policies/journal.ts');
const movie = {id: 1, title: 'Example', year: 2024, runtimeMinutes: 90, genres: ['Drama'], posterUrl: null};
const entry = (id = 'entry-a', updatedAt = 10, extra = {}) => ({id, movie, watchedOn: '2026-09-19', rating: 7,
    note: 'Private note', updatedAt, deletedAt: 0, ...extra});
const data = (...entries: ReturnType<typeof entry>[]) => ({entries: Object.fromEntries(entries.map(value => [value.id, value])), clearedAt: 0});

test('journal accepts real dates and half-star ratings but rejects impossible or future dates', () => {
    const now = new Date(2026, 8, 19, 12).getTime();
    assert.equal(policy.validateJournalInput(entry(), now).rating, 7);
    assert.equal(policy.isJournalDate('2024-02-29'), true);
    for (const date of ['2026-02-29', '2026-13-01', '2026-09-31', '1899-12-31', '2026-9-19']) assert.equal(policy.isJournalDate(date), false);
    assert.throws(() => policy.validateJournalInput({...entry(), watchedOn: '2026-09-20'}, now), /date/);
    for (const rating of [0, 11, 1.5, '5', undefined]) assert.throws(() => policy.validateJournalInput({...entry(), rating}, now), /rating/);
    assert.equal(policy.validateJournalInput({...entry(), rating: null}, now).rating, null);
    assert.throws(() => policy.validateJournalInput({...entry(), note: 'x'.repeat(1001)}, now), /1000/);
});

test('journal encoding is bounded in UTF-8 bytes and malformed persisted data is not silently discarded', () => {
    const original = data(entry());
    assert.deepEqual(policy.parseJournalData(policy.encodeJournalData(original)), original);
    assert.equal(policy.journalPayloadBytes('Aé界😀'), 10);
    assert.throws(() => policy.parseJournalData('{broken'), /read/);
    assert.throws(() => policy.parseJournalData(JSON.stringify({...original, version: 2})), /Update/);
    const many = data(...Array.from({length: 300}, (_, index) => entry(`entry-${index}`, 10, {note: '界'.repeat(1000)})));
    assert.throws(() => policy.encodeJournalData(many), /storage limit/);
    assert.throws(() => policy.encodeJournalData(data(...Array.from({length: 501}, (_, index) => entry(`entry-${index}`)))), /storage limit/);
});

test('journal merge preserves concurrent entries, newest revisions and deletion ties independent of merge order', () => {
    const first = data(entry('one', 10), entry('two', 5));
    const second = data(entry('one', 20, {note: 'edited'}), entry('three', 30));
    assert.deepEqual(policy.mergeJournalData(first, second), policy.mergeJournalData(second, first));
    assert.equal(policy.mergeJournalData(first, second).entries.one.note, 'edited');
    const deleted = data(entry('one', 10, {deletedAt: 10, note: ''}));
    assert.equal(policy.journalEntries(policy.mergeJournalData(first, deleted)).some((value: {id: string}) => value.id === 'one'), false);
    assert.deepEqual(policy.mergeJournalData(first, deleted), policy.mergeJournalData(deleted, first));
    assert.deepEqual(policy.mergeJournalData(first, {entries: {}, clearedAt: 10}), {entries: {}, clearedAt: 10});
});

test('movie projection excludes raw catalog fields and unsafe poster URLs', () => {
    const projected = policy.projectJournalMovie({...movie, posterUrls: ['javascript:bad', 'https://example.com/image.jpg'],
        runtimeMinutes: -1, summary: 'unneeded', torrent: 'private'});
    assert.deepEqual(Object.keys(projected).sort(), ['genres', 'id', 'posterUrl', 'runtimeMinutes', 'title', 'year']);
    assert.equal(projected.runtimeMinutes, 0);
    assert.equal(projected.posterUrl, 'https://example.com/image.jpg');
    assert.throws(() => policy.parseJournalData(JSON.stringify({version: 1, clearedAt: 0,
        entries: {constructor: entry('constructor')}})), /read/);
});
