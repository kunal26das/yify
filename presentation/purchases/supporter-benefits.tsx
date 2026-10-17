import {StyleSheet, View} from 'react-native';
import {ThemedText} from '../components/themed-text';
import {usePalette} from '../hooks/use-palette';

export function SupporterBenefits({active = false}: {active?: boolean}) {
    const {colors} = usePalette();
    return <View style={[styles.preview, {backgroundColor: colors.surfaceSunken, borderColor: colors.border}]}>
        {active ? <ThemedText type="defaultSemiBold">Your benefits are active</ThemedText> : null}
        <View style={styles.benefit}>
            <ThemedText type="defaultSemiBold">No Yify ads</ThemedText>
            <ThemedText style={{color: colors.textMuted}}>Browse without ads placed by Yify. YouTube and streaming-service ads are separate.</ThemedText>
        </View>
        <View style={styles.benefit}>
            <ThemedText type="defaultSemiBold">Your viewing insights</ThemedText>
            <ThemedText style={{color: colors.textMuted}}>See monthly and all-time watches, time watched, top genres and personal ratings from your movie journal.</ThemedText>
        </View>
    </View>;
}

const styles = StyleSheet.create({
    benefit: {gap: 4, paddingTop: 12},
    preview: {padding: 14, borderWidth: 1, borderRadius: 16, gap: 4},
});
