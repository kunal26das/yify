import {useEffect, useRef, useState} from 'react';
import {Animated, Modal, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {ThemedText} from '../../components/themed-text';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {Radius, Spacing} from '../../constants/theme';
import type {Torrent} from '@/domain';

interface TorrentNoticeSheetProps {
    torrent: Torrent | null;
    onClose: () => void;
    bottomInset: number;
}

export function TorrentNoticeSheet({torrent, onClose, bottomInset}: TorrentNoticeSheetProps) {
    const {height: windowHeight} = useWindowDimensions();
    const {isLarge} = useResponsive();
    const {colors} = usePalette();

    const visible = torrent !== null;
    const [mounted, setMounted] = useState(visible);
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setMounted(true);
            Animated.timing(progress, {toValue: 1, duration: 260, useNativeDriver: true}).start();
        } else {
            Animated.timing(progress, {toValue: 0, duration: 200, useNativeDriver: true}).start(({finished}) => {
                if (finished) setMounted(false);
            });
        }
    }, [visible, progress]);

    if (!mounted) return null;

    const translateY = progress.interpolate({inputRange: [0, 1], outputRange: [windowHeight * 0.5, 0]});
    const sheetScale = progress.interpolate({inputRange: [0, 1], outputRange: [0.96, 1]});
    const sheetTransform = isLarge ? [{scale: sheetScale}] : [{translateY}];

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose} statusBarTranslucent>
            <View style={[styles.root, isLarge && styles.rootCentered]}>
                <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, {opacity: progress}]}
                               pointerEvents="none"/>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close"/>
                <Animated.View
                    style={[
                        styles.sheet,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            opacity: isLarge ? progress : 1,
                            transform: sheetTransform,
                        },
                        isLarge ? styles.sheetCentered : styles.sheetBottom,
                    ]}
                >
                    {!isLarge ?
                        <View style={[styles.dragIndicator, {backgroundColor: colors.textMuted + '55'}]}/> : null}
                    <View style={styles.content}>
                        <View style={[styles.iconBadge, {backgroundColor: colors.surfaceSunken}]}>
                            <Ionicons name="information-circle-outline" size={30} color={colors.accent}/>
                        </View>
                        <ThemedText type="heading" style={styles.title}>Downloads aren&apos;t available</ThemedText>
                        <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                            This app is a browsing companion for discovering movies — ratings, trailers, cast, and
                            release details. The file listings you see here are shown for information only, and
                            downloading them isn&apos;t supported in this app.
                        </ThemedText>
                        <ThemedText style={[styles.body, {color: colors.textMuted}]}>
                            Many titles are protected by copyright, and we want to keep things safe and legal for
                            everyone. To watch this movie, please check your favorite streaming service, digital
                            store, or local cinema.
                        </ThemedText>
                    </View>
                    <View style={[styles.footer, {paddingBottom: isLarge ? 16 : bottomInset + 16}]}>
                        <Pressable onPress={onClose} accessibilityRole="button"
                                   style={({pressed}) => ({opacity: pressed ? 0.9 : 1})}>
                            <View style={[styles.dismissButton, {backgroundColor: colors.accent}]}>
                                <ThemedText style={[styles.dismissLabel, {color: colors.onAccent}]}>Got
                                    it</ThemedText>
                            </View>
                        </Pressable>
                    </View>
                </Animated.View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    root: {flex: 1, justifyContent: 'flex-end'},
    rootCentered: {justifyContent: 'center', alignItems: 'center', padding: 24},
    scrim: {backgroundColor: 'rgba(0, 0, 0, 0.55)'},
    sheet: {overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth},
    sheetBottom: {borderTopLeftRadius: Radius.xl, borderTopRightRadius: Radius.xl},
    sheetCentered: {borderRadius: Radius.xl, width: '100%', maxWidth: 440},
    dragIndicator: {alignSelf: 'center', width: 38, height: 5, borderRadius: 3, marginTop: 10, marginBottom: 2},
    content: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.lg, alignItems: 'center'},
    iconBadge: {
        width: 56,
        height: 56,
        borderRadius: 28,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: Spacing.md,
    },
    title: {textAlign: 'center', marginBottom: Spacing.sm},
    body: {fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: Spacing.md},
    footer: {paddingHorizontal: Spacing.xl, paddingTop: Spacing.sm},
    dismissButton: {borderRadius: Radius.pill, paddingVertical: 15, alignItems: 'center', justifyContent: 'center'},
    dismissLabel: {fontSize: 16, fontWeight: '700'},
});
