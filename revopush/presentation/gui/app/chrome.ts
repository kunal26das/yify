import {$} from './dom.js';
import {bridge} from './bridge.js';

export function initChrome(): void {
    if (bridge.platform === 'darwin') {
        document.documentElement.classList.add('glass');
    }

    const systemPrefersLight = () =>
        window.matchMedia &&
        window.matchMedia('(prefers-color-scheme: light)').matches;

    let saved: string | null = null;
    try {
        saved = localStorage.getItem('revopush.theme');
    } catch {
    }

    const applyTheme = (light: boolean) =>
        document.body.classList.toggle('theme-light', light);

    applyTheme(saved ? saved === 'light' : systemPrefersLight());

    $('#themeToggle').addEventListener('click', () => {
        const light = document.body.classList.toggle('theme-light');
        try {
            localStorage.setItem('revopush.theme', light ? 'light' : 'dark');
        } catch {
        }
    });

    if (window.matchMedia) {
        window
            .matchMedia('(prefers-color-scheme: light)')
            .addEventListener('change', (e: MediaQueryListEvent) => {
                let stored: string | null = null;
                try {
                    stored = localStorage.getItem('revopush.theme');
                } catch {
                }
                if (!stored) applyTheme(e.matches);
            });
    }
}
