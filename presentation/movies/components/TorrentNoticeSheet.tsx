import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Platform, StyleSheet, View, type LayoutChangeEvent} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import Reanimated from 'react-native-reanimated';
import {
    BottomSheetBackdrop,
    BottomSheetModal,
    BottomSheetView,
    type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import {PressableScale, enterPop, enterRise} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {Radius, Spacing} from '../../constants/theme';
import type {Torrent} from '@/domain';

const IS_WEB = Platform.OS === 'web';
const HANDLE_HEIGHT = 25;
const WEB_INITIAL_HEIGHT = 560;

interface TorrentNoticeSheetProps {
    torrent: Torrent | null;
    onClose: () => void;
    bottomInset: number;
}

function torrentLabel(torrent: Torrent): string {
    return [torrent.type, torrent.videoCodec].filter(Boolean).join(' · ') || 'Torrent';
}

export function TorrentNoticeSheet({torrent, onClose, bottomInset}: TorrentNoticeSheetProps) {
    const {colors} = usePalette();

    const sheetRef = useRef<BottomSheetModal>(null);
    const openRef = useRef(false);
    const [shown, setShown] = useState<Torrent | null>(torrent);
    const [webHeight, setWebHeight] = useState(WEB_INITIAL_HEIGHT);

    useEffect(() => {
        if (torrent) {
            setShown(torrent);
            openRef.current = true;
            sheetRef.current?.present();
            return;
        }
        if (openRef.current) {
            openRef.current = false;
            sheetRef.current?.dismiss();
        }
    }, [torrent]);

    const handleDismiss = useCallback(() => {
        if (!openRef.current) return;
        openRef.current = false;
        onClose();
    }, [onClose]);

    const handleGotIt = useCallback(() => {
        sheetRef.current?.dismiss();
    }, []);

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
                accessibilityLabel="Close"
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

    return (
        <BottomSheetModal
            ref={sheetRef}
            snapPoints={snapPoints}
            containerStyle={styles.sheetContainer}
            enableDynamicSizing={!IS_WEB}
            enablePanDownToClose
            onDismiss={handleDismiss}
            backdropComponent={renderBackdrop}
            backgroundStyle={backgroundStyle}
            handleIndicatorStyle={handleIndicatorStyle}
        >
            <BottomSheetView style={styles.sheetView}>
                <View
                    style={[styles.inner, {paddingBottom: bottomInset + Spacing.lg}]}
                    onLayout={IS_WEB ? handleContentLayout : undefined}
                >
                    <View style={styles.content}>
                        <Reanimated.View
                            entering={enterPop()}
                            style={[
                                styles.iconBadge,
                                {
                                    backgroundColor: colors.surfaceSunken,
                                },
                            ]}
                        >
                            <Ionicons name="information-circle-outline" size={30} color={colors.accent}/>
                        </Reanimated.View>
                        <Reanimated.View entering={enterRise(1)}>
                            <ThemedText type="heading" style={styles.title}>Downloads aren&apos;t available</ThemedText>
                        </Reanimated.View>
                        {shown ? (
                            <Reanimated.View
                                entering={enterRise(2)}
                                style={[
                                    styles.metaRow,
                                    {backgroundColor: colors.surfaceSunken, borderColor: colors.border},
                                ]}
                            >
                                <View style={[styles.qualityPill, {backgroundColor: colors.accentSoft}]}>
                                    <ThemedText style={[styles.qualityLabel, {color: colors.accent}]}>
                                        {shown.quality}
                                    </ThemedText>
                                </View>
                                <ThemedText numberOfLines={1} style={[styles.metaType, {color: colors.text}]}>
                                    {torrentLabel(shown)}
                                </ThemedText>
                                <ThemedText style={[styles.metaValue, {color: colors.textMuted}]}>
                                    {shown.size}
                                </ThemedText>
                                <View style={styles.seedPeer}>
                                    <Ionicons name="arrow-up" size={11} color={colors.seed}/>
                                    <ThemedText style={[styles.metaValue, {color: colors.seed}]}>
                                        {shown.seeds}
                                    </ThemedText>
                                </View>
                                <View style={styles.seedPeer}>
                                    <Ionicons name="arrow-down" size={11} color={colors.peer}/>
                                    <ThemedText style={[styles.metaValue, {color: colors.peer}]}>
                                        {shown.peers}
                                    </ThemedText>
                                </View>
                            </Reanimated.View>
                        ) : null}
                        <Reanimated.View entering={enterRise(3)}>
                            <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                                This app is a browsing companion for discovering movies — ratings, trailers, cast, and
                                release details. The file listings you see here are shown for information only, and
                                downloading them isn&apos;t supported in this app.
                            </ThemedText>
                        </Reanimated.View>
                        <Reanimated.View entering={enterRise(4)}>
                            <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                                Many titles are protected by copyright, and we want to keep things safe and legal for
                                everyone. To watch this movie, please check your favorite streaming service, digital
                                store, or local cinema.
                            </ThemedText>
                        </Reanimated.View>
                    </View>
                    <View style={styles.footer}>
                        <PressableScale onPress={handleGotIt} accessibilityRole="button"
                                        pressedScale={0.97} pressedOpacity={0.9} hoveredScale={1.01}>
                            <View style={[styles.dismissButton, {backgroundColor: colors.accent}]}>
                                <ThemedText style={[styles.dismissLabel, {color: colors.onAccent}]}>Got
                                    it</ThemedText>
                            </View>
                        </PressableScale>
                    </View>
                </View>
            </BottomSheetView>
        </BottomSheetModal>
    );
}

const SHEET_Z_INDEX = 200;

const styles = StyleSheet.create({
    sheetContainer: {zIndex: SHEET_Z_INDEX, elevation: SHEET_Z_INDEX},
    sheetBackground: {borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl},
    handleIndicator: {width: 38, height: 5, borderRadius: 3},
    sheetView: {width: '100%'},
    inner: {alignSelf: 'center', width: '100%', maxWidth: 480},
    content: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm, alignItems: 'center'},
    iconBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    title: {textAlign: 'center', marginBottom: Spacing.sm},
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        borderRadius: Radius.card,
        borderWidth: StyleSheet.hairlineWidth,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm,
        marginBottom: Spacing.md,
    },
    qualityPill: {
        borderRadius: Radius.pill,
        paddingHorizontal: 10,
        paddingVertical: 3,
        minWidth: 56,
        alignItems: 'center',
    },
    qualityLabel: {fontSize: 12.5, lineHeight: 17, fontWeight: '700'},
    metaType: {fontSize: 13, lineHeight: 18, textTransform: 'capitalize'},
    metaValue: {fontSize: 13, lineHeight: 18},
    seedPeer: {flexDirection: 'row', alignItems: 'center', gap: 2},
    body: {fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: Spacing.md},
    footer: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm},
    dismissButton: {borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center'},
    dismissLabel: {fontSize: 16, fontWeight: '700'},
});
