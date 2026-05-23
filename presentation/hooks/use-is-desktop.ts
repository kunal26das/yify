import {useSyncExternalStore} from 'react';

/**
 * Reports the Electron desktop shell's platform (see desktop/preload.js, which
 * exposes `window.yifyDesktop`). Returns the server snapshot (`''`) during static
 * render and hydration, then the real client value — mirroring the
 * static-rendering-safe approach in use-color-scheme.web.ts.
 *
 * Value is `''` on web/native, otherwise the Electron `process.platform`
 * (`'darwin'`, `'win32'`, `'linux'`, …).
 */
function subscribe() {
    // The desktop platform never changes for the lifetime of the page.
    return () => {
    };
}

function getSnapshot() {
    if (typeof window === 'undefined') return '';
    const desktop = (window as { yifyDesktop?: { isDesktop?: boolean; platform?: string } }).yifyDesktop;
    return desktop?.isDesktop ? (desktop.platform ?? 'unknown') : '';
}

function getServerSnapshot() {
    return '';
}

export function useDesktopPlatform() {
    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** True in any Electron desktop shell. */
export function useIsDesktop() {
    return useDesktopPlatform() !== '';
}

/** True only on macOS, which uses the frameless inset title bar. */
export function useIsMacDesktop() {
    return useDesktopPlatform() === 'darwin';
}

/** True on platforms with a translucent ("liquid glass") window: macOS + Windows. */
export function useIsFrostedDesktop() {
    const platform = useDesktopPlatform();
    return platform === 'darwin' || platform === 'win32';
}
