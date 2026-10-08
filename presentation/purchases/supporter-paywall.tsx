import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject} from 'react';
import {ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {AuthSession, PurchaseOffer, PurchasePlacement} from '@/domain';
import {useAuthRepository, usePurchaseRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {usePreferences} from '../hooks/use-preferences';
import {ThemedText} from '../components/themed-text';
import {Analytics} from '../analytics/events';
import {offerDisclosure, purchaseFailureMessage, safeManagementURL, supporterStatus} from './offer-copy';
import {SupporterInsightsPreview} from './supporter-benefits';
import {LEGAL_LINKS, openLegalPage} from '../constants/legal';

const NO_OFFERS: PurchaseOffer[] = [];
type Request = {id: number; placement: PurchasePlacement; onClose?: (supported: boolean) => void; cancelled: boolean};
type ShowPaywall = (placement: PurchasePlacement, onClose?: Request['onClose']) => () => void;
const SupporterContext = createContext<ShowPaywall | null>(null);
const SupporterVisibilityContext = createContext(false);

export function useSupporterPaywallVisible(): boolean {
    return useContext(SupporterVisibilityContext);
}

export function useSupporterPaywall(): ShowPaywall {
    const show = useContext(SupporterContext);
    if (!show) throw new Error('useSupporterPaywall requires SupporterProvider');
    return show;
}

export function SupporterProvider({children}: {children: ReactNode}) {
    const [requests, setRequests] = useState<Request[]>([]);
    const nextId = useRef(0);
    const show = useCallback<ShowPaywall>((placement, onClose) => {
        const next: Request = {id: nextId.current++, placement, onClose, cancelled: false};
        setRequests((current) => [...current, next]);
        return () => {
            if (next.cancelled) return;
            next.cancelled = true;
            setRequests(current => current[0]?.id === next.id
                ? [...current] : current.filter(item => item.id !== next.id));
        };
    }, []);
    const request = requests[0];
    return <SupporterContext.Provider value={show}>
        <SupporterVisibilityContext.Provider value={requests.length > 0}>
            {children}
            {request ? <SupporterPaywall key={request.id} request={request} onClose={() => {
                setRequests((current) => current[0]?.id === request.id ? current.slice(1) : current);
            }}/> : null}
        </SupporterVisibilityContext.Provider>
    </SupporterContext.Provider>;
}

function SupporterPaywall({request, onClose}: {request: Request; onClose: () => void}) {
    const session = useAuth();
    const [acting, setActing] = useState(false);
    const operationRef = useRef(false);
    return <SupporterPaywallContent key={session.account?.uid ?? 'anonymous'} request={request}
        onClose={onClose} session={session} acting={acting} setActing={setActing} operationRef={operationRef}/>;
}

function SupporterPaywallContent({request, onClose, session, acting, setActing, operationRef}: {
    request: Request; onClose: () => void; session: AuthSession;
    acting: boolean; setActing: (value: boolean) => void; operationRef: RefObject<boolean>;
}) {
    const purchases = usePurchaseRepository();
    const auth = useAuthRepository();
    const state = usePurchases();
    const {colors} = usePalette();
    const {watchRegion} = usePreferences();
    const insets = useSafeAreaInsets();
    const {height, width, fontScale} = useWindowDimensions();
    const headingInContent = width / fontScale < 240;
    const [reload, setReload] = useState(0);
    const loadKey = useMemo(() => ({ready: state.ready, reload, placement: request.placement, purchases}),
        [state.ready, reload, request.placement, purchases]);
    const [loaded, setLoaded] = useState<{key: typeof loadKey; offers: PurchaseOffer[]} | null>(null);
    const loading = state.ready && loaded?.key !== loadKey;
    const offers = !loading && state.ready ? loaded?.offers ?? NO_OFFERS : NO_OFFERS;
    const [visible, setVisible] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const mounted = useRef(true);
    const tracked = useRef(new Set<string>());
    const offersTracked = useRef(false);
    const prompted = useRef(false);
    const closed = useRef(false);
    const busy = acting || state.purchasing != null || state.restoring || session.signingIn;

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        if (!request.cancelled || busy || operationRef.current || closed.current) return;
        closed.current = true;
        onClose();
    }, [request.cancelled, busy, operationRef, onClose]);

    useEffect(() => {
        if (!loadKey.ready || request.cancelled) return;
        let active = true;
        void loadKey.purchases.getOffers(loadKey.placement).then((next) => {
            if (active) setLoaded({key: loadKey, offers: next});
        }, () => { if (active) setLoaded({key: loadKey, offers: []}); });
        return () => { active = false; };
    }, [loadKey, request.cancelled]);

    useEffect(() => {
        if (request.cancelled || !visible || loading || !state.ready || state.adsRemoved) return;
        if (offers.length > 0 && !offersTracked.current) {
            offersTracked.current = true;
            Analytics.subscriptionFunnel({step: 'offers_visible', placement: request.placement, offerCount: offers.length}, watchRegion);
        }
        for (const offer of offers) {
            const offering = offer.offeringId ?? offer.id;
            if (tracked.current.has(offering)) continue;
            tracked.current.add(offering);
            purchases.trackPaywallImpression(offer.id);
        }
    }, [offers, purchases, state.adsRemoved, state.ready, visible, loading, request.placement, request.cancelled, watchRegion]);

    const close = () => {
        if (busy || operationRef.current || closed.current || request.cancelled) return;
        closed.current = true;
        Analytics.subscriptionFunnel({step: 'paywall_closed', placement: request.placement,
            supporter: purchases.getState().adsRemoved}, watchRegion);
        onClose();
        request.onClose?.(purchases.getState().adsRemoved);
    };
    const runAction = async (action: () => Promise<string | null>) => {
        if (busy || operationRef.current || request.cancelled) return;
        operationRef.current = true;
        setActing(true);
        setNotice(null);
        try {
            const message = await action();
            if (mounted.current) setNotice(message);
        } finally {
            operationRef.current = false;
            setActing(false);
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
        const current = auth.getSession();
        if (current.account || !current.ready || !current.available || current.signingIn) return;
        void runAction(async () => {
            Analytics.subscriptionFunnel({step: 'sign_in_started', placement: request.placement}, watchRegion);
            try {
                const accepted = await auth.signIn();
                const latest = auth.getSession();
                if (accepted && !latest.account && latest.signingIn) return null;
                const outcome = latest.account ? 'signed_in' : latest.error || accepted ? 'failed' : 'cancelled';
                Analytics.subscriptionFunnel({step: 'sign_in_finished', placement: request.placement, outcome}, watchRegion);
                return outcome === 'signed_in' ? null : outcome === 'cancelled'
                    ? 'Sign-in was cancelled. No purchase was made.'
                    : 'Sign-in could not be completed. Please try again.';
            } catch {
                Analytics.subscriptionFunnel({step: 'sign_in_finished', placement: request.placement, outcome: 'failed'}, watchRegion);
                return 'Sign-in could not be completed. Please try again.';
            }
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
    const openLegalLink = async (url: string) => {
        try {
            await openLegalPage(url);
        } catch { if (mounted.current) setNotice('This link could not be opened. Please try again.'); }
    };
    const managementURL = safeManagementURL(state.managementURL);
    const message = notice ?? purchaseFailureMessage(state.failure);
    const heading = <ThemedText accessibilityRole="header" type="heading" style={headingInContent ? undefined : styles.heading}>{state.adsRemoved ? 'Your Yify support' : 'Yify Supporter'}</ThemedText>;

    return <Modal visible transparent animationType="fade" onRequestClose={close} onShow={() => {
        if (request.cancelled) return;
        setVisible(true);
        if (!prompted.current) {
            prompted.current = true;
            Analytics.subscriptionFunnel({step: 'paywall_view', placement: request.placement,
                signedIn: session.account != null, supporter: state.adsRemoved}, watchRegion);
        }
    }}>
        <View style={[styles.scrim, {backgroundColor: colors.scrim, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16}]}>
            <View style={[styles.panel, {backgroundColor: colors.surfaceElevated, maxHeight: Math.max(0, height - insets.top - insets.bottom - 32)}]}
                accessibilityViewIsModal onAccessibilityEscape={close}>
                <View style={styles.header}>
                    {headingInContent ? <View style={styles.heading}/> : heading}
                    <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close supporter options"
                        accessibilityState={{disabled: busy}} style={styles.close}>
                        <ThemedText style={{color: colors.accent, fontWeight: '700'}}>{state.adsRemoved ? 'Done' : 'Close'}</ThemedText>
                    </Pressable>
                </View>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                    {headingInContent ? heading : null}
                    {!state.adsRemoved ? <ThemedText type="heading">Remove Yify ads</ThemedText> : null}
                    <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{state.adsRemoved ? supporterStatus(state)
                        : 'Browse Yify without ads placed by Yify. YouTube and other external-service ads are separate.'}</ThemedText>
                    {!state.adsRemoved ? <ThemedText style={[styles.fine, {color: colors.textMuted}]}>Also includes monthly and all-time viewing insights. Your journal entries and editing stay free. Supporter access follows your Yify account across devices.</ThemedText> : null}
                    {!state.adsRemoved && (state.expiresAt || state.billingIssue) ? <ThemedText style={styles.copy}>{supporterStatus(state)}</ThemedText> : null}
                    {loading || state.refreshing ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading supporter options"/> : null}
                    {!state.ready ? <ThemedText style={styles.copy}>{state.available
                        ? 'Supporter options are not connected yet. Use Refresh access below to try again.'
                        : 'Purchases are unavailable in this version of the app.'}</ThemedText> : null}
                    {!state.adsRemoved && state.ready && !loading ? offers.map((offer) => <View key={offer.id} style={[styles.plan, {borderColor: colors.border}]}>
                        <ThemedText style={styles.planTitle}>{offer.title}</ThemedText>
                        <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{offerDisclosure(offer)}</ThemedText>
                        {session.account ? <PaywallButton label={state.purchasing === offer.id ? 'Processing…' : `Continue · ${offer.priceLabel}`}
                            onPress={() => buy(offer)} disabled={busy} primary/> : null}
                    </View>) : null}
                    {!state.adsRemoved && state.ready && !loading && offers.length === 0 ? <ThemedText style={styles.copy}>Supporter plans are unavailable right now. You can still check an existing purchase below.</ThemedText> : null}
                    {!state.adsRemoved && !session.account ? <>
                        <ThemedText style={styles.copy}>Sign in to keep supporter access with your Yify account. Signing in does not start a subscription.</ThemedText>
                        <PaywallButton label={session.signingIn ? 'Signing in…' : session.available ? 'Sign in with Google' : 'Sign-in unavailable'}
                            onPress={signIn} disabled={busy || !session.ready || !session.available} primary/>
                    </> : null}
                    {message ? <ThemedText accessibilityLiveRegion="polite" style={[styles.copy, {color: colors.accent}]}>{message}</ThemedText> : null}
                    {!state.adsRemoved ? <SupporterInsightsPreview/> : null}
                    {!state.adsRemoved && state.ready ? <PaywallButton label="Reload plans" onPress={() => { setReload((value) => value + 1); }} disabled={busy || loading}/> : null}
                    {managementURL ? <PaywallButton label="Manage billing or cancel" onPress={() => { void openLink(managementURL); }} disabled={busy}/> : null}
                    {session.account ? <PaywallButton label={state.restoring ? 'Checking purchases…' : Platform.OS === 'web' ? 'Check account purchases' : 'Restore purchases'}
                        onPress={restore} disabled={busy || !state.ready || !state.available}/> : null}
                    <PaywallButton label={state.refreshing ? 'Checking access…' : 'Refresh access'} onPress={() => { void refresh(); }} disabled={busy || state.refreshing || !state.available}/>
                    <ThemedText style={[styles.fine, {color: colors.textMuted}]}>Prices above are the regular prices. Any eligible trial or introductory offer and the final billing details are confirmed at checkout. Manage or cancel a subscription in the store where you paid. Cancellation keeps access until the paid period ends.</ThemedText>
                    {LEGAL_LINKS.map(link => <Pressable key={link.url} accessibilityRole="link"
                        onPress={() => { void openLegalLink(link.url); }} style={styles.privacy}>
                        <ThemedText style={{color: colors.accent}}>{link.label}</ThemedText>
                    </Pressable>)}
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
    heading: {flex: 1, minWidth: 0}, close: {minHeight: 44, minWidth: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
    scroll: {flexShrink: 1, minHeight: 0},
    content: {padding: 20, paddingTop: 0, gap: 14}, copy: {fontSize: 15, lineHeight: 22},
    plan: {padding: 16, borderWidth: 1, borderRadius: 16, gap: 12}, planTitle: {fontSize: 18, fontWeight: '700'},
    button: {minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 14, justifyContent: 'center'},
    buttonText: {fontWeight: '700', textAlign: 'center'}, fine: {fontSize: 12, lineHeight: 18},
    privacy: {minHeight: 44, justifyContent: 'center', alignItems: 'center'},
});
