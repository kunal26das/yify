import type {DiagnosticAttributes, DiagnosticSpan, Diagnostics} from '@/domain';

const SPAN: DiagnosticSpan = Object.freeze({finish() {}, fail() {}});

export class NoopDiagnostics implements Diagnostics {
    async trace<T>(_operation: string, work: () => Promise<T>, _attributes?: DiagnosticAttributes): Promise<T> {
        return work();
    }

    start(): DiagnosticSpan { return SPAN; }
    capture(): undefined { return undefined; }
    event(): void {}
    async showFeedback(): Promise<boolean> { return false; }
}

export const NOOP_DIAGNOSTICS: Diagnostics = Object.freeze(new NoopDiagnostics());
