import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import {
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    View,
    type GestureResponderEvent,
    type LayoutChangeEvent,
} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Reanimated from 'react-native-reanimated';
import {usePathname} from 'expo-router';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
    type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {PressableScale, enterPop, enterRise} from './motion';
import {ThemedText} from './themed-text';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {useAndroidBackHandler} from '../hooks/use-android-back';
import {Radius, Spacing} from '../constants/theme';

const IS_WEB = Platform.OS === 'web';
const HANDLE_HEIGHT = 25;
const WEB_INITIAL_HEIGHT = 340;
const DIALOG_Z_INDEX = 300;

export interface ConfirmRequest {
    title: string;
    message: string;
    confirmLabel: string;
    cancelLabel?: string;
    icon?: keyof typeof Ionicons.glyphMap;
    destructive?: boolean;
    onConfirm: () => void;
    onCancel?: () => void;
}

type ConfirmFn = (request: ConfirmRequest) => void;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
    const confirm = useContext(ConfirmContext);
    if (!confirm) throw new Error('useConfirm must be used inside ConfirmProvider');
    return confirm;
}

export function ConfirmProvider({children}: {children: ReactNode}) {
    const [request, setRequest] = useState<ConfirmRequest | null>(null);
    const confirm = useCallback<ConfirmFn>((next) => setRequest(next), []);
    const close = useCallback(() => setRequest(null), []);
    const pathname = usePathname();

    useEffect(() => {
        setRequest(null);
    }, [pathname]);

    return (
        <ConfirmContext.Provider value={confirm}>
            {children}
            <ConfirmDialog request={request} onClose={close}/>
        </ConfirmContext.Provider>
    );
}

function ConfirmDialog({request, onClose}: {request: ConfirmRequest | null; onClose: () => void}) {
    const {colors} = usePalette();
    const {isLarge} = useResponsive();
    const insets = useSafeAreaInsets();

    const sheetRef = useRef<BottomSheetModal>(null);
    const openRef = useRef(false);
    const decidedRef = useRef(false);
    const isLargeRef = useRef(isLarge);
    isLargeRef.current = isLarge;
    const [shown, setShown] = useState<ConfirmRequest | null>(request);
    const [webHeight, setWebHeight] = useState(WEB_INITIAL_HEIGHT);

    useEffect(() => {
        decidedRef.current = false;
    }, [request]);

    useEffect(() => {
        if (request) {
            setShown(request);
            openRef.current = true;
            sheetRef.current?.present();
            return;
        }
        if (openRef.current) {
            openRef.current = false;
            sheetRef.current?.dismiss();
        }
    }, [request, isLarge]);

    const handleDismiss = useCallback(() => {
        if (isLargeRef.current) return;
        if (!openRef.current) return;
        openRef.current = false;
        if (!decidedRef.current) {
            decidedRef.current = true;
            shown?.onCancel?.();
        }
        onClose();
    }, [onClose, shown]);

    const close = useCallback(() => {
        if (isLarge) {
            openRef.current = false;
            onClose();
            return;
        }
        sheetRef.current?.dismiss();
    }, [isLarge, onClose]);

    const handleCancel = useCallback(() => {
        if (decidedRef.current) return;
        const action = request?.onCancel;
        decidedRef.current = true;
        close();
        action?.();
    }, [close, request]);

    const handleConfirm = useCallback(() => {
        if (decidedRef.current) return;
        const action = request?.onConfirm;
        if (!action) return;
        decidedRef.current = true;
        close();
        action();
    }, [close, request]);

    useAndroidBackHandler(request != null && !isLarge, handleCancel);

    useEffect(() => {
        if (!IS_WEB || request == null) return;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') handleCancel();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, [handleCancel, request]);

    const handleContentLayout = useCallback((event: LayoutChangeEvent) => {
        setWebHeight(Math.ceil(event.nativeEvent.layout.height) + HANDLE_HEIGHT);
    }, []);

    const snapPoints = useMemo(() => (IS_WEB ? [webHeight] : undefined), [webHeight]);

    const renderBackdrop = useCallback(
        (props: BottomSheetBackdropProps) => (
            <BottomSheetBackdrop
                {...props}
                appearsOnIndex={0}
                disappearsOnIndex={-1}
                opacity={1}
                accessibilityLabel="Cancel"
                style={[props.style, {backgroundColor: colors.scrim}]}
            />
        ),
        [colors.scrim]
    );

    const backgroundStyle = useMemo(
        () => [styles.sheetBackground, {backgroundColor: colors.surfaceElevated}],
        [colors.surfaceElevated]
    );

    const handleIndicatorStyle = useMemo(
        () => [styles.handleIndicator, {backgroundColor: colors.borderStrong}],
        [colors.borderStrong]
    );

    const destructive = shown?.destructive !== false;
    const accentColor = destructive ? colors.danger : colors.accent;
    const accentSoftColor = destructive ? colors.dangerSoft : colors.accentSoft;
    const onAccentColor = destructive ? colors.onDanger : colors.onAccent;

    const body = (
        <View
            style={[styles.inner, {paddingBottom: isLarge ? Spacing.lg : insets.bottom + Spacing.lg}]}
            onLayout={IS_WEB && !isLarge ? handleContentLayout : undefined}
            accessibilityViewIsModal
            accessibilityRole="alert"
            accessibilityLiveRegion="assertive"
        >
            <View style={styles.content}>
                <Reanimated.View
                    entering={enterPop()}
                    style={[styles.iconBadge, {backgroundColor: accentSoftColor}]}
                >
                    <Ionicons
                        name={shown?.icon ?? (destructive ? 'trash-outline' : 'help-circle-outline')}
                        size={28}
                        color={accentColor}
                    />
                </Reanimated.View>
                <Reanimated.View entering={enterRise(1)}>
                    <ThemedText type="heading" style={styles.title}>
                        {shown?.title}
                    </ThemedText>
                </Reanimated.View>
                <Reanimated.View entering={enterRise(2)}>
                    <ThemedText style={[styles.message, {color: colors.textMuted}]}>
                        {shown?.message}
                    </ThemedText>
                </Reanimated.View>
            </View>
            <View style={styles.footer}>
                <PressableScale
                    onPress={handleCancel}
                    accessibilityRole="button"
                    accessibilityLabel={shown?.cancelLabel ?? 'Cancel'}
                    pressedScale={0.97}
                    pressedOpacity={0.9}
                    hoveredScale={1.01}
                    style={styles.buttonSlot}
                    contentStyle={[
                        styles.button,
                        {backgroundColor: colors.surfaceSunken, borderColor: colors.border},
                    ]}
                >
                    <ThemedText style={[styles.buttonLabel, {color: colors.text}]}>
                        {shown?.cancelLabel ?? 'Cancel'}
                    </ThemedText>
                </PressableScale>
                <PressableScale
                    onPress={handleConfirm}
                    accessibilityRole="button"
                    accessibilityLabel={shown?.confirmLabel}
                    pressedScale={0.97}
                    pressedOpacity={0.9}
                    hoveredScale={1.01}
                    style={styles.buttonSlot}
                    contentStyle={[
                        styles.button,
                        {backgroundColor: accentColor, borderColor: accentColor},
                    ]}
                >
                    <ThemedText style={[styles.buttonLabel, {color: onAccentColor}]}>
                        {shown?.confirmLabel}
                    </ThemedText>
                </PressableScale>
            </View>
        </View>
    );

    if (isLarge) {
        if (!request) return null;
        return (
            <Modal
                visible
                transparent
                animationType="fade"
                onRequestClose={handleCancel}
            >
                <Pressable
                    style={[styles.dialogRoot, {backgroundColor: colors.scrim}]}
                    accessibilityLabel="Cancel"
                    onPress={handleCancel}
                >
                    <Pressable
                        style={[styles.dialog, {backgroundColor: colors.surfaceElevated}]}
                        onPress={(event: GestureResponderEvent) => event.stopPropagation()}
                    >
                        {body}
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    return (
        <BottomSheetModal
            ref={sheetRef}
            accessible={false}
            accessibilityRole={null}
            accessibilityLabel={shown?.title}
            snapPoints={snapPoints}
            containerStyle={styles.sheetContainer}
            enableDynamicSizing={!IS_WEB}
            enablePanDownToClose
            onDismiss={handleDismiss}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleIndicatorStyle}
        >
            <BottomSheetView style={styles.sheetView}>{body}</BottomSheetView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetContainer: {zIndex: DIALOG_Z_INDEX, elevation: DIALOG_Z_INDEX},
    dialogRoot: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl},
    dialog: {width: '100%', maxWidth: 420, borderRadius: Radius.xl, overflow: 'hidden'},
    sheetBackground: {borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl},
    handleIndicator: {width: 38, height: 5, borderRadius: 3},
    sheetView: {width: '100%'},
    inner: {alignSelf: 'center', width: '100%', maxWidth: 420},
    content: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, alignItems: 'center'},
    iconBadge: {
        width: 52,
        height: 52,
        borderRadius: 26,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    title: {textAlign: 'center', marginBottom: Spacing.sm},
    message: {fontSize: 15, lineHeight: 22, textAlign: 'center'},
    footer: {
        flexDirection: 'row',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.xl,
        paddingTop: Spacing.xl,
    },
    buttonSlot: {flex: 1},
    button: {
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
        paddingVertical: 15,
        alignItems: 'center',
        justifyContent: 'center',
    },
    buttonLabel: {fontSize: 16, fontWeight: '700'},
});
