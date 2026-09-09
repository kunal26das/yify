import {useCallback, useRef} from 'react';

import type {AdTrigger, PurchaseOffer, PurchaseRepository} from '@/domain';
import {Analytics} from '../analytics/events';
import {useSupporterPaywall} from '../purchases/supporter-paywall';
import {
    useAdGateway,
    useAuthRepository,
    usePurchaseRepository,
    useSupporterNudge,
} from '../di/DependenciesContext';

export type AdBreak = (trigger: AdTrigger, onDone: () => void) => void;

// A slow optional supporter prompt must not delay starting the requested video.
async function promptOffers(purchases: PurchaseRepository): Promise<PurchaseOffer[]> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        return await Promise.race([
            purchases.getOffers('post_ad_supporter'),
            new Promise<PurchaseOffer[]>((resolve) => { timer = setTimeout(() => resolve([]), 1500); }),
        ]);
    } finally {
        if (timer != null) clearTimeout(timer);
    }
}

export function useAdBreak(): AdBreak {
    const ads = useAdGateway();
    const nudge = useSupporterNudge();
    const purchases = usePurchaseRepository();
    const auth = useAuthRepository();
    const showSupporter = useSupporterPaywall();
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
            let finished = false;
            const done = () => {
                if (finished) return;
                finished = true;
                onDone();
            };
            const settle = async (shown: boolean) => {
                if (inFlight.current === pending) inFlight.current = null;
                if (!shown || shared) { done(); return; }
                nudge.recordAdShown();
                if (!nudge.shouldPrompt()) { done(); return; }
                const {account, available: canSignIn} = auth.getSession();
                if (account == null && !canSignIn) { done(); return; }
                const offers = await promptOffers(purchases);
                if (offers.length === 0 || purchases.getState().adsRemoved) { done(); return; }
                nudge.recordPrompted();
                showSupporter('post_ad_supporter', (supported) => {
                    if (finished) return;
                    if (supported) nudge.recordAccepted();
                    else {
                        nudge.recordDeclined();
                        Analytics.supporterNudgeDeclined('post_ad');
                    }
                    done();
                });
            };
            void pending.then(settle, () => settle(false)).catch(done);
        },
        [ads, auth, nudge, purchases, showSupporter],
    );
}
