import {Ionicons} from '@expo/vector-icons';
import {ScrollView, StyleSheet, View} from 'react-native';
import type {MovieDetails} from '@/domain';
import {Analytics} from '@/presentation/analytics/events';
import {useToggleWatchlist} from '../useWatchlist';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {formatCompact} from './format';
import {useIsInWatchlist} from '../useWatchlist';

type IconName = React.ComponentProps<typeof Ionicons>['name'];

interface PillProps {
    icon: IconName;
    label: string;
    tint: string;
    fill: string;
}

function Pill({icon, label, tint, fill}: PillProps) {
    return (
        <View style={[styles.pill, {backgroundColor: fill}]}>
            <Ionicons name={icon} size={18} color={tint}/>
            <ThemedText style={[styles.pillLabel, {color: tint}]} numberOfLines={1}>
                {label}
            </ThemedText>
        </View>
    );
}

export function WatchActions({
    details,
    onShare,
    onDownload,
    pad = 0,
}: {
    details: MovieDetails;
    onShare: () => void;
    onDownload: () => void;
    pad?: number;
}) {
    const {colors} = usePalette();
    const saved = useIsInWatchlist(details.id);
    const toggleWatchlist = useToggleWatchlist();

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={{marginHorizontal: -pad}}
            contentContainerStyle={[styles.row, {paddingHorizontal: pad}]}
        >
            <View accessibilityRole="text" accessibilityLabel={`${details.likeCount ?? 0} likes`}>
                <Pill
                    icon="heart-outline"
                    label={formatCompact(details.likeCount ?? 0)}
                    tint={colors.text}
                    fill={colors.surfaceSunken}
                />
            </View>

            <PressableScale
                onPress={() => {
                    if (saved) Analytics.watchlistRemove(details);
                    else Analytics.watchlistAdd(details);
                    toggleWatchlist(details);
                }}
                accessibilityRole="button"
                accessibilityState={{selected: saved}}
                accessibilityLabel={saved ? 'Remove from Watchlist' : 'Save to Watchlist'}
                pressedScale={0.95}
                pressedOpacity={0.85}
            >
                <Pill
                    icon={saved ? 'checkmark' : 'add'}
                    label={saved ? 'Saved' : 'Save'}
                    tint={saved ? colors.accent : colors.text}
                    fill={saved ? colors.accentSoft : colors.surfaceSunken}
                />
            </PressableScale>

            <PressableScale
                onPress={onShare}
                accessibilityRole="button"
                accessibilityLabel="Share"
                pressedScale={0.95}
                pressedOpacity={0.85}
            >
                <Pill
                    icon="arrow-redo-outline"
                    label="Share"
                    tint={colors.text}
                    fill={colors.surfaceSunken}
                />
            </PressableScale>

            {details.torrents.length > 0 ? (
                <PressableScale
                    onPress={onDownload}
                    accessibilityRole="button"
                    accessibilityLabel="Download"
                    pressedScale={0.95}
                    pressedOpacity={0.85}
                >
                    <Pill
                        icon="download-outline"
                        label="Download"
                        tint={colors.text}
                        fill={colors.surfaceSunken}
                    />
                </PressableScale>
            ) : null}

            {details.downloadCount != null ? (
                <View
                    accessibilityRole="text"
                    accessibilityLabel={`${details.downloadCount} downloads`}
                >
                    <Pill
                        icon="cloud-download-outline"
                        label={formatCompact(details.downloadCount)}
                        tint={colors.text}
                        fill={colors.surfaceSunken}
                    />
                </View>
            ) : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    row: {flexGrow: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.sm},
    pill: {
        height: 36,
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: 14,
        borderRadius: Radius.pill,
    },
    pillLabel: {fontSize: 14, lineHeight: 18, fontWeight: '600'},
});
