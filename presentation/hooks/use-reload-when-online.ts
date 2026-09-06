import {useEffect, useRef} from 'react';
import {useIsOnline} from './use-is-online';

export function useReloadWhenOnline(reload: () => void, blocked: boolean): void {
    const online = useIsOnline();
    const wasOffline = useRef(!online);
    useEffect(() => {
        if (!online) {
            wasOffline.current = true;
            return;
        }
        if (!wasOffline.current) return;
        wasOffline.current = false;
        if (blocked) reload();
    }, [online, blocked, reload]);
}
