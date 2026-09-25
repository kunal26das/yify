import {StyleSheet, View} from 'react-native';
import {ThemedText} from '../components/themed-text';
import {usePalette} from '../hooks/use-palette';

export function SupporterInsightsPreview() {
    const {colors} = usePalette();
    return <View style={[styles.preview, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
        <ThemedText type="defaultSemiBold">Example insights</ThemedText>
        <ThemedText type="caption" style={{color: colors.textMuted}}>Fictional journal · one month</ThemedText>
        <View style={styles.metrics}>
            {[
                {label: 'Watches logged', value: '8'},
                {label: 'Top genre', value: 'Drama'},
                {label: 'Average rating', value: '4.2 / 5'},
            ].map(metric => <View key={metric.label} style={styles.metric} accessible
                accessibilityLabel={`${metric.label}: ${metric.value}`}>
                <ThemedText type="defaultSemiBold" style={styles.value}>{metric.value}</ThemedText>
                <ThemedText type="caption" style={{color: colors.textMuted}}>{metric.label}</ThemedText>
            </View>)}
        </View>
        <ThemedText type="caption" style={{color: colors.textMuted}}>Your insights use the movies and ratings you add to your journal.</ThemedText>
    </View>;
}

const styles = StyleSheet.create({
    preview: {padding: 14, borderWidth: 1, borderRadius: 16, gap: 4},
    metrics: {flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingVertical: 8},
    metric: {flexGrow: 1, flexBasis: 72, minWidth: 0, gap: 2},
    value: {fontSize: 20, lineHeight: 28},
});
