import {useEffect, useRef} from 'react';
import {BackHandler, Platform} from 'react-native';

export function useAndroidBackHandler(active: boolean, onBack: () => void): void {
    const handlerRef = useRef(onBack);
    handlerRef.current = onBack;

    useEffect(() => {
        if (Platform.OS !== 'android' || !active) return;
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            handlerRef.current();
            return true;
        });
        return () => subscription.remove();
    }, [active]);
}
