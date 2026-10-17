import {useCallback, useRef} from 'react';

import type {AdTrigger} from '@/domain';
import {useAdGateway, useSupporterNudge} from '../di/DependenciesContext';

export type AdBreak = (trigger: AdTrigger, onDone: () => void) => void;

export function useAdBreak(): AdBreak {
    const ads = useAdGateway();
    const nudge = useSupporterNudge();
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
            const settle = (shown: boolean) => {
                if (inFlight.current === pending) inFlight.current = null;
                if (shown && !shared) nudge.recordAdShown();
                done();
            };
            void pending.then(settle, () => settle(false)).catch(done);
        },
        [ads, nudge],
    );
}
