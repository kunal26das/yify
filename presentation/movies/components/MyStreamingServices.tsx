import {useState} from 'react';
import {StyleSheet, type StyleProp, View, type ViewStyle} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {usePreferencesRepository} from '../../di/DependenciesContext';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {usePreferences} from '../../hooks/use-preferences';
import {StreamingServicesPicker} from './StreamingServicesPicker';
import {countryName, WatchRegionPicker} from './WatchRegionPicker';
import {useDeviceRegion} from './watchRegion';

export function MyStreamingServices({style}: {style?: StyleProp<ViewStyle>} = {}) {
    const {colors} = usePalette();
    const preferences = usePreferences();
    const repository = usePreferencesRepository();
    const automatic = useDeviceRegion();
    const country = preferences.watchRegion ?? automatic;
    const selected = preferences.streamingServices[country] ?? [];
    const [pickingCountry, setPickingCountry] = useState(false);
    const [pickingServices, setPickingServices] = useState(false);

    return <View style={[styles.container, style]}>
        <View style={styles.row}>
            <PressableScale onPress={() => setPickingServices(true)} accessibilityRole="button"
                accessibilityLabel={`My streaming services, ${selected.length} added for ${countryName(country)}`}
                style={styles.main} contentStyle={styles.mainContent}>
                <Ionicons name="tv-outline" size={22} color={colors.textMuted}/>
                <View style={styles.text}>
                    <ThemedText type="defaultSemiBold">My streaming services</ThemedText>
                    <ThemedText type="caption" style={{color: colors.textMuted}}>
                        {selected.length ? `${selected.length} added` : 'Add your services'}
                    </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.textMuted}/>
            </PressableScale>
            <PressableScale onPress={() => setPickingCountry(true)} accessibilityRole="button"
                accessibilityLabel={`Change viewing country, currently ${countryName(country)}`}
                contentStyle={styles.country}>
                <ThemedText type="caption" style={[styles.countryLabel, {color: colors.accent}]}>{countryName(country)}</ThemedText>
                <Ionicons name="chevron-down" size={14} color={colors.accent}/>
            </PressableScale>
        </View>
        {pickingCountry ? <WatchRegionPicker selected={preferences.watchRegion ?? null} automatic={automatic}
            onSelect={code => repository.setWatchRegion(code)} onClose={() => setPickingCountry(false)}/> : null}
        {pickingServices ? <StreamingServicesPicker key={country} country={country} selected={selected}
            onSelect={ids => repository.setStreamingServices(country, ids)} onClose={() => setPickingServices(false)}/> : null}
    </View>;
}

const styles = StyleSheet.create({
    container: {paddingVertical: Spacing.sm},
    row: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: Spacing.lg},
    main: {flexGrow: 1, flexBasis: 210},
    mainContent: {minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    text: {flex: 1, minWidth: 0},
    country: {minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs},
    countryLabel: {flexShrink: 1},
});
