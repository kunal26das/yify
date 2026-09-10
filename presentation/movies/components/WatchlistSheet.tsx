import Ionicons from '@expo/vector-icons/Ionicons';
import {useCallback, useEffect, useRef, type ReactNode} from 'react';
import {Modal, Pressable, ScrollView, StyleSheet, TextInput, View, type GestureResponderEvent, type TextInputProps} from 'react-native';
import {BottomSheetBackdrop, BottomSheetModal, BottomSheetScrollView, BottomSheetTextInput, type BottomSheetBackdropProps} from '@gorhom/bottom-sheet';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {useAndroidBackHandler} from '../../hooks/use-android-back';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';

const SNAP_POINTS = ['72%'];

export function WatchlistSheetInput(props: TextInputProps) {
    const {isLarge} = useResponsive();
    return isLarge ? <TextInput {...props}/> : <BottomSheetTextInput {...props}/>;
}

export function WatchlistSheet({visible, title, onClose, children}: {
    visible: boolean;
    title: string;
    onClose: () => void;
    children: ReactNode;
}) {
    const {colors} = usePalette();
    const {isLarge} = useResponsive();
    const insets = useSafeAreaInsets();
    const sheet = useRef<BottomSheetModal>(null);
    const presented = useRef(false);

    useEffect(() => {
        if (isLarge) return;
        if (visible) {
            presented.current = true;
            sheet.current?.present();
        } else if (presented.current) {
            presented.current = false;
            sheet.current?.dismiss();
        }
    }, [visible, isLarge]);

    const onDismiss = useCallback(() => {
        if (!presented.current) return;
        presented.current = false;
        onClose();
    }, [onClose]);

    useAndroidBackHandler(visible && !isLarge, onClose);

    const backdrop = useCallback((props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1}
                             opacity={1} accessibilityLabel="Close"
                             style={[props.style, {backgroundColor: colors.scrim}]}/>
    ), [colors.scrim]);

    const header = (
        <View style={styles.heading}>
            <ThemedText type="heading" numberOfLines={2} style={styles.title}>{title}</ThemedText>
            <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close watchlist controls"
                            contentStyle={styles.close}>
                <Ionicons name="close" size={22} color={colors.text}/>
            </PressableScale>
        </View>
    );

    if (isLarge) {
        return (
            <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
                <Pressable style={[styles.backdrop, {backgroundColor: colors.scrim}]} onPress={onClose}>
                    <Pressable style={[styles.dialog, {backgroundColor: colors.surfaceElevated}]}
                               onPress={(event: GestureResponderEvent) => event.stopPropagation()}>
                        {header}
                        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.body}>
                            {children}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>
        );
    }

    return (
        <BottomSheetModal ref={sheet} snapPoints={SNAP_POINTS} enableDynamicSizing={false}
                          enablePanDownToClose onDismiss={onDismiss} backdropComponent={backdrop}
                          keyboardBehavior="interactive" keyboardBlurBehavior="restore"
                          android_keyboardInputMode="adjustResize"
                          containerStyle={styles.sheetContainer}
                          backgroundStyle={{backgroundColor: colors.surfaceElevated}}
                          handleIndicatorStyle={{backgroundColor: colors.borderStrong}}>
            {header}
            <BottomSheetScrollView keyboardShouldPersistTaps="handled"
                                   contentContainerStyle={[styles.body, {paddingBottom: insets.bottom + Spacing.xl}]}>
                {children}
            </BottomSheetScrollView>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetContainer: {zIndex: 200, elevation: 200},
    backdrop: {flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl},
    dialog: {width: '100%', maxWidth: 520, maxHeight: '86%', borderRadius: Radius.xl, overflow: 'hidden'},
    heading: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.md},
    title: {flex: 1},
    close: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
    body: {paddingHorizontal: Spacing.xl, paddingBottom: Spacing.xl, gap: Spacing.lg},
});
