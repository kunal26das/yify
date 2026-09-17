import Ionicons from '@expo/vector-icons/Ionicons';
import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import {FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View, type FlatListProps, type TextInputProps} from 'react-native';
import {BottomSheetBackdrop, BottomSheetFlatList, BottomSheetModal, BottomSheetTextInput, type BottomSheetBackdropProps} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {useAndroidBackHandler} from '../../hooks/use-android-back';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';

const SNAP_POINTS = ['80%'];

export function PickerSheetInput(props: TextInputProps) {
    const {isLarge} = useResponsive();
    return isLarge || Platform.OS === 'web' ? <TextInput {...props}/> : <BottomSheetTextInput {...props}/>;
}

export function PickerSheet<T>({title, onClose, backdropLabel, maxWidth = 480, listProps, footer}: {
    title: string;
    onClose: () => void;
    backdropLabel: string;
    maxWidth?: number;
    listProps: FlatListProps<T>;
    footer?: ReactNode;
}) {
    const {colors} = usePalette();
    const {isLarge, height} = useResponsive();
    const insets = useSafeAreaInsets();
    const closed = useRef(false);
    const close = useCallback(() => {
        if (closed.current) return;
        closed.current = true;
        onClose();
    }, [onClose]);

    const heading = (
        <View style={styles.heading}>
            <ThemedText type="heading" style={styles.title}>{title}</ThemedText>
            <PressableScale onPress={close} accessibilityRole="button" accessibilityLabel="Close" contentStyle={styles.close}>
                <Ionicons name="close" size={24} color={colors.text}/>
            </PressableScale>
        </View>
    );

    if (isLarge) {
        return (
            <Modal visible transparent animationType="fade" onRequestClose={close}>
                <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={[styles.overlay, {paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg}]}>
                    <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityRole="button" accessibilityLabel={backdropLabel}/>
                    <View accessibilityViewIsModal style={[styles.dialog, {maxWidth, backgroundColor: colors.surface, borderColor: colors.border,
                        maxHeight: Math.min(640, Math.max(0, height - insets.top - insets.bottom - Spacing.lg * 2))}]}>
                        {heading}
                        <FlatList {...listProps} keyboardShouldPersistTaps="handled" style={[styles.dialogList, listProps.style]}/>
                        {footer}
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        );
    }

    return <CompactPickerSheet heading={heading} listProps={listProps} footer={footer} backdropLabel={backdropLabel} onClose={close}/>;
}

function CompactPickerSheet<T>({heading, listProps, footer, backdropLabel, onClose}: {
    heading: ReactNode;
    listProps: FlatListProps<T>;
    footer?: ReactNode;
    backdropLabel: string;
    onClose: () => void;
}) {
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const sheet = useRef<BottomSheetModal>(null);
    const mounted = useRef(false);

    useEffect(() => {
        mounted.current = true;
        sheet.current?.present();
        return () => {
            mounted.current = false;
            sheet.current?.dismiss();
        };
    }, []);

    const onDismiss = useCallback(() => {
        if (mounted.current) onClose();
    }, [onClose]);

    useAndroidBackHandler(true, onClose);

    const backdrop = useCallback((props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1}
            opacity={0.6} accessibilityLabel={backdropLabel}/>
    ), [backdropLabel]);

    return (
        <BottomSheetModal ref={sheet} snapPoints={SNAP_POINTS} enableDynamicSizing={false}
            accessible={false} accessibilityRole="none"
            enablePanDownToClose onDismiss={onDismiss} backdropComponent={backdrop}
            topInset={insets.top + Spacing.lg} keyboardBehavior="interactive" keyboardBlurBehavior="restore"
            android_keyboardInputMode="adjustResize" containerStyle={styles.sheetContainer}
            backgroundStyle={{backgroundColor: colors.surface, borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl}}
            handleIndicatorStyle={{backgroundColor: colors.borderStrong}}>
            <View style={styles.sheetHeading}>{heading}</View>
            <BottomSheetFlatList {...listProps} keyboardShouldPersistTaps="handled" style={styles.sheetList}
                contentContainerStyle={[styles.sheetContent, listProps.contentContainerStyle,
                    {paddingBottom: footer ? Spacing.md : insets.bottom + Spacing.lg}]}/>
            {footer ? <View style={[styles.sheetFooter, {paddingBottom: insets.bottom + Spacing.lg}]}>{footer}</View> : null}
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg},
    dialog: {width: '100%', flexShrink: 1, overflow: 'hidden', borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md},
    heading: {flexShrink: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    title: {flex: 1, minWidth: 0},
    close: {minHeight: 44, minWidth: 44, alignItems: 'center', justifyContent: 'center'},
    dialogList: {flexGrow: 0, flexShrink: 1, minHeight: 0},
    sheetContainer: {zIndex: 200, elevation: 200},
    sheetHeading: {flexShrink: 0, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md},
    sheetList: {flex: 1, minHeight: 0},
    sheetContent: {paddingHorizontal: Spacing.lg},
    sheetFooter: {flexShrink: 0, paddingHorizontal: Spacing.lg},
});
