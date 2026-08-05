import {forwardRef, useEffect, useImperativeHandle, useRef, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import YoutubeIframe, {type YoutubeIframeRef} from 'react-native-youtube-iframe';
import {YOUTUBE_WEB_VIEW_PROPS} from './youtubeWebView';

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

export const PlayerSurface = forwardRef<PlayerSurfaceHandle, PlayerSurfaceProps>(function PlayerSurface(
    {videoId, width, height, muted, playing, onEnded, onStateChange},
    ref,
) {
    const playerRef = useRef<YoutubeIframeRef | null>(null);
    const [active, setActive] = useState(playing);
    const [silent, setSilent] = useState(muted);

    useEffect(() => {
        setActive(playing);
    }, [playing]);

    useEffect(() => {
        setSilent(muted);
    }, [muted]);

    useImperativeHandle(
        ref,
        () => ({
            play: () => setActive(true),
            pause: () => setActive(false),
            setMuted: (next: boolean) => setSilent(next),
            seekBy: (seconds: number) => {
                const player = playerRef.current;
                if (!player) return;
                void player
                    .getCurrentTime()
                    .then((position) => player.seekTo(Math.max(0, position + seconds), true))
                    .catch(() => undefined);
            },
        }),
        [],
    );

    const handleState = (state: string) => {
        if (state === 'ended') {
            setActive(false);
            onStateChange?.(false);
            onEnded?.();
            return;
        }
        if (state === 'playing') {
            setActive(true);
            onStateChange?.(true);
            return;
        }
        if (state === 'paused') {
            setActive(false);
            onStateChange?.(false);
        }
    };

    return (
        <View style={[styles.container, {width, height}]} collapsable={false}>
            <YoutubeIframe
                ref={playerRef}
                videoId={videoId}
                width={width}
                height={height}
                play={active}
                mute={silent}
                forceAndroidAutoplay
                onChangeState={handleState}
                initialPlayerParams={{controls: true, modestbranding: true, rel: false}}
                webViewProps={YOUTUBE_WEB_VIEW_PROPS}
            />
        </View>
    );
});

const styles = StyleSheet.create({
    container: {overflow: 'hidden', backgroundColor: '#000000'},
});
