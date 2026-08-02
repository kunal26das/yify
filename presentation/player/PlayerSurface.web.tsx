import {forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';

export interface PlayerSurfaceHandle {
    play(): void;
    pause(): void;
    seekBy(seconds: number): void;
    setMuted(muted: boolean): void;
}

export interface PlayerSurfaceProps {
    videoId: string;
    width: number;
    height: number;
    muted: boolean;
    playing: boolean;
    onEnded?: () => void;
    onStateChange?: (playing: boolean) => void;
}

interface InfoDelivery {
    event?: string;
    info?: {playerState?: number; currentTime?: number};
}

const EMBED_ORIGIN = 'https://www.youtube-nocookie.com';
const HANDSHAKE_INTERVAL = 400;
const HANDSHAKE_ATTEMPTS = 30;

const STATE_ENDED = 0;
const STATE_PLAYING = 1;
const STATE_PAUSED = 2;

function embedSource(videoId: string): string {
    const params = new URLSearchParams({
        enablejsapi: '1',
        rel: '0',
        modestbranding: '1',
        playsinline: '1',
        controls: '1',
        autoplay: '1',
    });
    if (typeof window !== 'undefined') params.set('origin', window.location.origin);
    return `${EMBED_ORIGIN}/embed/${videoId}?${params.toString()}`;
}

export const PlayerSurface = forwardRef<PlayerSurfaceHandle, PlayerSurfaceProps>(function PlayerSurface(
    {videoId, width, height, muted, playing, onEnded, onStateChange},
    ref,
) {
    const frameRef = useRef<HTMLIFrameElement | null>(null);
    const connectedRef = useRef(false);
    const positionRef = useRef(0);
    const reportedPlayingRef = useRef<boolean | null>(null);
    const appliedMutedRef = useRef<boolean | null>(null);
    const endedRef = useRef(onEnded);
    const stateRef = useRef(onStateChange);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        endedRef.current = onEnded;
    }, [onEnded]);

    useEffect(() => {
        stateRef.current = onStateChange;
    }, [onStateChange]);

    const post = useCallback((func: string, args: unknown[] = []) => {
        const target = frameRef.current?.contentWindow;
        if (!target) return;
        target.postMessage(JSON.stringify({event: 'command', func, args}), EMBED_ORIGIN);
    }, []);

    useEffect(() => {
        connectedRef.current = false;
        positionRef.current = 0;
        reportedPlayingRef.current = null;
        appliedMutedRef.current = null;
        setConnected(false);

        let attempts = 0;
        const handshake = window.setInterval(() => {
            attempts += 1;
            const target = frameRef.current?.contentWindow;
            target?.postMessage(
                JSON.stringify({event: 'listening', id: videoId, channel: 'widget'}),
                EMBED_ORIGIN,
            );
            if (connectedRef.current || attempts >= HANDSHAKE_ATTEMPTS) window.clearInterval(handshake);
        }, HANDSHAKE_INTERVAL);

        const receive = (event: MessageEvent) => {
            const frameWindow = frameRef.current?.contentWindow;
            if (!frameWindow || event.source !== frameWindow) return;
            if (event.origin !== EMBED_ORIGIN || typeof event.data !== 'string') return;

            let payload: InfoDelivery;
            try {
                payload = JSON.parse(event.data);
            } catch {
                return;
            }
            if (payload.event !== 'infoDelivery' || !payload.info) return;

            if (!connectedRef.current) {
                connectedRef.current = true;
                setConnected(true);
            }

            const {playerState, currentTime} = payload.info;
            if (typeof currentTime === 'number') positionRef.current = currentTime;
            if (typeof playerState !== 'number') return;

            if (playerState === STATE_ENDED) {
                reportedPlayingRef.current = false;
                stateRef.current?.(false);
                endedRef.current?.();
                return;
            }
            if (playerState === STATE_PLAYING && reportedPlayingRef.current !== true) {
                reportedPlayingRef.current = true;
                stateRef.current?.(true);
                return;
            }
            if (playerState === STATE_PAUSED && reportedPlayingRef.current !== false) {
                reportedPlayingRef.current = false;
                stateRef.current?.(false);
            }
        };

        window.addEventListener('message', receive);
        return () => {
            window.clearInterval(handshake);
            window.removeEventListener('message', receive);
        };
    }, [videoId]);

    useEffect(() => {
        if (!connected || reportedPlayingRef.current === playing) return;
        post(playing ? 'playVideo' : 'pauseVideo');
    }, [connected, playing, post]);

    useEffect(() => {
        if (!connected || appliedMutedRef.current === muted) return;
        appliedMutedRef.current = muted;
        post(muted ? 'mute' : 'unMute');
    }, [connected, muted, post]);

    useImperativeHandle(
        ref,
        () => ({
            play: () => post('playVideo'),
            pause: () => post('pauseVideo'),
            setMuted: (next: boolean) => {
                appliedMutedRef.current = next;
                post(next ? 'mute' : 'unMute');
            },
            seekBy: (seconds: number) => {
                const target = Math.max(0, positionRef.current + seconds);
                positionRef.current = target;
                post('seekTo', [target, true]);
            },
        }),
        [post],
    );

    const source = useMemo(() => embedSource(videoId), [videoId]);

    return (
        <View style={[styles.container, {width, height}]}>
            <iframe
                key={videoId}
                ref={frameRef}
                title="Trailer"
                src={source}
                style={frameStyle}
                allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
            />
        </View>
    );
});

const frameStyle = {width: '100%', height: '100%', border: 0, display: 'block'} as const;

const styles = StyleSheet.create({
    container: {overflow: 'hidden', backgroundColor: '#000000'},
});
