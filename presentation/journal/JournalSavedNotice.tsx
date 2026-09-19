import {StyleSheet, View} from 'react-native';
import {PressableScale} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {Radius, Spacing} from '../constants/theme';
import {usePalette} from '../hooks/use-palette';

export function JournalSavedNotice({updated = false, actionLabel, onPress}: {
    updated?: boolean; actionLabel: string; onPress: () => void;
}) {
    const {colors} = usePalette();
    return <View style={[styles.notice, {backgroundColor: colors.accentSoft, borderColor: colors.border}]}>
        <ThemedText accessibilityLiveRegion="polite" style={styles.message}>{updated ? 'Changes saved.' : 'Saved to your journal.'}</ThemedText>
        <PressableScale accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onPress} contentStyle={styles.action}>
            <ThemedText type="defaultSemiBold" style={{color: colors.accent}}>{actionLabel}</ThemedText>
        </PressableScale>
    </View>;
}

const styles = StyleSheet.create({
    notice: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.sm, borderRadius: Radius.md, borderWidth: 1},
    message: {flex: 1, minWidth: 144},
    action: {minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.sm},
});
