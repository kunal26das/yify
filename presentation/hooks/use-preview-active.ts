import {useSyncExternalStore} from 'react';
import {AppState} from 'react-native';
import {useIsFocused} from 'expo-router';

function subscribe(listener: () => void) {
    const subscription = AppState.addEventListener('change', listener);
    return () => subscription.remove();
}

function getSnapshot() {
    return AppState.currentState == null || AppState.currentState === 'active';
}

const getServerSnapshot = () => true;

export function usePreviewActive(visible: boolean): boolean {
    const focused = useIsFocused();
    const foreground = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
    return visible && focused && foreground;
}
