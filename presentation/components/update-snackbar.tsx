import {Ionicons} from '@expo/vector-icons';
import {useSyncExternalStore} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {IDLE_UPDATE_STATUS, type UpdateStatus} from '@/domain';
import {useAppUpdates} from '../di/DependenciesContext';
import {Duration, PressableScale, enterPop, enterRise} from './motion';
import {ThemedText} from './themed-text';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';

export function UpdateSnackbar() {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const appUpdates = useAppUpdates();
    const {state, progress}: UpdateStatus = useSyncExternalStore(
        (listener) => appUpdates.subscribe(listener),
        () => appUpdates.getStatus(),
        () => IDLE_UPDATE_STATUS
    );

    if (state === 'idle' || state === 'checking') return null;

    const ready = state === 'ready';
    const failed = state === 'error';

    const message = failed
        ? "Couldn't fetch the latest update"
        : ready
            ? 'Update ready — restart to apply'
            : state === 'installing'
                ? 'Installing update…'
                : progress > 0
                    ? `Downloading update… ${Math.round(progress * 100)}%`
                    : 'Downloading update…';

    return (
        <View style={[styles.wrap, {bottom: insets.bottom + Spacing.lg}]} pointerEvents="box-none">
            <Animated.View
                entering={enterRise()}
                style={[
                    styles.bar,
                    {
                        backgroundColor: scheme === 'dark' ? '#3A3A37' : '#1F1D1A',
                        borderColor: colors.borderStrong,
                    },
                ]}
            >
                <Animated.View key={state} entering={enterPop()}>
                    <Ionicons
                        name={failed ? 'alert-circle-outline' : ready ? 'checkmark-circle-outline' : 'cloud-download-outline'}
                        size={19}
                        color="#fff"
                    />
                </Animated.View>
                <View style={styles.body}>
                    <ThemedText style={styles.message} numberOfLines={1}>
                        {message}
                    </ThemedText>
                    {state === 'downloading' && progress > 0 ? (
                        <View style={styles.track}>
                            <Animated.View
                                style={[
                                    styles.fill,
                                    {
                                        backgroundColor: colors.accent,
                                        width: `${Math.round(progress * 100)}%`,
                                        transitionProperty: 'width',
                                        transitionDuration: Duration.base,
                                        transitionTimingFunction: 'ease-out',
                                    },
                                ]}
                            />
                        </View>
                    ) : null}
                </View>

                {ready ? (
                    <PressableScale
                        onPress={() => appUpdates.restart()}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Restart to apply the update"
                        pressedScale={0.92}
                        pressedOpacity={0.7}
                        hoveredScale={1.05}
                    >
                        <ThemedText style={[styles.action, {color: colors.accentSecondary}]}>
                            Restart
                        </ThemedText>
                    </PressableScale>
                ) : null}

                {ready || failed ? (
                    <PressableScale
                        onPress={() => appUpdates.dismiss()}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss"
                        pressedScale={0.86}
                        pressedOpacity={0.7}
                        hoveredScale={1.12}
                    >
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)"/>
                    </PressableScale>
                ) : null}
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        zIndex: 100,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        maxWidth: 520,
        width: '100%',
        paddingHorizontal: Spacing.lg,
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    body: {flex: 1, gap: 7},
    message: {color: '#fff', fontSize: 14, fontFamily: FontFamily.semibold},
    track: {height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.22)', overflow: 'hidden'},
    fill: {height: 3, borderRadius: 2},
    action: {fontSize: 14, fontFamily: FontFamily.bold},
});
