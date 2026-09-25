import {useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSupporterNudge} from '../di/DependenciesContext';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {useSupporterPaywall} from './supporter-paywall';

export function SupporterDiscoveryCard({savedCount}: {savedCount: number}) {
    const purchases = usePurchases();
    const nudge = useSupporterNudge();
    const showPaywall = useSupporterPaywall();
    const {colors} = usePalette();
    const [dismissed, setDismissed] = useState(() => nudge.isDiscoveryDismissed());

    if (dismissed || savedCount < 3 || !purchases.ready || !purchases.available ||
        purchases.adsRemoved || purchases.billingIssue) return null;

    const dismiss = () => {
        setDismissed(true);
        nudge.dismissDiscovery();
    };

    return <View style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <ThemedText type="defaultSemiBold">Make more of your movie journal</ThemedText>
        <ThemedText style={{color: colors.textMuted}}>Get monthly viewing insights and no Yify ads with Supporter. Your watchlist and journal stay free.</ThemedText>
        <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => showPaywall('watchlist_supporter')}
                style={[styles.button, {backgroundColor: colors.accentStrong}]}>
                <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>See monthly options</ThemedText>
            </Pressable>
            <Pressable accessibilityRole="button" accessibilityLabel="Dismiss supporter suggestion" onPress={dismiss}
                style={styles.button}>
                <ThemedText style={{color: colors.textMuted}}>Keep using free</ThemedText>
            </Pressable>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    card: {borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.lg, gap: Spacing.sm},
    actions: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, marginTop: Spacing.xs},
    button: {minHeight: 44, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md,
        justifyContent: 'center', alignItems: 'center'},
});
