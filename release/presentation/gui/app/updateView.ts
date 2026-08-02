import {$, $$} from './dom.js';
import {showToast} from './toast.js';
import {errMessage} from './errMessage.js';
import {runState} from './runState.js';
import type {AuthViewModel} from './authViewModel.js';
import type {UpdateViewModel} from './updateViewModel.js';
import type {Channel, Info, Platform} from './types.js';

export class UpdateView {
    vm: UpdateViewModel;

    constructor(vm: UpdateViewModel, authVm: AuthViewModel) {
        this.vm = vm;

        $$<HTMLInputElement>('.cpPlat, .cpChan').forEach((cb) =>
            cb.addEventListener('change', () => this.#evaluate()),
        );
        $('#cpRunBtn').addEventListener('click', () => this.#run());

        $('#cpMessage').addEventListener('keydown', (e: KeyboardEvent) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (!$<HTMLButtonElement>('#cpRunBtn').disabled) this.#run();
        });

        runState.on('change', () => this.#applyBusy());

        authVm.on('change', ({info}: { info: Info }) =>
            this.#seedMessage(info.branch),
        );

        this.#evaluate();
    }

    #selectedPlatforms(): Platform[] {
        return $$<HTMLInputElement>('.cpPlat:checked').map(
            (c) => c.value as Platform,
        );
    }

    #selectedChannels(): Channel[] {
        return $$<HTMLInputElement>('.cpChan:checked').map(
            (c) => c.value as Channel,
        );
    }

    #ready(): boolean {
        return (
            this.#selectedPlatforms().length > 0 &&
            this.#selectedChannels().length > 0
        );
    }

    #seedMessage(branch: string): void {
        const field = $<HTMLInputElement>('#cpMessage');
        if (branch && !field.value) field.value = branch;
    }

    #evaluate(): void {
        if (runState.busy) return;
        $<HTMLButtonElement>('#cpRunBtn').disabled = !this.#ready();
    }

    async #run(): Promise<void> {
        const platforms = this.#selectedPlatforms();
        const channels = this.#selectedChannels();
        const message = $<HTMLInputElement>('#cpMessage').value.trim();

        if (platforms.length === 0) {
            showToast('Select at least one platform.', 'warn');
            return;
        }
        if (channels.length === 0) {
            showToast('Select at least one channel.', 'warn');
            return;
        }
        if (!message) {
            showToast('Enter an update message.', 'warn');
            return;
        }

        runState.begin('update');
        try {
            const res = await this.vm.run(platforms, channels, message);
            const {blocked, total, released, ok} = this.vm.summarize(res);
            if (blocked.length) {
                showToast(
                    'Update blocked — no store release for ' +
                    blocked.join(', ') +
                    '.',
                    'warn',
                );
            } else if (ok) {
                showToast(
                    'Update published — all ' + total + ' target(s) succeeded.',
                );
            } else {
                showToast('Update finished with errors.', 'bad');
            }
        } catch (e) {
            showToast(errMessage(e), 'bad');
        } finally {
            runState.end();
        }
    }

    #applyBusy(): void {
        const busy = runState.busy;
        $<HTMLButtonElement>('#cpRunBtn').disabled = busy || !this.#ready();
        $<HTMLInputElement>('#cpMessage').disabled = busy;
        $$<HTMLInputElement>('.cpPlat, .cpChan').forEach(
            (c) => (c.disabled = busy),
        );
        $('#cpCard').classList.toggle('busy', runState.active === 'update');
    }
}
