import {AppState} from 'react-native';

export function watchForeground(onForeground: () => void): () => void {
    const subscription = AppState.addEventListener('change', (next) => {
        if (next === 'active') onForeground();
    });
    return () => subscription.remove();
}

export function isForeground(): boolean {
    return AppState.currentState === 'active';
}
