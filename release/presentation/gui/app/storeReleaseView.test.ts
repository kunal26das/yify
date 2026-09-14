import assert from 'node:assert/strict';
import {setImmediate} from 'node:timers/promises';
import test from 'node:test';
import {StoreReleaseView} from './storeReleaseView.js';
import type {StoreReleaseViewModel} from './storeReleaseViewModel.js';
import {runState} from './runState.js';
import type {Coverage, StoreReleaseResult, ValidateResult} from './types.js';

class ElementDouble {
    checked = false;
    disabled = false;
    value = '';
    className = '';
    innerHTML = '';
    textContent = '';
    children: ElementDouble[] = [];
    selectors = new Map<string, ElementDouble>();
    listeners = new Map<string, Array<() => unknown>>();
    classList = {
        add() {
        }, remove() {
        }, toggle() {
        }
    };

    addEventListener(name: string, listener: () => unknown) {
        this.listeners.set(name, [...(this.listeners.get(name) ?? []), listener]);
    }

    async dispatch(name: string) {
        for (const listener of this.listeners.get(name) ?? []) await listener();
        await setImmediate();
    }

    querySelector(selector: string): ElementDouble {
        let element = this.selectors.get(selector);
        if (!element) {
            element = new ElementDouble();
            this.selectors.set(selector, element);
        }
        return element;
    }

    appendChild(child: ElementDouble) {
        this.children.push(child);
    }
}

type TestContext = Parameters<NonNullable<Parameters<typeof test>[0]>>[0];

function fixture(t: TestContext, options: {
    validation?: ValidateResult;
    validate?: () => Promise<ValidateResult>;
    coverage?: () => Promise<Coverage>;
    result?: StoreReleaseResult;
} = {}) {
    const page = new ElementDouble();
    const element = (selector: string) => page.querySelector(selector);
    const channel = element('.baseChan');
    channel.checked = true;
    channel.value = 'Production';
    element('#apkInc').checked = true;
    const document = {
        querySelector: element,
        querySelectorAll: (selector: string) => selector === '.baseChan:checked'
            ? channel.checked ? [channel] : []
            : selector === '.baseChan' ? [channel] : [],
        createElement: () => new ElementDouble(),
    };
    const oldDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
    const oldAnimationFrame = Object.getOwnPropertyDescriptor(globalThis, 'requestAnimationFrame');
    Object.defineProperty(globalThis, 'document', {value: document, configurable: true});
    Object.defineProperty(globalThis, 'requestAnimationFrame', {value: (fn: () => void) => fn(), configurable: true});
    const listeners = new Set<() => void>();
    t.mock.method(runState, 'on', (_event: string, listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    });
    t.mock.method(runState, 'emit', () => {
        for (const listener of listeners) listener();
    });
    const calls: unknown[][] = [];
    const vm = {
        validatedVersion: '',
        invalidate() {
            this.validatedVersion = '';
        },
        async validate() {
            const result = options.validate ? await options.validate()
                : options.validation ?? {ok: true, version: '1.8.1'};
            if (result.ok) this.validatedVersion = result.version;
            return result;
        },
        releaseCoverage: options.coverage ?? (async () => {
            throw new Error('expo-updates is missing');
        }),
        async run(...args: unknown[]) {
            calls.push(args);
            return options.result ?? {ok: false, steps: []};
        },
    };
    new StoreReleaseView(vm as unknown as StoreReleaseViewModel);
    t.after(() => {
        runState.end();
        if (oldDocument) Object.defineProperty(globalThis, 'document', oldDocument);
        else Reflect.deleteProperty(globalThis, 'document');
        if (oldAnimationFrame) Object.defineProperty(globalThis, 'requestAnimationFrame', oldAnimationFrame);
        else Reflect.deleteProperty(globalThis, 'requestAnimationFrame');
    });
    const messages = () => element('#toasts').children.map((toast) => toast.querySelector('.tmsg').textContent);
    return {element, calls, messages, vm};
}

test('missing advisory coverage permits the validated store run and preserves its failure result', async (t) => {
    const f = fixture(t);
    await f.element('#validateBtn').dispatch('click');
    assert.equal(f.element('#baseRunBtn').disabled, false);
    assert.deepEqual(f.messages(), ['Release history is unavailable. Release will prepare dependencies and check again before publishing.']);
    await f.element('#baseRunBtn').dispatch('click');
    assert.deepEqual(f.calls, [['', '', '1.8.1', ['android'], ['Production']]]);
    assert.ok(f.messages().includes('Store release finished with errors.'));
    assert.equal(f.messages().some((message) => /Queued on Expo|Store release complete/.test(message)), false);
});

test('known released coverage and invalid release inputs keep the release button disabled', async (t) => {
    const f = fixture(t, {coverage: async () => ({have: 1, total: 1, covered: true})});
    await f.element('#validateBtn').dispatch('click');
    assert.equal(f.element('#baseRunBtn').disabled, true);
    assert.deepEqual(f.calls, []);
    f.element('#apkInc').checked = false;
    await f.element('#apkInc').dispatch('change');
    assert.equal(f.element('#baseRunBtn').disabled, true);
    assert.equal(f.element('#validateBtn').disabled, true);
});

test('failed input validation never reaches advisory coverage or enables release', async (t) => {
    const f = fixture(t, {
        validation: {ok: false, version: '', error: 'Invalid APK'},
        coverage: async () => assert.fail('Coverage must not run for invalid inputs'),
    });
    await f.element('#validateBtn').dispatch('click');
    assert.equal(f.element('#baseRunBtn').disabled, true);
    assert.deepEqual(f.messages(), ['Invalid APK']);
});

test('a delayed coverage failure cannot enable release after the inputs change', async (t) => {
    let rejectCoverage: (error: Error) => void = () => {
    };
    const f = fixture(t, {
        coverage: () => new Promise((_resolve, reject) => {
            rejectCoverage = reject;
        })
    });
    const validating = f.element('#validateBtn').dispatch('click');
    await setImmediate();
    f.element('#apkPath').value = '/changed.apk';
    await f.element('#apkPath').dispatch('input');
    rejectCoverage(new Error('Unavailable'));
    await validating;
    assert.equal(f.vm.validatedVersion, '');
    assert.equal(f.element('#baseRunBtn').disabled, true);
    assert.deepEqual(f.calls, []);
});

test('a validation response for old inputs cannot enable the coverage recovery path', async (t) => {
    let completeValidation: (result: ValidateResult) => void = () => {
    };
    const f = fixture(t, {
        validate: () => new Promise((resolve) => {
            completeValidation = resolve;
        }),
        coverage: async () => assert.fail('Stale validation must not reach coverage'),
    });
    const validating = f.element('#validateBtn').dispatch('click');
    await setImmediate();
    f.element('#apkPath').value = '/changed.apk';
    await f.element('#apkPath').dispatch('input');
    completeValidation({ok: true, version: '1.8.1'});
    await validating;
    assert.equal(f.vm.validatedVersion, '');
    assert.equal(f.element('#baseRunBtn').disabled, true);
    assert.deepEqual(f.calls, []);
});
