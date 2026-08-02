import {$, $$} from './dom.js';
import {showToast} from './toast.js';
import {errMessage} from './errMessage.js';
import {runState} from './runState.js';
import type {StoreReleaseViewModel} from './storeReleaseViewModel.js';
import type {Coverage, Channel, Platform} from './types.js';

type DropFile = File & { path?: string };

export class StoreReleaseView {
    vm: StoreReleaseViewModel;
    #baseReady = false;
    constructor(vm: StoreReleaseViewModel) {
        this.vm = vm;

        this.#apkSync = this.#wireDrop(
            '#apkDrop',
            '#apkPath',
            '#apkInc',
            '.apk',
            'Android',
            () => this.#onFilesChanged(),
            () => true,
        );
        this.#wireDrop('#ipaDrop', '#ipaPath', '#ipaInc', '.ipa', 'iOS', () =>
            this.#onFilesChanged(),
        );

        $('#validateBtn').addEventListener('click', () => this.#validate());
        $$<HTMLInputElement>('.baseChan').forEach((cb) =>
            cb.addEventListener('change', () => {
                this.#apkSync();
                this.#evaluateValidate();
                this.#evaluateCoverage();
            }),
        );
        $('#baseRunBtn').addEventListener('click', () => this.#run());

        runState.on('change', () => this.#applyBusy());

        this.#evaluateValidate();
    }

    #apkSync: () => void = () => {
    };

    #productionSelected(): boolean {
        return this.#selectedChannels().includes('Production');
    }

    #selectedPlatforms(): Platform[] {
        const plats: Platform[] = [];
        if ($<HTMLInputElement>('#apkInc').checked) plats.push('android');
        if (
            this.#fileReady('#ipaPath', '.ipa') &&
            $<HTMLInputElement>('#ipaInc').checked
        )
            plats.push('ios');
        return plats;
    }

    #fileReady(inputId: string, ext: string): boolean {
        const v = $<HTMLInputElement>(inputId).value.trim().toLowerCase();
        return !!v && v.endsWith(ext);
    }

    #apkArg(): string {
        return this.#selectedPlatforms().includes('android') &&
        this.#fileReady('#apkPath', '.apk')
            ? $<HTMLInputElement>('#apkPath').value.trim()
            : '';
    }

    #ipaArg(): string {
        return this.#selectedPlatforms().includes('ios')
            ? $<HTMLInputElement>('#ipaPath').value.trim()
            : '';
    }

    #selectedChannels(): Channel[] {
        return $$<HTMLInputElement>('.baseChan:checked').map(
            (c) => c.value as Channel,
        );
    }

    #wireDrop(
        dropId: string,
        inputId: string,
        incId: string,
        ext: string,
        label: string,
        onChange: () => void,
        allowWithoutFile?: () => boolean,
    ): () => void {
        const drop = $(dropId);
        const input = $<HTMLInputElement>(inputId);
        const inc = $<HTMLInputElement>(incId);

        const isValid = (path: string) =>
            !!path && path.trim().toLowerCase().endsWith(ext);

        const sync = () => {
            const valid = isValid(input.value);
            const allow = valid || (allowWithoutFile?.() ?? false);
            inc.disabled = !allow;
            if (!allow) inc.checked = false;
            onChange?.();
        };

        const reject = () =>
            showToast(
                'That isn’t a ' + ext + ' file — drop the ' + label + ' build.',
                'warn',
            );

        drop.addEventListener('dragover', (e: DragEvent) => {
            e.preventDefault();
            drop.classList.add('over');
        });
        drop.addEventListener('dragleave', () => drop.classList.remove('over'));
        drop.addEventListener('drop', (e: DragEvent) => {
            e.preventDefault();
            drop.classList.remove('over');
            const file = e.dataTransfer?.files[0] as DropFile | undefined;
            if (!file) return;
            const path = file.path || file.name || '';
            if (!isValid(path)) {
                reject();
                return;
            }
            input.value = file.path || path;
            inc.checked = true;
            sync();
        });

        input.addEventListener('input', () => {
            if (isValid(input.value)) inc.checked = true;
            sync();
        });
        input.addEventListener('change', () => {
            const v = input.value.trim();
            if (v && !isValid(v)) reject();
        });

        inc.addEventListener('change', () => onChange?.());

        return sync;
    }

    #onFilesChanged(): void {
        const wasValidated = !!this.vm.validatedVersion;
        this.vm.invalidate();
        this.#baseReady = false;
        $<HTMLButtonElement>('#baseRunBtn').disabled = true;
        this.#evaluateValidate();
        if (wasValidated) {
            showToast('Files changed — click Validate again.', 'warn');
        }
    }

    #evaluateValidate(): void {
        if (runState.busy) return;
        $<HTMLButtonElement>('#validateBtn').disabled =
            this.#selectedPlatforms().length === 0 ||
            this.#selectedChannels().length === 0;
    }

    async #evaluateCoverage(): Promise<Coverage | null> {
        const plats = this.#selectedPlatforms();
        const chans = this.#selectedChannels();

        let coverage: Coverage | null = null;
        if (this.vm.validatedVersion && plats.length && chans.length) {
            coverage = await this.vm.releaseCoverage(plats, chans);
        }

        this.#baseReady = !!coverage && !coverage.covered;
        if (!runState.busy)
            $<HTMLButtonElement>('#baseRunBtn').disabled = !this.#baseReady;
        return coverage;
    }

    async #validate(): Promise<void> {
        this.vm.invalidate();
        this.#baseReady = false;
        $<HTMLButtonElement>('#baseRunBtn').disabled = true;

        const plats = this.#selectedPlatforms();
        const chans = this.#selectedChannels();
        if (plats.length === 0) {
            showToast('Drop the .apk and/or .ipa first.', 'warn');
            return;
        }
        if (chans.length === 0) {
            showToast('Select at least one channel.', 'warn');
            return;
        }

        runState.begin('store');
        try {
            let res;
            try {
                res = await this.vm.validate(
                    this.#apkArg(),
                    this.#ipaArg(),
                    plats,
                );
            } catch (e) {
                showToast(errMessage(e), 'bad');
                return;
            }
            if (!res.ok) {
                showToast(res.error || 'Binary validation failed.', 'bad');
                return;
            }

            const coverage = await this.#evaluateCoverage();
            const v = 'v' + res.version;
            if (!coverage) {
                showToast(
                    v + ' validated — pick at least one channel to continue.',
                    'warn',
                );
            } else if (coverage.covered) {
                showToast(
                    v +
                    ' validated — this runtime version is already released on all ' +
                    coverage.total +
                    ' target(s). Ready for EAS Update.',
                );
            } else {
                const missing = coverage.total - coverage.have;
                showToast(
                    v +
                    ' validated — a store release is needed for ' +
                    missing +
                    ' of ' +
                    coverage.total +
                    ' target(s). Run Release next.',
                    'warn',
                );
            }
        } finally {
            runState.end();
        }
    }

    async #run(): Promise<void> {
        const plats = this.#selectedPlatforms();
        const chans = this.#selectedChannels();
        if (plats.length === 0) {
            showToast('Drop the .apk and/or .ipa first.', 'warn');
            return;
        }
        if (chans.length === 0) {
            showToast('Select at least one channel.', 'warn');
            return;
        }

        runState.begin('store');
        try {
            const res = await this.vm.run(
                this.#apkArg(),
                this.#ipaArg(),
                this.vm.validatedVersion,
                plats,
                chans,
            );
            if (res.ok) {
                showToast(
                    'Store release complete — all ' +
                    plats.length * chans.length +
                    ' target(s) succeeded.',
                );
            } else {
                showToast('Store release finished with errors.', 'bad');
            }
        } catch (e) {
            showToast(errMessage(e), 'bad');
        } finally {
            runState.end();
            this.#evaluateCoverage();
        }
    }

    #applyBusy(): void {
        const busy = runState.busy;
        $<HTMLButtonElement>('#validateBtn').disabled =
            busy ||
            this.#selectedPlatforms().length === 0 ||
            this.#selectedChannels().length === 0;
        $<HTMLButtonElement>('#baseRunBtn').disabled = busy || !this.#baseReady;
        $$<HTMLInputElement>('.baseChan').forEach((c) => (c.disabled = busy));
        $<HTMLInputElement>('#apkInc').disabled = busy;
        $<HTMLInputElement>('#ipaInc').disabled =
            busy || !this.#fileReady('#ipaPath', '.ipa');
        $('#baseCard').classList.toggle('busy', runState.active === 'store');
    }
}
