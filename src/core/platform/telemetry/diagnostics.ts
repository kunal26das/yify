import {crashNative} from './sentry';

export type DiagnosticKind = 'js_fatal' | 'native_java' | 'native_ndk';

export const DIAGNOSTICS_ENABLED: boolean = process.env.EXPO_PUBLIC_DIAGNOSTICS === '1';
export const JS_FATAL_MESSAGE = 'yify-sentry-js-fatal';

export function triggerDiagnostic(kind: DiagnosticKind): void {
  if (!DIAGNOSTICS_ENABLED) return;
  if (kind === 'js_fatal') {
    setTimeout(() => {
      throw new Error(JS_FATAL_MESSAGE);
    }, 0);
    return;
  }
  crashNative();
}
