import {useCallback, useRef} from 'react';

import type {AdTrigger} from '@/domain';
import {Analytics} from '../analytics/events';
import {useConfirm} from '../components/confirm-dialog';
import {
    useAdGateway,
    useAuthRepository,
    usePurchaseRepository,
    useSupporterNudge,
} from '../di/DependenciesContext';

export type AdBreak = (trigger: AdTrigger, onDone: () => void) => void;

const YOUTUBE_CAVEAT = "Trailers still play YouTube's own ads, which no app can remove.";

export function useAdBreak(): AdBreak {
    const ads = useAdGateway();
    const nudge = useSupporterNudge();
    const purchases = usePurchaseRepository();
    const auth = useAuthRepository();
    const confirm = useConfirm();
    const inFlight = useRef<Promise<boolean> | null>(null);

    return useCallback(
        (trigger, onDone) => {
            const pending = ads.show(trigger);
            if (pending == null) {
                onDone();
                return;
            }

            const shared = inFlight.current === pending;
            inFlight.current = pending;

            const settle = (shown: boolean) => {
                if (inFlight.current === pending) inFlight.current = null;
                if (!shown || shared) {
                    onDone();
                    return;
                }
                nudge.recordAdShown();
                if (!nudge.shouldPrompt()) {
                    onDone();
                    return;
                }
                const offer = purchases.getState().offers[0];
                const {account, available: canSignIn} = auth.getSession();
                if (offer == null || (account == null && !canSignIn)) {
                    onDone();
                    return;
                }

                nudge.recordPrompted();
                Analytics.supporterPrompt('post_ad');

                const terms = offer.recurring
                    ? 'billed monthly until you cancel'
                    : 'one payment, nothing renews';

                confirm({
                    title: 'Watch without ads?',
                    message:
                        account == null
                            ? `Yify is built by one person. Sign in, and ${offer.priceLabel} turns off the ads in Yify on every device you use. ${YOUTUBE_CAVEAT}`
                            : `Yify is built by one person. ${offer.priceLabel}, ${terms}. It turns off the ads in Yify on every device you sign in on. ${YOUTUBE_CAVEAT}`,
                    confirmLabel:
                        account == null ? 'Sign in' : `Remove ads · ${offer.priceLabel}`,
                    cancelLabel: 'Not now',
                    icon: 'heart-outline',
                    destructive: false,
                    onConfirm: () => {
                        nudge.recordAccepted();
                        const flow =
                            account == null ? auth.signIn() : purchases.purchase(offer.id);
                        void flow.then(onDone, onDone);
                    },
                    onCancel: () => {
                        nudge.recordDeclined();
                        Analytics.supporterNudgeDeclined('post_ad');
                        onDone();
                    },
                });
            };

            void pending.then(settle, () => settle(false));
        },
        [ads, auth, confirm, nudge, purchases],
    );
}
