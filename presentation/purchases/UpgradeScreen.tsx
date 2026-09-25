import {useEffect} from 'react';
import {Pressable, ScrollView, StyleSheet} from 'react-native';
import {router, useIsFocused} from 'expo-router';
import {ThemedText} from '../components/themed-text';
import {Screen} from '../components/screen';
import {usePalette} from '../hooks/use-palette';
import {useTopBarHeight} from '../movies/components/TopBar';
import {Spacing} from '../constants/theme';
import {useSupporterPaywall} from './supporter-paywall';

export function UpgradeScreen() {
    const showPaywall = useSupporterPaywall();
    const {colors} = usePalette();
    const top = useTopBarHeight();
    const focused = useIsFocused();

    useEffect(() => {
        if (!focused) return;
        let active = true;
        let cancel: (() => void) | undefined;
        void Promise.resolve().then(() => {
            if (!active) return;
            cancel = showPaywall('supporter_page', () => {
                if (active) router.replace('/watchlist');
            });
        });
        return () => {
            active = false;
            cancel?.();
        };
    }, [focused, showPaywall]);

    return <Screen><ScrollView contentContainerStyle={[styles.content, {paddingTop: top + Spacing.xl}]}>
        <ThemedText type="heading">Yify Supporter</ThemedText>
        <ThemedText style={{color: colors.textMuted}}>Personal viewing insights and no Yify ads. Choose a plan to see its price and billing terms.</ThemedText>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/watchlist')} style={styles.button}>
            <ThemedText type="link">Keep browsing</ThemedText>
        </Pressable>
    </ScrollView></Screen>;
}

const styles = StyleSheet.create({
    content: {padding: Spacing.xl, gap: Spacing.md},
    button: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center'},
});
