import {$} from './dom.js';
import {showToast} from './toast.js';
import type {LogViewModel} from './logViewModel.js';
import type {LogLine} from './types.js';

export class LogView {
    vm: LogViewModel;
    logEl: HTMLElement;

    constructor(vm: LogViewModel) {
        this.vm = vm;
        this.logEl = $('#log');

        vm.on('line', (line: LogLine) => this.#append(line));
        vm.on('count', (n: number) => this.#updateCount(n));
        vm.on('clear', () => {
            this.logEl.textContent = '';
        });
        vm.on('autoscroll', (on: boolean) => {
            $('#autoscrollBtn').classList.toggle('on', on);
            if (on) this.logEl.scrollTop = this.logEl.scrollHeight;
        });

        $('#autoscrollBtn').addEventListener('click', () => vm.toggleAutoscroll());
        $('#clearLogBtn').addEventListener('click', () => vm.clear());
        $('#copyLogBtn').addEventListener('click', async () => {
            try {
                await navigator.clipboard.writeText(this.logEl.textContent ?? '');
                showToast('Log copied to clipboard.');
            } catch {
                showToast("Couldn't copy log.", 'warn');
            }
        });

        this.#updateCount(vm.count);
    }

    #append(line: LogLine): void {
        const span = document.createElement('span');
        if (line.stream === 'stderr') span.className = 'err';
        else if (line.stream === 'system') span.className = 'sys';

        const tag = line.label ? '[' + line.label + '] ' : '';
        span.textContent = tag + line.text + '\n';
        this.logEl.appendChild(span);
        if (this.vm.autoscroll) this.logEl.scrollTop = this.logEl.scrollHeight;
    }

    #updateCount(n: number): void {
        $('#logCount').textContent = n + (n === 1 ? ' line' : ' lines');
    }
}
