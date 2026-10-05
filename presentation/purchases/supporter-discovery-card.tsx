import {useImperativeHandle, useRef, useState, type ComponentRef, type Ref, type RefObject} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {useSupporterNudge} from '../di/DependenciesContext';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {useSupporterPaywall, useSupporterPaywallVisible} from './supporter-paywall';
import {usePreferences} from '../hooks/use-preferences';
import {useVisibleImpression} from '../hooks/use-visible-impression';
import {Analytics} from '../analytics/events';

export type SupporterDiscoveryHandle = {checkVisibility: () => void};

export function SupporterDiscoveryCard({savedCount, viewportRef, topInset = 0, obscured = false, ref}: {
    savedCount: number;
    viewportRef?: RefObject<ComponentRef<typeof View> | null>;
    topInset?: number;
    obscured?: boolean;
    ref?: Ref<SupporterDiscoveryHandle>;
}) {
    const purchases = usePurchases();
    const nudge = useSupporterNudge();
    const showPaywall = useSupporterPaywall();
    const paywallOpen = useSupporterPaywallVisible();
    const {colors} = usePalette();
    const {watchRegion} = usePreferences();
    const [dismissed, setDismissed] = useState(() => nudge.isDiscoveryDismissed());
    const dismissedRef = useRef(dismissed);
    const targetRef = useRef<ComponentRef<typeof View>>(null);
    const pendingPaywall = useRef(false);
    const eligible = !dismissed && savedCount >= 3 && purchases.ready && purchases.available &&
        !purchases.adsRemoved && !purchases.billingIssue;
    const checkVisibility = useVisibleImpression({enabled: eligible && !paywallOpen && !obscured, targetRef, viewportRef, topInset,
        onImpression: () => Analytics.subscriptionFunnel({step: 'discovery_view', placement: 'watchlist_supporter'}, watchRegion)});
    useImperativeHandle(ref, () => ({checkVisibility}), [checkVisibility]);

    if (!eligible) return null;

    const open = () => {
        if (dismissedRef.current || pendingPaywall.current || paywallOpen) return;
        Analytics.subscriptionFunnel({step: 'discovery_opened', placement: 'watchlist_supporter'}, watchRegion);
        pendingPaywall.current = true;
        showPaywall('watchlist_supporter', () => { pendingPaywall.current = false; });
    };

    const dismiss = () => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        Analytics.subscriptionFunnel({step: 'discovery_dismissed', placement: 'watchlist_supporter'}, watchRegion);
        setDismissed(true);
        nudge.dismissDiscovery();
    };

    return <View ref={targetRef} collapsable={false} onLayout={checkVisibility}
        style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}]}>
        <ThemedText type="defaultSemiBold">Your movie habits, in focus</ThemedText>
        <ThemedText style={{color: colors.textMuted}}>Explore your viewing recaps, favourite genres and ratings with Supporter. Yify ads are removed, too. Your watchlist and journal stay free.</ThemedText>
        <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={open}
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
