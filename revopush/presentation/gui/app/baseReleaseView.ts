import {$, $$} from './dom.js';
import {showToast} from './toast.js';
import {runState} from './runState.js';
import type {BaseReleaseViewModel} from './baseReleaseViewModel.js';
import type {Coverage, Deployment, Platform} from './types.js';

type DropFile = File & { path?: string };

export class BaseReleaseView {
    vm: BaseReleaseViewModel;
    #baseReady = false;

    constructor(vm: BaseReleaseViewModel) {
        this.vm = vm;

        this.#wireDrop('#apkDrop', '#apkPath', '#apkInc', '.apk', 'Android', () =>
            this.#onFilesChanged(),
        );
        this.#wireDrop('#ipaDrop', '#ipaPath', '#ipaInc', '.ipa', 'iOS', () =>
            this.#onFilesChanged(),
        );

        $('#validateBtn').addEventListener('click', () => this.#validate());
        $$<HTMLInputElement>('.baseDep').forEach((cb) =>
            cb.addEventListener('change', () => {
                this.#evaluateValidate();
                this.#evaluateBases();
            }),
        );
        $('#baseRunBtn').addEventListener('click', () => this.#run());

        runState.on('change', () => this.#applyBusy());

        this.#evaluateValidate();
    }

    #selectedPlatforms(): Platform[] {
        const plats: Platform[] = [];
        if (
            this.#fileReady('#apkPath', '.apk') &&
            $<HTMLInputElement>('#apkInc').checked
        )
            plats.push('android');
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
        return this.#selectedPlatforms().includes('android')
            ? $<HTMLInputElement>('#apkPath').value.trim()
            : '';
    }

    #ipaArg(): string {
        return this.#selectedPlatforms().includes('ios')
            ? $<HTMLInputElement>('#ipaPath').value.trim()
            : '';
    }

    #selectedDeployments(): Deployment[] {
        return $$<HTMLInputElement>('.baseDep:checked').map(
            (c) => c.value as Deployment,
        );
    }

    #wireDrop(
        dropId: string,
        inputId: string,
        incId: string,
        ext: string,
        label: string,
        onChange: () => void,
    ): void {
        const drop = $(dropId);
        const input = $<HTMLInputElement>(inputId);
        const inc = $<HTMLInputElement>(incId);

        const isValid = (path: string) =>
            !!path && path.trim().toLowerCase().endsWith(ext);

        const sync = () => {
            const valid = isValid(input.value);
            drop.classList.toggle('has', valid);
            inc.disabled = !valid;
            if (!valid) inc.checked = false;
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

        drop.addEventListener('click', (e: MouseEvent) => {
            if ((e.target as HTMLElement).closest('input[type="text"]')) return;
            if (inc.disabled) return;
            inc.checked = !inc.checked;
            onChange?.();
        });

        inc.addEventListener('change', () => onChange?.());
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
            this.#selectedDeployments().length === 0;
    }

    async #evaluateBases(): Promise<Coverage | null> {
        const plats = this.#selectedPlatforms();
        const deps = this.#selectedDeployments();

        let coverage: Coverage | null = null;
        if (this.vm.validatedVersion && plats.length && deps.length) {
            coverage = await this.vm.baseCoverage(
                this.vm.validatedVersion,
                plats,
                deps,
            );
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
        if (plats.length === 0) {
            showToast('Drop the .apk and/or .ipa first.', 'warn');
            return;
        }
        if (this.#selectedDeployments().length === 0) {
            showToast('Select at least one deployment.', 'warn');
            return;
        }

        runState.begin('base');
        try {
            let res;
            try {
                res = await this.vm.validate(this.#apkArg(), this.#ipaArg(), plats);
            } catch {
                showToast('Validation failed — something went wrong.', 'bad');
                return;
            }
            if (!res.ok) {
                showToast(res.error || 'Binary validation failed.', 'bad');
                return;
            }

            const coverage = await this.#evaluateBases();
            const v = 'v' + res.version;
            if (!coverage) {
                showToast(
                    v + ' validated — pick at least one deployment to continue.',
                    'warn',
                );
            } else if (coverage.covered) {
                showToast(
                    v +
                    ' validated — base release already exists for all ' +
                    coverage.total +
                    ' target(s). Ready for CodePush.',
                );
            } else {
                const missing = coverage.total - coverage.have;
                showToast(
                    v +
                    ' validated — base release needed for ' +
                    missing +
                    ' of ' +
                    coverage.total +
                    ' target(s). Run BasePush next.',
                    'warn',
                );
            }
        } finally {
            runState.end();
        }
    }

    async #run(): Promise<void> {
        const plats = this.#selectedPlatforms();
        const deps = this.#selectedDeployments();
        if (plats.length === 0) {
            showToast('Drop the .apk and/or .ipa first.', 'warn');
            return;
        }
        if (deps.length === 0) {
            showToast('Select at least one deployment.', 'warn');
            return;
        }

        runState.begin('base');
        try {
            const res = await this.vm.run(
                this.#apkArg(),
                this.#ipaArg(),
                this.vm.validatedVersion,
                plats,
                deps,
            );
            if (res.ok) {
                showToast(
                    'Base release complete — all ' +
                    plats.length * deps.length +
                    ' target(s) succeeded.',
                );
            } else {
                showToast('Base release finished with errors.', 'bad');
            }
        } catch {
            showToast('Base release failed — something went wrong.', 'bad');
        } finally {
            runState.end();
            this.#evaluateBases();
        }
    }

    #applyBusy(): void {
        const busy = runState.busy;
        $<HTMLButtonElement>('#validateBtn').disabled =
            busy ||
            this.#selectedPlatforms().length === 0 ||
            this.#selectedDeployments().length === 0;
        $<HTMLButtonElement>('#baseRunBtn').disabled = busy || !this.#baseReady;
        $$<HTMLInputElement>('.baseDep').forEach((c) => (c.disabled = busy));
        $<HTMLInputElement>('#apkInc').disabled =
            busy || !this.#fileReady('#apkPath', '.apk');
        $<HTMLInputElement>('#ipaInc').disabled =
            busy || !this.#fileReady('#ipaPath', '.ipa');
        $('#baseCard').classList.toggle('busy', runState.active === 'base');
    }
}
