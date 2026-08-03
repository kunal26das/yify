import {BlurTargetView} from 'expo-blur';
import {createContext, useContext, useRef, type ReactNode, type RefObject} from 'react';
import {Platform, StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';

type BlurTargetRef = RefObject<View | null> | null;

const BlurTargetContext = createContext<BlurTargetRef>(null);

const supported = Platform.OS === 'android';

export function useBlurTarget(): BlurTargetRef {
    return useContext(BlurTargetContext);
}

export function BlurTargetProvider({children}: {children: ReactNode}) {
    const ref = useRef<View | null>(null);
    if (!supported) return <>{children}</>;
    return <BlurTargetContext.Provider value={ref}>{children}</BlurTargetContext.Provider>;
}

export function BlurTargetSurface({
    children,
    style,
}: {
    children: ReactNode;
    style?: StyleProp<ViewStyle>;
}) {
    const ref = useBlurTarget();
    if (!supported || ref == null) return <View style={[styles.fill, style]}>{children}</View>;
    return (
        <BlurTargetView ref={ref} style={[styles.fill, style]}>
            {children}
        </BlurTargetView>
    );
}

const styles = StyleSheet.create({
    fill: {flex: 1},
});
