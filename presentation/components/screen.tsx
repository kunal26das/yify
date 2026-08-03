import type {ReactNode} from 'react';
import {StyleSheet, type StyleProp, type ViewStyle} from 'react-native';
import {BlurTargetProvider, BlurTargetSurface} from './blur-target';
import {ThemedView} from './themed-view';

interface ScreenProps {
    children: ReactNode;
    overlays?: ReactNode;
    style?: StyleProp<ViewStyle>;
}

export function Screen({children, overlays, style}: ScreenProps) {
    return (
        <BlurTargetProvider>
            <ThemedView style={[styles.container, style]}>
                <BlurTargetSurface>{children}</BlurTargetSurface>
                {overlays}
            </ThemedView>
        </BlurTargetProvider>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
});
