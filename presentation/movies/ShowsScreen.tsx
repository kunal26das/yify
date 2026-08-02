import {Ionicons} from '@expo/vector-icons';
import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {Analytics} from '@/lib/analytics-events';
import {PressableScale, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';
import {TopBar, useTopBarHeight} from './components/TopBar';
import {useGoTo} from './constants/destinations';

export function ShowsScreen() {
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const topBarHeight = useTopBarHeight();
    const goTo = useGoTo();

    return (
        <ThemedView style={styles.container}>
            <Animated.View
                entering={enterRise()}
                style={[styles.centered, {paddingTop: topBarHeight, paddingBottom: insets.bottom}]}
            >
                <View style={[styles.glyph, {backgroundColor: colors.surfaceSunken}]}>
                    <Ionicons name="tv-outline" size={34} color={colors.accent}/>
                </View>
                <View style={[styles.badge, {backgroundColor: colors.accentSoft}]}>
                    <ThemedText style={[styles.badgeLabel, {color: colors.accent}]}>COMING SOON</ThemedText>
                </View>
                <ThemedText type="heading" style={styles.title}>Shows are on the way</ThemedText>
                <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                    Series and episode browsing is not here yet. Movies are all yours in the meantime.
                </ThemedText>
                <PressableScale
                    onPress={() => {
                        Analytics.browseAllOpen('shows_placeholder');
                        goTo('/browse');
                    }}
                    accessibilityRole="link"
                    pressedScale={0.94}
                    pressedOpacity={0.85}
                    hoveredScale={1.03}
                >
                    <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                        <Ionicons name="film-outline" size={17} color={colors.onAccent}/>
                        <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>Browse movies</ThemedText>
                    </View>
                </PressableScale>
            </Animated.View>
            <TopBar active="shows"/>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    centered: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: Spacing.sm},
    glyph: {
        width: 76,
        height: 76,
        borderRadius: 38,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.xs,
    },
    badge: {borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 4},
    badgeLabel: {fontSize: 10.5, letterSpacing: 0.8, fontFamily: FontFamily.extrabold},
    title: {marginTop: Spacing.xs},
    body: {fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 380},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: Spacing.md,
    },
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},
});
