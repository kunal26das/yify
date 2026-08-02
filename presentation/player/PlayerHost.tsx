import {useEffect, useMemo, useRef, useSyncExternalStore, type ReactElement} from 'react';
import {Ionicons} from '@expo/vector-icons';
import {router, usePathname} from 'expo-router';
import {Platform, Pressable, StyleSheet, View, type ViewStyle} from 'react-native';
import Animated, {Easing, useAnimatedStyle, useSharedValue, withTiming} from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

import {Radius} from '../constants/theme';
import {useResponsive} from '../hooks/use-responsive';
import {MiniBar} from './MiniBar';
import {PlayerSurface} from './PlayerSurface';
import {usePlayer, usePlayerInternal, type PlayerRect} from './PlayerContext';
import {useDocumentPip} from './useDocumentPip';
import {useKeyboardShortcuts} from './useKeyboardShortcuts';

const MINI_PHONE_WIDTH = 132;
const MINI_WIDE_WIDTH = 400;
const MINI_PHONE_MARGIN = 8;
const MINI_WIDE_MARGIN = 16;
const MOVE_TIMING = {duration: 260, easing: Easing.out(Easing.cubic)};
const MINI_SHADOW: ViewStyle =
    Platform.OS === 'web' ? {boxShadow: '0 10px 30px rgba(0, 0, 0, 0.38)'} : {};

function heightFor(width: number): number {
    return Math.round((width * 9) / 16);
}

export function PlayerHost(): ReactElement | null {
    const {video, mode, playing, muted, maximize, minimize} = usePlayer();
    const {surfaceRef, subscribeInlineRect, getInlineRect, reportPlaying, reportEnded} = usePlayerInternal();
    const insets = useSafeAreaInsets();
    const {width: windowWidth, height: windowHeight, isPhone} = useResponsive();
    const inlineRect = useSyncExternalStore(subscribeInlineRect, getInlineRect, getInlineRect);
    const pathname = usePathname();

    useKeyboardShortcuts();
    const pip = useDocumentPip();

    const inlineTarget = useMemo<PlayerRect>(() => {
        if (inlineRect) return inlineRect;
        return {x: 0, y: insets.top, width: windowWidth, height: heightFor(windowWidth)};
    }, [inlineRect, insets.top, windowWidth]);

    const miniTarget = useMemo<PlayerRect>(() => {
        if (isPhone) {
            const height = heightFor(MINI_PHONE_WIDTH);
            const offset = insets.bottom + MINI_PHONE_MARGIN;
            return {x: 0, y: windowHeight - offset - height, width: MINI_PHONE_WIDTH, height};
        }
        const height = heightFor(MINI_WIDE_WIDTH);
        return {
            x: windowWidth - MINI_WIDE_WIDTH - MINI_WIDE_MARGIN,
            y: windowHeight - height - MINI_WIDE_MARGIN,
            width: MINI_WIDE_WIDTH,
            height,
        };
    }, [insets.bottom, isPhone, windowHeight, windowWidth]);

    useEffect(() => {
        if (mode === 'inline' && !pathname.startsWith('/movie/')) minimize();
    }, [minimize, mode, pathname]);

    const target = mode === 'mini' ? miniTarget : inlineTarget;

    const left = useSharedValue(target.x);
    const top = useSharedValue(target.y);
    const boxWidth = useSharedValue(target.width);
    const boxHeight = useSharedValue(target.height);
    const placedRef = useRef(false);

    useEffect(() => {
        if (mode === 'closed') {
            placedRef.current = false;
            return;
        }
        if (!placedRef.current) {
            placedRef.current = true;
            left.value = target.x;
            top.value = target.y;
            boxWidth.value = target.width;
            boxHeight.value = target.height;
            return;
        }
        left.value = withTiming(target.x, MOVE_TIMING);
        top.value = withTiming(target.y, MOVE_TIMING);
        boxWidth.value = withTiming(target.width, MOVE_TIMING);
        boxHeight.value = withTiming(target.height, MOVE_TIMING);
    }, [boxHeight, boxWidth, left, mode, target, top]);

    const baseWidth = Math.max(1, Math.round(inlineTarget.width));
    const baseHeight = Math.max(1, Math.round(inlineTarget.height));

    const boxStyle = useAnimatedStyle(() => ({
        left: left.value,
        top: top.value,
        width: boxWidth.value,
        height: boxHeight.value,
    }));

    const surfaceStyle = useAnimatedStyle(() => {
        const scale = boxWidth.value / baseWidth;
        return {
            transform: [
                {translateX: (scale - 1) * (baseWidth / 2)},
                {translateY: (scale - 1) * (baseHeight / 2)},
                {scale},
            ],
        };
    });

    if (mode === 'closed' || !video) return null;

    const expand = () => {
        maximize();
        router.push(`/movie/${video.movieId}`);
    };

    const collapse = () => {
        minimize();
        if (!pathname.startsWith('/movie/')) return;
        if (router.canGoBack()) router.back();
        else router.replace('/');
    };

    const mini = mode === 'mini';
    const radius = mini || !isPhone ? Radius.card : 0;
    const bar = mini ? <MiniBar video={video} rect={miniTarget} wide={!isPhone}/> : null;

    return (
        <View style={styles.host} pointerEvents="box-none">
            {isPhone ? bar : null}

            <Animated.View
                style={[styles.box, boxStyle, {borderRadius: radius}, mini ? MINI_SHADOW : null]}
            >
                <Animated.View
                    style={[styles.surface, {width: baseWidth, height: baseHeight}, surfaceStyle]}
                    pointerEvents={mini ? 'none' : 'auto'}
                    ref={pip.hostRef}
                >
                    <PlayerSurface
                        ref={surfaceRef}
                        videoId={video.videoId}
                        width={baseWidth}
                        height={baseHeight}
                        muted={muted}
                        playing={playing}
                        onStateChange={reportPlaying}
                        onEnded={reportEnded}
                    />
                </Animated.View>

                {mini ? (
                    <Pressable
                        style={StyleSheet.absoluteFill}
                        onPress={expand}
                        accessibilityRole="button"
                        accessibilityLabel={`Expand ${video.title}`}
                    />
                ) : (
                    <>
                        <Pressable
                            style={styles.collapse}
                            onPress={collapse}
                            hitSlop={10}
                            accessibilityRole="button"
                            accessibilityLabel="Collapse to miniplayer"
                        >
                            <Ionicons name="chevron-down" size={22} color="#FFFFFF"/>
                        </Pressable>
                        {pip.supported ? (
                            <Pressable
                                style={styles.pip}
                                onPress={pip.toggle}
                                hitSlop={10}
                                accessibilityRole="button"
                                accessibilityLabel={
                                    pip.active ? 'Close picture in picture' : 'Open in picture in picture'
                                }
                            >
                                <Ionicons name="albums-outline" size={19} color="#FFFFFF"/>
                            </Pressable>
                        ) : null}
                    </>
                )}
            </Animated.View>

            {isPhone ? null : bar}
        </View>
    );
}

const styles = StyleSheet.create({
    host: {position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, zIndex: 100},
    box: {position: 'absolute', overflow: 'hidden', backgroundColor: '#000000'},
    surface: {position: 'absolute', left: 0, top: 0},
    pip: {
        position: 'absolute',
        right: 8,
        top: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
    collapse: {
        position: 'absolute',
        left: 8,
        top: 8,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
    },
});
