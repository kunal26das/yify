import {useCallback, useEffect, useRef, useState} from 'react';

export interface DocumentPipApi {
    supported: boolean;
    active: boolean;
    toggle: () => void;
    hostRef: (node: unknown) => void;
}

interface PipRequestOptions {
    width: number;
    height: number;
}

interface DocumentPictureInPicture {
    requestWindow(options: PipRequestOptions): Promise<Window>;
    window: Window | null;
}

function pipApi(): DocumentPictureInPicture | null {
    if (typeof window === 'undefined') return null;
    const candidate = (window as unknown as {documentPictureInPicture?: DocumentPictureInPicture})
        .documentPictureInPicture;
    return candidate ?? null;
}

const PIP_WIDTH = 480;
const PIP_HEIGHT = 270;

export function useDocumentPip(): DocumentPipApi {
    const [supported] = useState(() => pipApi() != null);
    const [active, setActive] = useState(false);

    const nodeRef = useRef<HTMLElement | null>(null);
    const homeRef = useRef<HTMLElement | null>(null);
    const cssRef = useRef<string>('');
    const windowRef = useRef<Window | null>(null);

    const restore = useCallback(() => {
        const node = nodeRef.current;
        const home = homeRef.current;
        if (node && home) {
            node.style.cssText = cssRef.current;
            home.appendChild(node);
        }
        homeRef.current = null;
        windowRef.current = null;
        setActive(false);
    }, []);

    const exit = useCallback(() => {
        const pipWindow = windowRef.current;
        if (pipWindow && !pipWindow.closed) {
            pipWindow.close();
            return;
        }
        restore();
    }, [restore]);

    const enter = useCallback(async () => {
        const api = pipApi();
        const node = nodeRef.current;
        if (!api || !node || windowRef.current) return;
        try {
            const pipWindow = await api.requestWindow({width: PIP_WIDTH, height: PIP_HEIGHT});
            windowRef.current = pipWindow;
            homeRef.current = node.parentElement;
            cssRef.current = node.style.cssText;

            pipWindow.document.body.style.margin = '0';
            pipWindow.document.body.style.background = '#000000';
            pipWindow.document.body.style.overflow = 'hidden';

            node.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;transform:none;';
            pipWindow.document.body.appendChild(node);
            pipWindow.addEventListener('pagehide', restore, {once: true});
            setActive(true);
        } catch {
            windowRef.current = null;
        }
    }, [restore]);

    const toggle = useCallback(() => {
        if (windowRef.current) exit();
        else void enter();
    }, [enter, exit]);

    const hostRef = useCallback((node: unknown) => {
        nodeRef.current = (node as HTMLElement | null) ?? null;
    }, []);

    useEffect(() => () => {
        const pipWindow = windowRef.current;
        if (pipWindow && !pipWindow.closed) pipWindow.close();
    }, []);

    return {supported, active, toggle, hostRef};
}
