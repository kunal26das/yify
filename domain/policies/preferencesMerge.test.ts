import assert from 'node:assert/strict';
import test from 'node:test';

import {mergeSection, readSection, type SectionGuards} from './preferencesMerge.ts';

interface Section {
    autoplayTrailers: boolean;
    quietStartHour: number;
}

const guards: SectionGuards<Section> = {
    autoplayTrailers: (value) => typeof value === 'boolean',
    quietStartHour: (value) => typeof value === 'number' && Number.isInteger(value),
};

test('an absent section is no opinion and keeps the local value by identity', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    assert.equal(readSection<Section>(undefined, guards), undefined);
    assert.strictEqual(mergeSection(local, undefined), local);
});

test('a partial section preserves the fields it does not mention', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    const incoming = readSection<Section>({autoplayTrailers: false}, guards);
    assert.deepEqual(mergeSection(local, incoming), {autoplayTrailers: false, quietStartHour: 22});
});

test('invalid values are dropped rather than coerced', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    const incoming = readSection<Section>({autoplayTrailers: 'yes', quietStartHour: null}, guards);
    assert.equal(incoming, undefined);
    assert.deepEqual(mergeSection(local, incoming), local);
});

test('a single invalid field does not discard its valid siblings', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    const incoming = readSection<Section>({autoplayTrailers: 'yes', quietStartHour: 6}, guards);
    assert.deepEqual(incoming, {quietStartHour: 6});
    assert.deepEqual(mergeSection(local, incoming), {autoplayTrailers: true, quietStartHour: 6});
});

test('a field explicitly set back to its default still propagates', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    const incoming = readSection<Section>({autoplayTrailers: false, quietStartHour: 22}, guards);
    assert.deepEqual(mergeSection(local, incoming), {autoplayTrailers: false, quietStartHour: 22});
});

test('a complete remote section wins outright', () => {
    const local: Section = {autoplayTrailers: true, quietStartHour: 22};
    const remote: Section = {autoplayTrailers: false, quietStartHour: 3};
    const incoming = readSection<Section>(JSON.parse(JSON.stringify(remote)), guards);
    assert.deepEqual(mergeSection(local, incoming), remote);
});

test('arrays and primitives are not sections', () => {
    assert.equal(readSection<Section>([1, 2], guards), undefined);
    assert.equal(readSection<Section>('playback', guards), undefined);
    assert.equal(readSection<Section>(null, guards), undefined);
});
