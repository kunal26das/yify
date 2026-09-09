import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import type {AuthSession, PurchaseOffer, PurchasePlacement} from '@/domain';
import {useAdGateway, useAuthRepository, usePurchaseRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {ThemedText} from '../components/themed-text';
import {Analytics} from '../analytics/events';
import {offerDisclosure, purchaseFailureMessage, safeManagementURL, supporterStatus} from './offer-copy';

const PRIVACY_URL = 'https://www.freeprivacypolicy.com/live/a06bb609-730e-41fe-8ca4-c5494cdad41e';
const NO_OFFERS: PurchaseOffer[] = [];
type Request = {id: number; placement: PurchasePlacement; onClose?: (supported: boolean) => void};
type ShowPaywall = (placement: PurchasePlacement, onClose?: Request['onClose']) => void;
const SupporterContext = createContext<ShowPaywall | null>(null);

export function useSupporterPaywall(): ShowPaywall {
    const show = useContext(SupporterContext);
    if (!show) throw new Error('useSupporterPaywall requires SupporterProvider');
    return show;
}

export function SupporterProvider({children}: {children: ReactNode}) {
    const [requests, setRequests] = useState<Request[]>([]);
    const nextId = useRef(0);
    const show = useCallback<ShowPaywall>((placement, onClose) => {
        const next = {id: nextId.current++, placement, onClose};
        // A second request must not replace an open checkout or lose its completion callback.
        setRequests((current) => [...current, next]);
    }, []);
    const request = requests[0];
    return <SupporterContext.Provider value={show}>
        {children}
        {request ? <SupporterPaywall key={request.id} request={request} onClose={() => {
            setRequests((current) => current[0]?.id === request.id ? current.slice(1) : current);
        }}/> : null}
    </SupporterContext.Provider>;
}

function SupporterPaywall({request, onClose}: {request: Request; onClose: () => void}) {
    const session = useAuth();
    return <SupporterPaywallContent key={session.account?.uid ?? 'anonymous'} request={request}
        onClose={onClose} session={session}/>;
}

function SupporterPaywallContent({request, onClose, session}: {request: Request; onClose: () => void; session: AuthSession}) {
    const purchases = usePurchaseRepository();
    const auth = useAuthRepository();
    const ads = useAdGateway();
    const state = usePurchases();
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const {height} = useWindowDimensions();
    const [reload, setReload] = useState(0);
    const loadKey = useMemo(() => ({ready: state.ready, reload, placement: request.placement, purchases}),
        [state.ready, reload, request.placement, purchases]);
    const [loaded, setLoaded] = useState<{key: typeof loadKey; offers: PurchaseOffer[]} | null>(null);
    const loading = state.ready && loaded?.key !== loadKey;
    const offers = !loading && state.ready ? loaded?.offers ?? NO_OFFERS : NO_OFFERS;
    const [visible, setVisible] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const [acting, setActing] = useState(false);
    const operation = useRef(false);
    const mounted = useRef(true);
    const tracked = useRef(new Set<string>());
    const prompted = useRef(false);
    const closed = useRef(false);
    const busy = acting || state.purchasing != null || state.restoring || session.signingIn;

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        if (!loadKey.ready) return;
        let active = true;
        void loadKey.purchases.getOffers(loadKey.placement).then((next) => {
            if (active) setLoaded({key: loadKey, offers: next});
        }, () => { if (active) setLoaded({key: loadKey, offers: []}); });
        return () => { active = false; };
    }, [loadKey]);

    useEffect(() => {
        if (!visible || loading || !state.ready || state.adsRemoved) return;
        for (const offer of offers) {
            const offering = offer.offeringId ?? offer.id;
            if (tracked.current.has(offering)) continue;
            tracked.current.add(offering);
            purchases.trackPaywallImpression(offer.id);
        }
    }, [offers, purchases, state.adsRemoved, state.ready, visible, loading]);

    const close = () => {
        if (busy || operation.current || closed.current) return;
        closed.current = true;
        onClose();
        request.onClose?.(purchases.getState().adsRemoved);
    };
    const runAction = async (action: () => Promise<string | null>) => {
        if (busy || operation.current) return;
        operation.current = true;
        setActing(true);
        setNotice(null);
        try {
            const message = await action();
            if (mounted.current) setNotice(message);
        } finally {
            operation.current = false;
            if (mounted.current) setActing(false);
        }
    };
    const buy = (offer: PurchaseOffer) => {
        if (!state.ready || !session.account) return;
        void runAction(async () => {
            try {
                const granted = await purchases.purchase(offer.id);
                return granted ? 'Thank you for supporting Yify. Your access is now active.' : purchaseFailureMessage(purchases.getState().failure);
            } catch { return 'The payment could not be completed. Check access before trying again.'; }
        });
    };
    const restore = () => {
        if (!session.account) return;
        void runAction(async () => {
            try {
                const restored = await purchases.restore();
                return restored ? 'Your supporter access is active.' : purchaseFailureMessage(purchases.getState().failure) ?? (Platform.OS === 'web'
                    ? 'No active purchase was found for this Yify account. Sign in with the account you used to pay. For an App Store or Google Play purchase, restore in the mobile app.'
                    : 'No active purchase was found. Check that you are using the store account you used to pay.');
            } catch { return 'We could not restore purchases. Please try again.'; }
        });
    };
    const signIn = () => {
        void runAction(async () => {
            try { return await auth.signIn() ? null : 'Sign-in did not finish. Please try again to link your purchase to your account.'; }
            catch { return 'Sign-in could not be completed. Please try again.'; }
        });
    };
    const refresh = async () => {
        try {
            await purchases.refresh();
            if (mounted.current) setNotice(purchases.getState().ready ? supporterStatus(purchases.getState())
                : 'Supporter options could not connect. Check your connection and try again.');
        } catch { if (mounted.current) setNotice('Access could not be refreshed. Please try again.'); }
    };
    const openLink = async (url: string) => {
        try { await Linking.openURL(url); }
        catch { if (mounted.current) setNotice('This link could not be opened. Please try again.'); }
    };
    const openPrivacyPolicy = async () => {
        try {
            if (Platform.OS === 'android') {
                await WebBrowser.openBrowserAsync(PRIVACY_URL, {enableBarCollapsing: true});
            } else {
                await Linking.openURL(PRIVACY_URL);
            }
        } catch { if (mounted.current) setNotice('This link could not be opened. Please try again.'); }
    };
    const managementURL = safeManagementURL(state.managementURL);
    const message = notice ?? purchaseFailureMessage(state.failure);

    return <Modal visible transparent animationType="fade" onRequestClose={close} onShow={() => {
        setVisible(true);
        if (!prompted.current) {
            prompted.current = true;
            Analytics.supporterPrompt(request.placement === 'settings_supporter' ? 'settings' : 'post_ad');
        }
    }}>
        <View style={[styles.scrim, {backgroundColor: colors.scrim, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16}]}>
            <View style={[styles.panel, {backgroundColor: colors.surfaceElevated, maxHeight: Math.max(0, height - insets.top - insets.bottom - 32)}]}
                accessibilityViewIsModal onAccessibilityEscape={close}>
                <View style={styles.header}>
                    <ThemedText accessibilityRole="header" type="heading" style={styles.heading}>{state.adsRemoved ? 'Your Yify support' : 'Support Yify'}</ThemedText>
                    <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close supporter options"
                        accessibilityState={{disabled: busy}} style={styles.close}>
                        <ThemedText style={{color: colors.accent, fontWeight: '700'}}>{state.adsRemoved ? 'Done' : 'Close'}</ThemedText>
                    </Pressable>
                </View>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                    <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{state.adsRemoved ? supporterStatus(state)
                        : ads.supported ? 'Support an independent app and turn off Yify ads on every device signed into your account. YouTube may still show its own ads in trailers.'
                            : 'Support an independent app. Your support follows your Yify account across devices and includes removal of Yify ads where they are shown. YouTube ads are separate.'}</ThemedText>
                    {!state.adsRemoved && (state.expiresAt || state.billingIssue) ? <ThemedText style={styles.copy}>{supporterStatus(state)}</ThemedText> : null}
                    {loading || state.refreshing ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading supporter options"/> : null}
                    {!state.ready ? <ThemedText style={styles.copy}>{state.available
                        ? 'Supporter options are not connected yet. Use Refresh access below to try again.'
                        : 'Purchases are unavailable in this version of the app.'}</ThemedText> : null}
                    {!state.adsRemoved && !session.account ? <>
                        <ThemedText style={styles.copy}>Sign in so your purchase stays with your Yify account.</ThemedText>
                        <PaywallButton label={session.signingIn ? 'Signing in…' : session.available ? 'Sign in with Google' : 'Sign-in unavailable'}
                            onPress={signIn} disabled={busy || !session.ready || !session.available} primary/>
                    </> : null}
                    {!state.adsRemoved && state.ready && !loading ? offers.map((offer) => <View key={offer.id} style={[styles.plan, {borderColor: colors.border}]}>
                        <ThemedText style={styles.planTitle}>{offer.title}</ThemedText>
                        <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{offerDisclosure(offer)}</ThemedText>
                        <PaywallButton label={state.purchasing === offer.id ? 'Processing…' : `Continue · ${offer.priceLabel}`}
                            onPress={() => buy(offer)} disabled={busy || !session.account} primary/>
                    </View>) : null}
                    {!state.adsRemoved && state.ready && !loading && offers.length === 0 ? <ThemedText style={styles.copy}>Supporter plans are unavailable right now. You can still check an existing purchase below.</ThemedText> : null}
                    {!state.adsRemoved && state.ready ? <PaywallButton label="Reload plans" onPress={() => { setReload((value) => value + 1); }} disabled={busy || loading}/> : null}
                    {message ? <ThemedText accessibilityLiveRegion="polite" style={[styles.copy, {color: colors.accent}]}>{message}</ThemedText> : null}
                    {managementURL ? <PaywallButton label="Manage billing or cancel" onPress={() => { void openLink(managementURL); }} disabled={busy}/> : null}
                    <PaywallButton label={state.restoring ? 'Checking purchases…' : Platform.OS === 'web' ? 'Check account purchases' : 'Restore purchases'}
                        onPress={restore} disabled={busy || !state.ready || !session.account || !state.available}/>
                    <PaywallButton label={state.refreshing ? 'Checking access…' : 'Refresh access'} onPress={() => { void refresh(); }} disabled={busy || state.refreshing || !state.available}/>
                    <ThemedText style={[styles.fine, {color: colors.textMuted}]}>Prices above are the regular prices. Any eligible trial or introductory offer and the final billing details are confirmed at checkout. Manage or cancel a subscription in the store where you paid. Cancellation keeps access until the paid period ends.</ThemedText>
                    <Pressable accessibilityRole="link" onPress={() => { void openPrivacyPolicy(); }} style={styles.privacy}>
                        <ThemedText style={{color: colors.accent}}>Privacy policy</ThemedText>
                    </Pressable>
                </ScrollView>
            </View>
        </View>
    </Modal>;
}

function PaywallButton({label, onPress, disabled = false, primary = false}: {
    label: string; onPress: () => void; disabled?: boolean; primary?: boolean;
}) {
    const {colors} = usePalette();
    return <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
        accessibilityState={{disabled}} style={[styles.button, {borderColor: colors.border,
            backgroundColor: primary ? colors.accentStrong : colors.surfaceSunken, opacity: disabled ? 0.5 : 1}]}>
        <ThemedText style={[styles.buttonText, {color: primary ? colors.onAccent : colors.text}]}>{label}</ThemedText>
    </Pressable>;
}

const styles = StyleSheet.create({
    scrim: {flex: 1, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center'},
    panel: {width: '100%', maxWidth: 520, flexShrink: 1, borderRadius: 24, overflow: 'hidden'},
    header: {flexDirection: 'row', alignItems: 'center', flexShrink: 0, padding: 20, gap: 12},
    heading: {flex: 1}, close: {minHeight: 44, minWidth: 48, alignItems: 'center', justifyContent: 'center'},
    scroll: {flexShrink: 1, minHeight: 0},
    content: {padding: 20, paddingTop: 0, gap: 14}, copy: {fontSize: 15, lineHeight: 22},
    plan: {padding: 16, borderWidth: 1, borderRadius: 16, gap: 12}, planTitle: {fontSize: 18, fontWeight: '700'},
    button: {minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 14, justifyContent: 'center'},
    buttonText: {fontWeight: '700', textAlign: 'center'}, fine: {fontSize: 12, lineHeight: 18},
    privacy: {minHeight: 44, justifyContent: 'center', alignItems: 'center'},
});
