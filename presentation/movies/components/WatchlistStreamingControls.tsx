import {StyleSheet, View} from 'react-native';
import {ThemedText} from '../../components/themed-text';
import {PressableScale} from '../../components/motion';
import {useToast} from '../../components/toast';
import {Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import type {WatchlistStreaming} from '../useWatchlistStreaming';
import {MyStreamingServices} from './MyStreamingServices';
import {WatchlistControlButton} from './WatchlistControls';
import {openStreamingLink} from './openStreamingLink';

export function WatchlistStreamingControls({streaming}: {streaming: WatchlistStreaming}) {
    const {colors} = usePalette();
    const toast = useToast();
    const action = streaming.busy ? `Checking ${streaming.completed} of ${streaming.batchTotal}`
        : streaming.uncheckedCount > 0 ? (streaming.checkedCount + streaming.failedCount > 0
            ? `Check next ${streaming.nextCount}` : 'Check availability') : 'Retry availability';

    return <View style={styles.container}>
        <MyStreamingServices/>
        <View style={styles.actions}>
            <WatchlistControlButton label="On my services" icon="tv-outline" active={streaming.filterActive}
                disabled={streaming.services.length === 0} onPress={() => streaming.setOnlySelected(!streaming.filterActive)}/>
            {streaming.nextCount > 0 || streaming.busy ? <WatchlistControlButton label={action}
                icon="refresh-outline" disabled={streaming.busy} onPress={() => {void streaming.checkNext();}}/> : null}
        </View>
        <ThemedText type="caption" accessibilityLiveRegion="polite" style={{color: colors.textMuted}}>
            {streaming.unsupportedCountry ? 'Streaming availability is not covered in this country.'
                : `${streaming.checkedCount} of ${streaming.totalCount} titles checked${streaming.failedCount ? ` · ${streaming.failedCount} couldn’t be checked` : ''}`}
        </ThemedText>
        {streaming.filterActive && streaming.uncheckedCount > 0 ? <ThemedText type="caption" style={{color: colors.textMuted}}>
            {streaming.uncheckedCount} unchecked {streaming.uncheckedCount === 1 ? 'title is' : 'titles are'} hidden. Check availability to include matches.
        </ThemedText> : null}
        {streaming.missingIdCount > 0 ? <ThemedText type="caption" style={{color: colors.textMuted}}>
            Availability cannot be checked for {streaming.missingIdCount} {streaming.missingIdCount === 1 ? 'title' : 'titles'}.
        </ThemedText> : null}
        {streaming.checkedCount > 0 ? <PressableScale accessibilityRole="link"
            accessibilityLabel="Streaming availability by JustWatch" contentStyle={styles.attribution}
            onPress={() => {void openStreamingLink('https://www.justwatch.com')
                .catch(() => toast('The website could not be opened.', 'alert-circle-outline'));}}>
            <ThemedText type="caption" style={{color: colors.textMuted}}>Availability by JustWatch ↗</ThemedText>
        </PressableScale> : null}
    </View>;
}

const styles = StyleSheet.create({
    container: {gap: Spacing.sm, marginTop: Spacing.md},
    actions: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm},
    attribution: {minHeight: 44, justifyContent: 'center'},
});
