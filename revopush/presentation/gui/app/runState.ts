import {Emitter} from './emitter.js';
import type {OperationType} from './types.js';

class RunState extends Emitter {
    #active: OperationType | null = null;

    get active(): OperationType | null {
        return this.#active;
    }

    get busy(): boolean {
        return this.#active !== null;
    }

    begin(which: OperationType): void {
        this.#active = which;
        this.emit('change', this.#active);
    }

    end(): void {
        this.#active = null;
        this.emit('change', this.#active);
    }
}

export const runState = new RunState();
