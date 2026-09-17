interface PlayerScrollRelayOptions {
    viewport: HTMLElement;
    track: HTMLElement;
    target: HTMLElement;
    height: number;
}

export function createPlayerScrollRelay({viewport, track, target, height}: PlayerScrollRelayOptions) {
    let disposed = false;
    let range = 0;
    let viewportPosition = viewport.scrollTop;
    let targetPosition = target.scrollTop;

    const clamp = (value: number) => Math.max(0, Math.min(range, value));

    const writeViewport = (position: number) => {
        viewportPosition = position;
        if (viewport.scrollTop !== position) viewport.scrollTop = position;
        viewportPosition = viewport.scrollTop;
    };

    const writeTarget = (position: number) => {
        targetPosition = position;
        if (target.scrollTop !== position) target.scrollTop = position;
        targetPosition = target.scrollTop;
    };

    const fromViewport = () => {
        if (disposed || viewport.scrollTop === viewportPosition) return;
        const position = clamp(viewport.scrollTop);
        writeTarget(position);
        writeViewport(position);
    };

    const fromTarget = () => {
        if (disposed || target.scrollTop === targetPosition) return;
        const position = clamp(target.scrollTop);
        writeViewport(position);
        writeTarget(position);
    };

    const refresh = () => {
        if (disposed) return;
        range = Math.max(0, target.scrollHeight - target.clientHeight);
        const trackHeight = `${Math.max(0, height) + range}px`;
        if (track.style.height !== trackHeight) track.style.height = trackHeight;
        const position = clamp(target.scrollTop);
        writeViewport(position);
        writeTarget(position);
    };

    viewport.addEventListener('scroll', fromViewport, {passive: true});
    target.addEventListener('scroll', fromTarget, {passive: true});
    refresh();

    return {
        refresh,
        dispose() {
            if (disposed) return;
            disposed = true;
            viewport.removeEventListener('scroll', fromViewport);
            target.removeEventListener('scroll', fromTarget);
        },
    };
}
