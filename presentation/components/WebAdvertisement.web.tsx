import {useEffect, useId, useState} from 'react';
import {StyleSheet, View} from 'react-native';
import type {DisplayAds, DisplayAdState} from '@/domain';
import {useDisplayAds} from '../di/DependenciesContext';
import {usePurchases} from '../hooks/use-purchases';
import {usePalette} from '../hooks/use-palette';
import {ThemedText} from './themed-text';

export function WebAdvertisement({gutter = 0}: {gutter?: number}) {
    const ads = useDisplayAds();
    const purchases = usePurchases();
    if (!ads.supported || !purchases.ready || purchases.adsRemoved) return null;
    return <DisplayPlacement ads={ads} gutter={gutter}/>;
}

function DisplayPlacement({ads, gutter}: {ads: DisplayAds; gutter: number}) {
    const id = `yify-display-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
    const [state, setState] = useState<DisplayAdState>('loading');
    const {colors} = usePalette();
    useEffect(() => ads.attach(id, setState), [ads, id]);
    const hidden = state === 'unfilled' || state === 'blocked' || state === 'disabled';
    return (
        <View style={[styles.container, {paddingHorizontal: gutter}, hidden && styles.hidden]}>
            <ThemedText style={[styles.label, {color: colors.textMuted}]}>Advertisement</ThemedText>
            <View nativeID={id} style={styles.host}/>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {width: '100%', maxWidth: 1100, alignSelf: 'center', marginVertical: 32},
    label: {fontSize: 11, lineHeight: 16, textAlign: 'center', marginBottom: 8},
    host: {width: '100%'},
    hidden: {display: 'none'},
});
