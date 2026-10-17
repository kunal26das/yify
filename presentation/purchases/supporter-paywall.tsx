import {createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ElementRef, type ReactNode, type RefObject} from 'react';
import {ActivityIndicator, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, View, useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {router} from 'expo-router';
import type {AuthSession, PurchaseOffer, PurchasePlacement} from '@/domain';
import {useAuthRepository, usePurchaseRepository} from '../di/DependenciesContext';
import {useAuth} from '../hooks/use-auth';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {usePreferences} from '../hooks/use-preferences';
import {ThemedText} from '../components/themed-text';
import {Analytics} from '../analytics/events';
import {subscriptionOffers, offerDisclosure, purchaseFailureMessage, purchaseLabel, safeManagementURL, supporterStatus} from './offer-copy';
import {SupporterBenefits} from './supporter-benefits';
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

export function SupporterMembership({active, onOpenJournal, onOpenInsights}: {
    active: boolean; onOpenJournal: () => void; onOpenInsights: () => void;
}) {
    const session = useAuth();
    const obscured = useSupporterPaywallVisible();
    const [acting, setActing] = useState(false);
    const operationRef = useRef(false);
    const request = useMemo<Request>(() => ({id: -1, placement: 'supporter_page', cancelled: false}), []);
    return <SupporterPaywallContent key={session.account?.uid ?? 'anonymous'} request={request}
        onClose={() => {}} session={session} acting={acting} setActing={setActing} operationRef={operationRef}
        inline active={active && !obscured} onOpenJournal={onOpenJournal} onOpenInsights={onOpenInsights}/>;
}

function SupporterPaywallContent({request, onClose, session, acting, setActing, operationRef, inline = false,
    active = true, onOpenJournal, onOpenInsights}: {
    request: Request; onClose: () => void; session: AuthSession;
    acting: boolean; setActing: (value: boolean) => void; operationRef: RefObject<boolean>;
    inline?: boolean; active?: boolean; onOpenJournal?: () => void; onOpenInsights?: () => void;
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
    const offers = subscriptionOffers(!loading && state.ready && state.available ? loaded?.offers ?? NO_OFFERS : NO_OFFERS)
        .sort((left, right) => Number(right.billingPeriod === 'P1Y') - Number(left.billingPeriod === 'P1Y'));
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [focusedId, setFocusedId] = useState<string | null>(null);
    const planRefs = useRef(new Map<string, ElementRef<typeof Pressable>>());
    const selectedMissing = selectedId != null && offers.length > 0 && !offers.some(offer => offer.id === selectedId);
    const selectedOffer = offers.find(offer => offer.id === selectedId) ?? offers[0];
    const checkoutRef = useRef({loadKey, offers, selectedOfferId: selectedOffer?.id, loading, selectedMissing});
    checkoutRef.current = {loadKey, offers, selectedOfferId: selectedOffer?.id, loading, selectedMissing};
    const [visible, setVisible] = useState(false);
    const [notice, setNotice] = useState<string | null>(null);
    const mounted = useRef(true);
    const tracked = useRef(new Set<string>());
    const offersTracked = useRef(false);
    const prompted = useRef(false);
    const closed = useRef(false);
    const busy = acting || state.purchasing != null || state.restoring || state.refreshing || session.signingIn;
    const paymentUnconfirmed = !state.adsRemoved && (state.failure === 'pending' || state.failure === 'not_granted');

    const markVisible = useCallback(() => {
        if (request.cancelled) return;
        setVisible(true);
        if (!prompted.current) {
            prompted.current = true;
            Analytics.subscriptionFunnel({step: 'paywall_view', placement: request.placement,
                signedIn: session.account != null, supporter: state.adsRemoved}, watchRegion);
        }
    }, [request, session.account, state.adsRemoved, watchRegion]);

    useEffect(() => {
        if (!inline) return;
        if (active) markVisible();
        else setVisible(false);
    }, [inline, active, markVisible]);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    useEffect(() => {
        if (state.adsRemoved) setNotice(null);
    }, [state.adsRemoved]);

    useEffect(() => {
        if (loading || !state.ready || !state.available || !selectedOffer || selectedId !== null) return;
        setSelectedId(current => current ?? selectedOffer.id);
    }, [loading, state.ready, state.available, selectedOffer, selectedId]);

    useEffect(() => {
        if (loading || !state.ready || !state.available || !selectedMissing || !selectedOffer) return;
        setSelectedId(selectedOffer.id);
        setNotice('Your selected plan is no longer available. Review the available plan before subscribing.');
    }, [loading, state.ready, state.available, selectedMissing, selectedOffer]);

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
        if (request.cancelled || !visible || (inline && !active) || loading || !state.ready || state.adsRemoved) return;
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
    }, [offers, purchases, state.adsRemoved, state.ready, visible, loading, request.placement, request.cancelled, watchRegion, inline, active]);

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
        const current = purchases.getState();
        const currentSession = auth.getSession();
        const checkout = checkoutRef.current;
        if (!mounted.current || checkout.loading || checkout.selectedMissing || checkout.selectedOfferId !== offer.id ||
            checkout.loadKey !== loadKey || loaded?.key !== loadKey ||
            !checkout.offers.some(item => item.id === offer.id) || busy ||
            !current.ready || !current.available || current.adsRemoved || current.purchasing != null ||
            current.restoring || current.refreshing || current.failure === 'pending' || current.failure === 'not_granted' ||
            !session.ready || !session.account || !currentSession.ready || currentSession.signingIn ||
            currentSession.account?.uid !== session.account.uid || paymentUnconfirmed || (inline && !active)) return;
        void runAction(async () => {
            try {
                const granted = await purchases.purchase(offer.id);
                return granted ? 'Welcome to Yify Plus. Your access is now active.' : purchaseFailureMessage(purchases.getState().failure);
            } catch { return 'The payment could not be completed. Check access before trying again.'; }
        });
    };
    const restore = () => {
        if (!session.account) return;
        void runAction(async () => {
            try {
                const restored = await purchases.restore();
                return restored ? 'Your Plus access is active.' : purchaseFailureMessage(purchases.getState().failure) ?? (Platform.OS === 'web'
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
    const refresh = () => runAction(async () => {
        try {
            const verified = await purchases.refresh();
            const latest = purchases.getState();
            return verified ? latest.adsRemoved ? supporterStatus(latest) : purchaseFailureMessage(latest.failure) ?? supporterStatus(latest)
                : 'Access could not be refreshed. Check your connection and try again.';
        } catch { return 'Access could not be refreshed. Please try again.'; }
    });
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
    const message = notice ?? (state.adsRemoved ? null : purchaseFailureMessage(state.failure));
    const selectionDisabled = busy || loading || !state.ready || !state.available || !session.ready || paymentUnconfirmed || state.adsRemoved;
    const selectPlan = (offer: PurchaseOffer) => {
        if (selectionDisabled || !offers.some(item => item.id === offer.id)) return;
        setSelectedId(offer.id);
        setNotice(null);
    };
    const handlePlanKey = (key: string, index: number) => {
        if (selectionDisabled) return false;
        if (key === ' ' || key === 'Spacebar') {
            selectPlan(offers[index]);
            return true;
        }
        const forward = key === 'ArrowRight' || key === 'ArrowDown';
        const backward = key === 'ArrowLeft' || key === 'ArrowUp';
        if (!forward && !backward) return false;
        const next = offers[(index + (forward ? 1 : -1) + offers.length) % offers.length];
        selectPlan(next);
        planRefs.current.get(next.id)?.focus();
        return true;
    };
    const canReload = !state.adsRemoved && state.available && state.ready && (offers.length === 0 || state.failure === 'offer_unavailable');
    const canRefresh = !state.ready || state.adsRemoved || !!message || !!state.expiresAt || state.billingIssue;
    const hasUtilities = !!managementURL || !!session.account || canReload || canRefresh;
    const heading = <ThemedText accessibilityRole="header" type="heading" style={[styles.title, !headingInContent && !inline ? styles.heading : undefined]}>{paymentUnconfirmed ? 'Checking your purchase' : state.adsRemoved ? 'Your Plus access' : 'Yify Plus'}</ThemedText>;
    const openJournal = (insights: boolean) => {
        if (busy || operationRef.current || request.cancelled || closed.current || (inline && !active)) return;
        if (inline) (insights ? onOpenInsights : onOpenJournal)?.();
        else {
            close();
            router.push(insights ? '/journal?tab=insights' : '/journal');
        }
    };
    const body = <>
        {inline || headingInContent ? heading : null}
        {state.adsRemoved ? <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{supporterStatus(state)}</ThemedText> : null}
        <SupporterBenefits active={state.ready && state.adsRemoved}/>
        {!state.adsRemoved ? <ThemedText style={[styles.copy, {color: colors.textMuted}]}>Browsing, watchlists and journal entries stay free.</ThemedText> : null}
        {!state.adsRemoved && (state.expiresAt || state.billingIssue) ? <ThemedText style={styles.copy}>{supporterStatus(state)}</ThemedText> : null}
        {state.adsRemoved ? <>
            <PaywallButton label="Open viewing insights" onPress={() => openJournal(true)} disabled={busy || !state.ready} primary/>
            <PaywallButton label="Open movie journal" onPress={() => openJournal(false)} disabled={busy}/>
            <ThemedText style={[styles.fine, {color: colors.textMuted}]}>Start by logging a movie in your free journal. Your insights grow with the watches and ratings you add.</ThemedText>
        </> : null}
        {loading || state.refreshing ? <ActivityIndicator color={colors.accent} accessibilityLabel="Loading Plus options"/> : null}
        {!state.adsRemoved && (!state.available || !state.ready) ? <ThemedText style={styles.copy}>{state.available
            ? 'Plus options are not connected yet. Use Refresh access below to try again.'
            : 'Purchases are unavailable in this version of the app. Your free features are still available.'}</ThemedText> : null}
        {!state.adsRemoved && !paymentUnconfirmed && ((!loading && state.ready && state.available) || (!session.account && state.available)) ? <View style={styles.planSection}>
            {!state.adsRemoved && !loading && !paymentUnconfirmed && offers.length > 1 ? <ThemedText type="defaultSemiBold">Choose your plan</ThemedText> : null}
        {!state.adsRemoved && state.ready && !loading && !paymentUnconfirmed && offers.length > 0 ? <View
            accessibilityRole="radiogroup" accessibilityLabel="Choose your Plus plan" style={styles.plans}>
            {offers.map((offer, index) => {
                const checked = selectedOffer?.id === offer.id;
                const label = `${offer.billingPeriod === 'P1Y' ? 'Yearly Plus' : 'Monthly Plus'}. ${offerDisclosure(offer)}`;
                return <Pressable key={offer.id} ref={node => { if (node) planRefs.current.set(offer.id, node); else planRefs.current.delete(offer.id); }}
                    accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{checked, disabled: selectionDisabled}}
                    aria-checked={Platform.OS === 'web' ? checked : undefined}
                    aria-disabled={Platform.OS === 'web' ? selectionDisabled : undefined}
                    disabled={selectionDisabled} tabIndex={Platform.OS === 'web' ? checked ? 0 : -1 : undefined}
                    onFocus={() => setFocusedId(offer.id)} onBlur={() => setFocusedId(current => current === offer.id ? null : current)}
                    onKeyDown={Platform.OS === 'web' ? event => {
                        if (handlePlanKey(event.nativeEvent.key, index)) event.preventDefault();
                    } : undefined}
                    onPress={() => selectPlan(offer)} style={[styles.plan, {
                        borderColor: checked || focusedId === offer.id ? colors.accent : colors.border,
                        borderWidth: focusedId === offer.id && Platform.OS === 'web' ? 2 : 1,
                        backgroundColor: checked ? colors.accentSoft : colors.surfaceSunken,
                        opacity: selectionDisabled ? 0.5 : 1,
                    }]}>
                    <View style={styles.planRow} accessible={false}>
                        <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
                            style={[styles.radio, {borderColor: checked ? colors.accent : colors.borderStrong}]}>
                            {checked ? <View style={[styles.radioDot, {backgroundColor: colors.accent}]}/> : null}
                        </View>
                        <View style={styles.planCopy} accessible={false}>
                            <ThemedText style={styles.planTitle}>{offer.billingPeriod === 'P1Y' ? 'Yearly Plus' : 'Monthly Plus'}</ThemedText>
                            <ThemedText style={[styles.copy, {color: colors.textMuted}]}>{offerDisclosure(offer)}</ThemedText>
                        </View>
                    </View>
                </Pressable>;
            })}
        </View> : null}
        {!state.adsRemoved && state.ready && !loading && !paymentUnconfirmed && session.account && selectedOffer ?
            <PaywallButton label={state.purchasing === selectedOffer.id ? 'Processing…' : purchaseLabel(selectedOffer)}
                onPress={() => buy(selectedOffer)} disabled={busy || selectedMissing || !session.ready || !state.available || (inline && !active)} primary/> : null}
        {!state.adsRemoved && state.available && state.ready && !loading && offers.length === 0 ? <ThemedText style={styles.copy}>Plus plans are unavailable right now. You can still check an existing purchase below.</ThemedText> : null}
        {!state.adsRemoved && state.available && !session.account && !paymentUnconfirmed ? <>
            <ThemedText style={styles.copy}>{offers.length > 0
                ? 'Sign in to keep Plus access with your Yify account. Signing in does not start a subscription.'
                : 'Already have Plus? Sign in to check your account access. Signing in does not start a subscription.'}</ThemedText>
            <PaywallButton label={session.signingIn ? 'Signing in…' : session.available ? 'Sign in with Google' : 'Sign-in unavailable'}
                onPress={signIn} disabled={busy || !session.ready || !session.available} primary/>
        </> : null}
        </View> : null}
        {message ? <View style={[styles.notice, {backgroundColor: colors.accentSoft, borderColor: colors.border}]}>
            <ThemedText accessibilityLiveRegion="polite" style={styles.copy}>{message}</ThemedText>
        </View> : null}
        {hasUtilities ? <View style={[styles.utilities, {borderTopColor: colors.border}]}>
            <ThemedText type="defaultSemiBold">{paymentUnconfirmed ? 'Check your purchase' : state.adsRemoved ? 'Manage your access' : 'Already have Plus?'}</ThemedText>
            {canReload ? <PaywallButton label="Reload plans" onPress={() => { setReload((value) => value + 1); }} disabled={busy || loading}/> : null}
            {managementURL ? <PaywallButton label="Manage billing or cancel" onPress={() => { void openLink(managementURL); }} disabled={busy}/> : null}
            {session.account ? <PaywallButton label={state.restoring ? 'Checking purchases…' : Platform.OS === 'web' ? 'Check account purchases' : 'Restore purchases'}
                onPress={restore} disabled={busy || !state.ready || !state.available}/> : null}
            {canRefresh ? <PaywallButton label={state.refreshing ? 'Checking access…' : 'Refresh access'} onPress={() => { void refresh(); }} disabled={busy || !state.available}/> : null}
        </View> : null}
        <ThemedText style={[styles.fine, {color: colors.textMuted}]}>Any eligible trial or introductory offer and final billing details are confirmed at checkout. Manage or cancel a subscription in the store where you paid. Cancellation keeps access until the paid period ends.</ThemedText>
        <View style={styles.legal}>
            {LEGAL_LINKS.map(link => <Pressable key={link.url} accessibilityRole="link"
                onPress={() => { void openLegalLink(link.url); }} style={styles.privacy}>
                <ThemedText style={{color: colors.accent}}>{link.label}</ThemedText>
            </Pressable>)}
        </View>
    </>;

    if (inline) return <View style={styles.inline}>{body}</View>;
    return <Modal visible transparent animationType="fade" onRequestClose={close} onShow={markVisible}>
        <View style={[styles.scrim, {backgroundColor: colors.scrim, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16}]}>
            <View style={[styles.panel, {backgroundColor: colors.surfaceElevated, maxHeight: Math.max(0, height - insets.top - insets.bottom - 32)}]}
                accessibilityViewIsModal onAccessibilityEscape={close}>
                <View style={styles.header}>
                    {headingInContent ? <View style={styles.heading}/> : heading}
                    <Pressable onPress={close} disabled={busy} accessibilityRole="button" accessibilityLabel="Close Plus options"
                        accessibilityState={{disabled: busy}} style={styles.close}>
                        <ThemedText style={{color: colors.accent, fontWeight: '700'}}>{state.adsRemoved ? 'Done' : 'Close'}</ThemedText>
                    </Pressable>
                </View>
                <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                    {body}
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
    inline: {width: '100%', maxWidth: 640, alignSelf: 'center', gap: 16},
    title: {fontSize: 24, lineHeight: 34},
    legal: {flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16},
    scrim: {flex: 1, paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center'},
    panel: {width: '100%', maxWidth: 520, flexShrink: 1, borderRadius: 24, overflow: 'hidden'},
    header: {flexDirection: 'row', alignItems: 'center', flexShrink: 0, padding: 20, gap: 12},
    heading: {flex: 1, minWidth: 0}, close: {minHeight: 44, minWidth: 48, flexShrink: 0, alignItems: 'center', justifyContent: 'center'},
    scroll: {flexShrink: 1, minHeight: 0},
    content: {padding: 20, paddingTop: 0, gap: 14}, copy: {fontSize: 15, lineHeight: 22},
    planSection: {gap: 14},
    utilities: {gap: 12, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 16},
    notice: {padding: 14, borderWidth: 1, borderRadius: 14},
    plans: {gap: 12},
    plan: {padding: 16, borderWidth: 1, borderRadius: 16}, planRow: {flexDirection: 'row', gap: 12, alignItems: 'flex-start'},
    planCopy: {flex: 1, minWidth: 0, gap: 8}, planTitle: {fontSize: 18, fontWeight: '700'},
    radio: {width: 22, height: 22, borderWidth: 2, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2},
    radioDot: {width: 10, height: 10, borderRadius: 5},
    button: {minHeight: 48, padding: 14, borderWidth: 1, borderRadius: 14, justifyContent: 'center'},
    buttonText: {fontWeight: '700', textAlign: 'center'}, fine: {fontSize: 12, lineHeight: 18},
    privacy: {minHeight: 44, justifyContent: 'center', alignItems: 'center'},
});
