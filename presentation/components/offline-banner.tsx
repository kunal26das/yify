import Ionicons from '@expo/vector-icons/Ionicons';
import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {enterRise} from './motion';
import {ThemedText} from './themed-text';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {useIsOnline} from '../hooks/use-is-online';

export function OfflineBanner() {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const online = useIsOnline();

    if (online) return null;

    return (
        <View style={[styles.wrap, {bottom: insets.bottom + Spacing.lg}]} pointerEvents="none">
            <Animated.View
                entering={enterRise()}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[
                    styles.bar,
                    {
                        backgroundColor: scheme === 'dark' ? '#3A3A37' : '#1F1D1A',
                        borderColor: colors.borderStrong,
                    },
                ]}
            >
                <Ionicons name="cloud-offline-outline" size={19} color="#fff"/>
                <ThemedText style={styles.message} numberOfLines={1}>
                    You&rsquo;re offline
                </ThemedText>
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
        zIndex: 99,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        maxWidth: 520,
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
    message: {color: '#fff', fontSize: 14, fontFamily: FontFamily.semibold},
});
