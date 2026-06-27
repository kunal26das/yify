import {$, $$} from './dom.js';
import {showToast} from './toast.js';
import {runState} from './runState.js';
import type {AuthViewModel} from './authViewModel.js';
import type {CodePushViewModel} from './codePushViewModel.js';
import type {Deployment, Info, Platform} from './types.js';

export class CodePushView {
    vm: CodePushViewModel;

    constructor(vm: CodePushViewModel, authVm: AuthViewModel) {
        this.vm = vm;

        $$<HTMLInputElement>('.cpPlat, .cpDep').forEach((cb) =>
            cb.addEventListener('change', () => this.#evaluate()),
        );
        $('#cpRunBtn').addEventListener('click', () => this.#run());

        $('#cpVersion').addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (!$<HTMLButtonElement>('#cpRunBtn').disabled) this.#run();
        });

        runState.on('change', () => this.#applyBusy());

        authVm.on('change', ({info}: { info: Info }) =>
            this.#seedVersion(info.version),
        );

        this.#evaluate();
    }

    #selectedPlatforms(): Platform[] {
        return $$<HTMLInputElement>('.cpPlat:checked').map(
            (c) => c.value as Platform,
        );
    }

    #selectedDeployments(): Deployment[] {
        return $$<HTMLInputElement>('.cpDep:checked').map(
            (c) => c.value as Deployment,
        );
    }

    #ready(): boolean {
        return (
            this.#selectedPlatforms().length > 0 &&
            this.#selectedDeployments().length > 0
        );
    }

    #seedVersion(version: string): void {
        if (version) $<HTMLInputElement>('#cpVersion').value = version;
    }

    #evaluate(): void {
        if (runState.busy) return;
        $<HTMLButtonElement>('#cpRunBtn').disabled = !this.#ready();
    }

    async #run(): Promise<void> {
        const platforms = this.#selectedPlatforms();
        const deployments = this.#selectedDeployments();
        const version = $<HTMLInputElement>('#cpVersion').value.trim();

        if (platforms.length === 0) {
            showToast('Select at least one platform.', 'warn');
            return;
        }
        if (deployments.length === 0) {
            showToast('Select at least one deployment.', 'warn');
            return;
        }
        if (!version) {
            showToast('Enter a target binary version.', 'warn');
            return;
        }

        runState.begin('codepush');
        try {
            const res = await this.vm.run(platforms, deployments, version);
            const {blocked, total, unchanged, released, ok} =
                this.vm.summarize(res);
            if (blocked.length) {
                showToast(
                    'CodePush blocked — no base release for ' + blocked.join(', ') + '.',
                    'warn',
                );
            } else if (ok) {
                if (unchanged === total) {
                    showToast(
                        'Already up to date — all ' +
                        total +
                        ' target(s) match the current release.',
                    );
                } else if (unchanged > 0) {
                    showToast(
                        'CodePush complete — ' +
                        released +
                        ' released, ' +
                        unchanged +
                        ' unchanged.',
                    );
                } else {
                    showToast(
                        'CodePush complete — all ' + total + ' target(s) succeeded.',
                    );
                }
            } else {
                showToast('CodePush finished with errors.', 'bad');
            }
        } catch {
            showToast('CodePush failed — something went wrong.', 'bad');
        } finally {
            runState.end();
        }
    }

    #applyBusy(): void {
        const busy = runState.busy;
        $<HTMLButtonElement>('#cpRunBtn').disabled = busy || !this.#ready();
        $<HTMLInputElement>('#cpVersion').disabled = busy;
        $$<HTMLInputElement>('.cpPlat, .cpDep').forEach((c) => (c.disabled = busy));
        $('#cpCard').classList.toggle('busy', runState.active === 'codepush');
    }
}
