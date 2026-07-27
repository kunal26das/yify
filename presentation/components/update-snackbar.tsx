import {Ionicons} from '@expo/vector-icons';
import {useSyncExternalStore} from 'react';
import {Animated, Pressable, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {dismissOta, getOtaStatus, restartApp, subscribeOta, type OtaStatus} from '@/lib/ota-update';
import {ThemedText} from './themed-text';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';

const IDLE: OtaStatus = {state: 'idle', progress: 0};

function useOtaStatus(): OtaStatus {
    return useSyncExternalStore(subscribeOta, getOtaStatus, () => IDLE);
}

/**
 * Update progress, pinned above every screen.
 *
 * Mounted once at the root rather than per screen, so a download that starts on the home page keeps
 * reporting while the viewer moves into a movie or into Settings. Renders nothing at all when there
 * is no update in flight, and never on web.
 */
export function UpdateSnackbar() {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {state, progress} = useOtaStatus();

    // 'checking' stays silent: a routine poll that finds nothing shouldn't flash a bar at anyone.
    if (state === 'idle' || state === 'checking') return null;

    const ready = state === 'ready';
    const failed = state === 'error';

    const message = failed
        ? "Couldn't fetch the latest update"
        : ready
            ? 'Update ready — restart to apply'
            : state === 'installing'
                ? 'Installing update…'
                : `Downloading update… ${Math.round(progress * 100)}%`;

    return (
        <View style={[styles.wrap, {bottom: insets.bottom + Spacing.lg}]} pointerEvents="box-none">
            <View
                style={[
                    styles.bar,
                    {
                        backgroundColor: scheme === 'dark' ? '#3A3A37' : '#1F1D1A',
                        borderColor: colors.borderStrong,
                    },
                ]}
            >
                <Ionicons
                    name={failed ? 'alert-circle-outline' : ready ? 'checkmark-circle-outline' : 'cloud-download-outline'}
                    size={19}
                    color="#fff"
                />
                <View style={styles.body}>
                    <ThemedText style={styles.message} numberOfLines={1}>
                        {message}
                    </ThemedText>
                    {state === 'downloading' ? (
                        <View style={styles.track}>
                            <Animated.View
                                style={[
                                    styles.fill,
                                    {backgroundColor: colors.accent, width: `${Math.round(progress * 100)}%`},
                                ]}
                            />
                        </View>
                    ) : null}
                </View>

                {ready ? (
                    <Pressable
                        onPress={restartApp}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Restart to apply the update"
                        style={({pressed}) => ({opacity: pressed ? 0.7 : 1})}
                    >
                        <ThemedText style={[styles.action, {color: colors.accentSecondary}]}>
                            Restart
                        </ThemedText>
                    </Pressable>
                ) : null}

                {ready || failed ? (
                    <Pressable
                        onPress={dismissOta}
                        hitSlop={8}
                        accessibilityRole="button"
                        accessibilityLabel="Dismiss"
                        style={({pressed}) => ({opacity: pressed ? 0.7 : 1})}
                    >
                        <Ionicons name="close" size={18} color="rgba(255,255,255,0.7)"/>
                    </Pressable>
                ) : null}
            </View>
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
