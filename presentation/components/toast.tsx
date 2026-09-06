import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactElement,
    type ReactNode,
} from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import {AccessibilityInfo, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {enterRise} from './motion';
import {ThemedText} from './themed-text';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';

type Glyph = keyof typeof Ionicons.glyphMap;

interface Toast {
    id: number;
    message: string;
    icon: Glyph;
}

const DURATION_MS = 2600;

const ToastContext = createContext<((message: string, icon?: Glyph) => void) | null>(null);

export function useToast(): (message: string, icon?: Glyph) => void {
    const show = useContext(ToastContext);
    if (!show) throw new Error('useToast must be used inside ToastProvider');
    return show;
}

export function ToastProvider({children}: { children: ReactNode }): ReactElement {
    const [toast, setToast] = useState<Toast | null>(null);
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const nextId = useRef(0);

    const show = useCallback((message: string, icon: Glyph = 'checkmark-circle-outline') => {
        if (timer.current) clearTimeout(timer.current);
        nextId.current += 1;
        const id = nextId.current;
        setToast({id, message, icon});
        AccessibilityInfo.announceForAccessibility(message);
        timer.current = setTimeout(() => {
            setToast((current) => (current?.id === id ? null : current));
        }, DURATION_MS);
    }, []);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const value = useMemo(() => show, [show]);

    return (
        <ToastContext.Provider value={value}>
            {children}
            <ToastHost toast={toast}/>
        </ToastContext.Provider>
    );
}

function ToastHost({toast}: { toast: Toast | null }): ReactElement | null {
    const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    if (!toast) return null;
    return (
        <View style={[styles.wrap, {bottom: insets.bottom + Spacing.lg}]} pointerEvents="none">
            <Animated.View
                key={toast.id}
                entering={enterRise()}
                accessibilityRole="alert"
                accessibilityLiveRegion="polite"
                style={[
                    styles.bar,
                    {
                        backgroundColor: scheme === 'dark' ? '#3A3A37' : '#1F1D1A',
                        borderColor: colors.borderStrong,
                    },
                ]}
            >
                <Ionicons name={toast.icon} size={19} color="#fff"/>
                <ThemedText style={styles.message} numberOfLines={2}>
                    {toast.message}
                </ThemedText>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        zIndex: 100,
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        maxWidth: 520,
        paddingHorizontal: Spacing.lg,
        paddingVertical: 12,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    message: {color: '#fff', fontSize: 14, fontFamily: FontFamily.semibold, flexShrink: 1},
});
