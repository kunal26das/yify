import {useSyncExternalStore} from 'react';

function subscribe() {
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

export function useIsDesktop() {
    return useDesktopPlatform() !== '';
}

export function useIsMacDesktop() {
    return useDesktopPlatform() === 'darwin';
}

export function useIsFrostedDesktop() {
    const platform = useDesktopPlatform();
    return platform === 'darwin' || platform === 'win32';
}
