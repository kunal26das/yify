import {Emitter} from './emitter.js';
import {bridge} from './bridge.js';
import type {LogLine} from './types.js';

export class LogViewModel extends Emitter {
    count = 0;
    autoscroll = true;

    start(): void {
        bridge.onLog((line: LogLine) => {
            this.count++;
            this.emit('line', line);
            this.emit('count', this.count);
        });
    }

    clear(): void {
        this.count = 0;
        this.emit('clear');
        this.emit('count', this.count);
    }

    toggleAutoscroll(): void {
        this.autoscroll = !this.autoscroll;
        this.emit('autoscroll', this.autoscroll);
    }
}
