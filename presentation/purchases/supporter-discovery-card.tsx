import {useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentRef, type Ref, type RefObject} from 'react';
import {Pressable, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
import type {PurchaseOffer} from '@/domain';
import {usePurchaseRepository, useSupporterNudge} from '../di/DependenciesContext';
import {usePurchases} from '../hooks/use-purchases';
import {useAuth} from '../hooks/use-auth';
import {usePalette} from '../hooks/use-palette';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {useSupporterPaywall, useSupporterPaywallVisible} from './supporter-paywall';
import {usePreferences} from '../hooks/use-preferences';
import {useVisibleImpression} from '../hooks/use-visible-impression';
import {Analytics} from '../analytics/events';
import {offerDisclosure} from './offer-copy';

export type SupporterDiscoveryHandle = {checkVisibility: () => void};

export function SupporterDiscoveryCard({savedCount = 0, placement = 'watchlist_supporter', returning = false,
    viewportRef, topInset = 0, obscured = false, style, ref}: {
    savedCount?: number;
    placement?: 'watchlist_supporter' | 'home_supporter';
    returning?: boolean;
    viewportRef?: RefObject<ComponentRef<typeof View> | null>;
    topInset?: number;
    obscured?: boolean;
    style?: StyleProp<ViewStyle>;
    ref?: Ref<SupporterDiscoveryHandle>;
}) {
    const purchases = usePurchases();
    const repository = usePurchaseRepository();
    const session = useAuth();
    const nudge = useSupporterNudge();
    const showPaywall = useSupporterPaywall();
    const paywallOpen = useSupporterPaywallVisible();
    const {colors} = usePalette();
    const {watchRegion} = usePreferences();
    const [dismissed, setDismissed] = useState(() => nudge.isDiscoveryDismissed());
    const dismissedRef = useRef(dismissed);
    const targetRef = useRef<ComponentRef<typeof View>>(null);
    const pendingPaywall = useRef(false);
    const engaged = placement === 'home_supporter' ? returning : savedCount >= 3;
    const eligible = !dismissed && !nudge.isDiscoveryDismissed() && engaged && session.ready && session.available && purchases.ready && purchases.available &&
        !purchases.adsRemoved && !purchases.billingIssue;
    const loadKey = useMemo(() => ({eligible, placement, repository, account: session.account?.uid, offers: purchases.offers}),
        [eligible, placement, repository, session.account?.uid, purchases.offers]);
    const [loaded, setLoaded] = useState<{key: typeof loadKey; offer?: PurchaseOffer} | null>(null);
    const offer = loaded?.key === loadKey ? loaded.offer : undefined;
    useEffect(() => {
        if (!loadKey.eligible) return;
        let active = true;
        void loadKey.repository.getOffers(loadKey.placement).then(offers => {
            if (active) setLoaded({key: loadKey, offer: offers.find(item => item.recurring && item.billingPeriod === 'P1M' && item.priceLabel.trim())});
        }, () => { if (active) setLoaded({key: loadKey}); });
        return () => { active = false; };
    }, [loadKey]);
    const checkVisibility = useVisibleImpression({enabled: eligible && !!offer && !paywallOpen && !obscured, targetRef, viewportRef, topInset,
        onImpression: () => Analytics.subscriptionFunnel({step: 'discovery_view', placement}, watchRegion)});
    useImperativeHandle(ref, () => ({checkVisibility}), [checkVisibility]);

    if (!eligible || !offer) return null;

    const open = () => {
        if (dismissedRef.current || nudge.isDiscoveryDismissed() || pendingPaywall.current || paywallOpen) return;
        Analytics.subscriptionFunnel({step: 'discovery_opened', placement}, watchRegion);
        pendingPaywall.current = true;
        showPaywall(placement, () => { pendingPaywall.current = false; });
    };

    const dismiss = () => {
        if (dismissedRef.current) return;
        dismissedRef.current = true;
        Analytics.subscriptionFunnel({step: 'discovery_dismissed', placement}, watchRegion);
        setDismissed(true);
        nudge.dismissDiscovery();
    };

    return <View ref={targetRef} collapsable={false} onLayout={checkVisibility}
        style={[styles.card, {backgroundColor: colors.surface, borderColor: colors.border}, style]}>
        <ThemedText type="defaultSemiBold">Enjoy Yify without ads</ThemedText>
        <ThemedText style={{color: colors.textMuted}}>Remove Yify ads with Supporter. Personal viewing insights are included.</ThemedText>
        <ThemedText type="defaultSemiBold">{offerDisclosure(offer)}</ThemedText>
        <ThemedText type="caption" style={{color: colors.textMuted}}>YouTube and streaming-service ads are separate.</ThemedText>
        <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={open}
                style={[styles.button, {backgroundColor: colors.accentStrong}]}>
                <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>View ad-free plan</ThemedText>
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
    button: {minHeight: 48, flexShrink: 1, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.md,
        justifyContent: 'center', alignItems: 'center'},
});
