import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
    type RefObject,
} from 'react';

import {Analytics} from '@/lib/analytics-events';
import type {PlayerSurfaceHandle} from './PlayerSurface';

export interface PlayerVideo {
    movieId: number;
    videoId: string;
    title: string;
    subtitle?: string;
    thumbnailUrl?: string;
}

export type PlayerMode = 'closed' | 'inline' | 'mini';

export interface PlayerRect {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface PlayerApi {
    video: PlayerVideo | null;
    mode: PlayerMode;
    playing: boolean;
    muted: boolean;
    open(video: PlayerVideo): void;
    close(): void;
    minimize(): void;
    maximize(): void;
    setInlineRect(rect: PlayerRect | null): void;
    togglePlay(): void;
    toggleMute(): void;
    seekBy(seconds: number): void;
    setQueue(items: PlayerVideo[]): void;
    playNext(): void;
}

export interface PlayerInternalApi {
    surfaceRef: RefObject<PlayerSurfaceHandle | null>;
    subscribeInlineRect(listener: () => void): () => void;
    getInlineRect(): PlayerRect | null;
    reportPlaying(playing: boolean): void;
    reportEnded(): void;
}

function sameRect(a: PlayerRect | null, b: PlayerRect | null): boolean {
    if (a === b) return true;
    if (!a || !b) return false;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

const PlayerContext = createContext<PlayerApi | null>(null);
const PlayerInternalContext = createContext<PlayerInternalApi | null>(null);

export function PlayerProvider({children}: {children: ReactNode}): ReactElement {
    const [video, setVideo] = useState<PlayerVideo | null>(null);
    const [mode, setMode] = useState<PlayerMode>('closed');
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);

    const videoRef = useRef<PlayerVideo | null>(null);
    const playingRef = useRef(false);
    const mutedRef = useRef(false);
    const queueRef = useRef<PlayerVideo[]>([]);
    const surfaceRef = useRef<PlayerSurfaceHandle | null>(null);
    const inlineRectRef = useRef<PlayerRect | null>(null);
    const inlineRectListenersRef = useRef<Set<() => void>>(new Set());

    const applyVideo = useCallback((next: PlayerVideo | null) => {
        videoRef.current = next;
        setVideo(next);
    }, []);

    const applyPlaying = useCallback((next: boolean) => {
        if (playingRef.current === next) return;
        playingRef.current = next;
        setPlaying(next);
    }, []);

    const applyMuted = useCallback((next: boolean) => {
        if (mutedRef.current === next) return;
        mutedRef.current = next;
        setMuted(next);
    }, []);

    const open = useCallback(
        (next: PlayerVideo) => {
            if (videoRef.current?.videoId === next.videoId) {
                setMode('inline');
                return;
            }
            applyVideo(next);
            applyPlaying(true);
            applyMuted(false);
            setMode('inline');
            Analytics.trailerPlay({id: next.movieId, title: next.title});
        },
        [applyMuted, applyPlaying, applyVideo],
    );

    const close = useCallback(() => {
        const current = videoRef.current;
        queueRef.current = [];
        setMode('closed');
        applyVideo(null);
        applyPlaying(false);
        if (current) Analytics.trailerClose({id: current.movieId, title: current.title});
    }, [applyPlaying, applyVideo]);

    const minimize = useCallback(() => {
        setMode((current) => (current === 'inline' ? 'mini' : current));
    }, []);

    const maximize = useCallback(() => {
        setMode((current) => (current === 'mini' ? 'inline' : current));
    }, []);

    const setInlineRect = useCallback((rect: PlayerRect | null) => {
        if (sameRect(inlineRectRef.current, rect)) return;
        inlineRectRef.current = rect;
        inlineRectListenersRef.current.forEach((listener) => listener());
    }, []);

    const subscribeInlineRect = useCallback((listener: () => void) => {
        const listeners = inlineRectListenersRef.current;
        listeners.add(listener);
        return () => {
            listeners.delete(listener);
        };
    }, []);

    const getInlineRect = useCallback(() => inlineRectRef.current, []);

    const togglePlay = useCallback(() => {
        const next = !playingRef.current;
        if (next) surfaceRef.current?.play();
        else surfaceRef.current?.pause();
        applyPlaying(next);
    }, [applyPlaying]);

    const toggleMute = useCallback(() => {
        const next = !mutedRef.current;
        surfaceRef.current?.setMuted(next);
        applyMuted(next);
    }, [applyMuted]);

    const seekBy = useCallback((seconds: number) => {
        surfaceRef.current?.seekBy(seconds);
    }, []);

    const setQueue = useCallback((items: PlayerVideo[]) => {
        queueRef.current = items.slice();
    }, []);

    const playNext = useCallback(() => {
        const queue = queueRef.current;
        const current = videoRef.current;
        const index = current ? queue.findIndex((item) => item.videoId === current.videoId) : -1;
        const next = queue[index + 1];
        if (!next) {
            applyPlaying(false);
            return;
        }
        applyVideo(next);
        applyPlaying(true);
        Analytics.trailerPlay({id: next.movieId, title: next.title});
    }, [applyPlaying, applyVideo]);

    const api = useMemo<PlayerApi>(
        () => ({
            video,
            mode,
            playing,
            muted,
            open,
            close,
            minimize,
            maximize,
            setInlineRect,
            togglePlay,
            toggleMute,
            seekBy,
            setQueue,
            playNext,
        }),
        [
            video,
            mode,
            playing,
            muted,
            open,
            close,
            minimize,
            maximize,
            setInlineRect,
            togglePlay,
            toggleMute,
            seekBy,
            setQueue,
            playNext,
        ],
    );

    const internal = useMemo<PlayerInternalApi>(
        () => ({
            surfaceRef,
            subscribeInlineRect,
            getInlineRect,
            reportPlaying: applyPlaying,
            reportEnded: playNext,
        }),
        [applyPlaying, getInlineRect, playNext, subscribeInlineRect],
    );

    return (
        <PlayerContext.Provider value={api}>
            <PlayerInternalContext.Provider value={internal}>{children}</PlayerInternalContext.Provider>
        </PlayerContext.Provider>
    );
}

export function usePlayer(): PlayerApi {
    const api = useContext(PlayerContext);
    if (!api) throw new Error('usePlayer must be used inside PlayerProvider');
    return api;
}

export function usePlayerInternal(): PlayerInternalApi {
    const api = useContext(PlayerInternalContext);
    if (!api) throw new Error('usePlayerInternal must be used inside PlayerProvider');
    return api;
}
