import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {StyleSheet, View} from 'react-native';

import {PressableScale} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing, Typography} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {usePlayer, type PlayerRect, type PlayerVideo} from './PlayerContext';

const STRIP_HEIGHT = 32;

function IconButton({
    name,
    label,
    color,
    size,
    compact,
    onPress,
}: {
    name: keyof typeof Ionicons.glyphMap;
    label: string;
    color: string;
    size: number;
    compact?: boolean;
    onPress: () => void;
}) {
    return (
        <PressableScale
            onPress={onPress}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={label}
            pressedScale={0.86}
            pressedOpacity={0.6}
            contentStyle={compact ? styles.iconButtonCompact : styles.iconButton}
        >
            <Ionicons name={name} size={size} color={color}/>
        </PressableScale>
    );
}

export function MiniBar({video, rect, wide}: {video: PlayerVideo; rect: PlayerRect; wide: boolean}) {
    const {colors} = usePalette();
    const {playing, togglePlay, close, maximize} = usePlayer();

    const expand = () => {
        maximize();
        router.push(`/movie/${video.movieId}`);
    };

    if (wide) {
        return (
            <View style={[styles.strip, {left: rect.x, top: rect.y, width: rect.width}]}>
                <PressableScale
                    onPress={expand}
                    accessibilityRole="button"
                    accessibilityLabel={`Expand ${video.title}`}
                    pressedScale={1}
                    pressedOpacity={0.7}
                    style={styles.stripTitle}
                    contentStyle={styles.stripTitleContent}
                >
                    <ThemedText numberOfLines={1} style={[styles.overlayTitle, Typography.videoMeta]}>
                        {video.title}
                    </ThemedText>
                </PressableScale>
                <IconButton
                    name={playing ? 'pause' : 'play'}
                    label={playing ? 'Pause' : 'Play'}
                    color="#FFFFFF"
                    size={17}
                    compact
                    onPress={togglePlay}
                />
                <IconButton name="chevron-up" label="Expand" color="#FFFFFF" size={17} compact onPress={expand}/>
                <IconButton name="close" label="Close player" color="#FFFFFF" size={17} compact onPress={close}/>
            </View>
        );
    }

    return (
        <View
            style={[
                styles.bar,
                {
                    top: rect.y,
                    height: rect.height,
                    paddingLeft: rect.x + rect.width + Spacing.md,
                    backgroundColor: colors.surface,
                    borderTopColor: colors.border,
                },
            ]}
        >
            <PressableScale
                onPress={expand}
                accessibilityRole="button"
                accessibilityLabel={`Expand ${video.title}`}
                pressedScale={1}
                pressedOpacity={0.6}
                style={styles.info}
                contentStyle={styles.infoContent}
            >
                <ThemedText
                    numberOfLines={2}
                    style={[Typography.videoTitle, styles.weightSemibold, {color: colors.text}]}
                >
                    {video.title}
                </ThemedText>
                {video.subtitle ? (
                    <ThemedText numberOfLines={1} style={[Typography.videoMeta, {color: colors.textMuted}]}>
                        {video.subtitle}
                    </ThemedText>
                ) : null}
            </PressableScale>
            <IconButton
                name={playing ? 'pause' : 'play'}
                label={playing ? 'Pause' : 'Play'}
                color={colors.text}
                size={22}
                onPress={togglePlay}
            />
            <IconButton name="close" label="Close player" color={colors.text} size={22} onPress={close}/>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: {
        position: 'absolute',
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        paddingRight: Spacing.xs,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    info: {flex: 1, justifyContent: 'center'},
    infoContent: {gap: 1},
    iconButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconButtonCompact: {
        width: 30,
        height: STRIP_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    strip: {
        position: 'absolute',
        height: STRIP_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
        paddingLeft: Spacing.md,
        paddingRight: Spacing.xs,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        borderTopLeftRadius: Radius.card,
        borderTopRightRadius: Radius.card,
    },
    stripTitle: {flex: 1},
    stripTitleContent: {justifyContent: 'center'},
    overlayTitle: {color: '#FFFFFF'},
    weightSemibold: {fontWeight: '600'},
});
