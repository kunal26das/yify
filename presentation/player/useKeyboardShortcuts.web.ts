import {useEffect, useRef} from 'react';

import {usePlayer, type PlayerApi} from './PlayerContext';

function isTypingTarget(target: EventTarget | null): boolean {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

export function useKeyboardShortcuts(): void {
    const player = usePlayer();
    const playerRef = useRef<PlayerApi>(player);

    useEffect(() => {
        playerRef.current = player;
    }, [player]);

    useEffect(() => {
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.metaKey || event.ctrlKey || event.altKey) return;
            if (isTypingTarget(event.target)) return;

            const api = playerRef.current;
            if (api.mode === 'closed') return;

            switch (event.key) {
                case ' ':
                    event.preventDefault();
                    api.togglePlay();
                    return;
                case 'k':
                case 'K':
                    api.togglePlay();
                    return;
                case 'j':
                case 'J':
                    api.seekBy(-10);
                    return;
                case 'l':
                case 'L':
                    api.seekBy(10);
                    return;
                case 'ArrowLeft':
                    api.seekBy(-5);
                    return;
                case 'ArrowRight':
                    api.seekBy(5);
                    return;
                case 'm':
                case 'M':
                    api.toggleMute();
                    return;
                case 'i':
                case 'I':
                    if (api.mode === 'mini') api.maximize();
                    else api.minimize();
                    return;
                case 'Escape':
                    if (api.mode === 'mini') api.close();
                    else api.minimize();
                    return;
                default:
                    return;
            }
        };

        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);
}
