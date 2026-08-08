import {Alert, Platform} from 'react-native';

interface ConfirmOptions {
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
}

export function confirmDestructive({title, message, confirmLabel, onConfirm}: ConfirmOptions): void {
    if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || window.confirm(message)) onConfirm();
        return;
    }
    Alert.alert(title, message, [
        {text: 'Cancel', style: 'cancel'},
        {text: confirmLabel, style: 'destructive', onPress: onConfirm},
    ]);
}
