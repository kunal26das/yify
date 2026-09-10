import {useEffect, useMemo, useState} from 'react';
import {ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {WatchRegion} from '@/domain';
import {useTmdbRepository} from '../../di/DependenciesContext';
import {PressableScale} from '../../components/motion';
import {ThemedText} from '../../components/themed-text';
import {Radius, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';

export function countryName(code: string): string {
    try {
        return new Intl.DisplayNames(['en'], {type: 'region'}).of(code) ?? code;
    } catch {
        return code;
    }
}

export function WatchRegionPicker({selected, automatic, onSelect, onClose}: {
    selected: string | null;
    automatic: string;
    onSelect: (code: string | null) => void;
    onClose: () => void;
}) {
    const {colors} = usePalette();
    const insets = useSafeAreaInsets();
    const repository = useTmdbRepository();
    const [query, setQuery] = useState('');
    const [attempt, setAttempt] = useState(0);
    const [result, setResult] = useState<{regions: WatchRegion[]; failed: boolean} | null>(null);

    useEffect(() => {
        let active = true;
        void repository.getWatchRegions().then(regions => {
            if (active) setResult({regions, failed: regions.length === 0});
        }).catch(() => {
            if (active) setResult({regions: [], failed: true});
        });
        return () => { active = false; };
    }, [repository, attempt]);

    const regions = useMemo(() => {
        const search = query.trim().toLocaleLowerCase();
        return (result?.regions ?? []).filter(region =>
            `${region.name} ${region.code}`.toLocaleLowerCase().includes(search));
    }, [query, result]);

    const choose = (code: string | null) => {
        onSelect(code);
        onClose();
    };

    return (
        <Modal visible transparent animationType="fade" onRequestClose={onClose}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={[styles.overlay, {paddingTop: insets.top + Spacing.lg, paddingBottom: insets.bottom + Spacing.lg}]}>
                <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close country picker"/>
                <View accessibilityViewIsModal style={[styles.panel, {backgroundColor: colors.surface, borderColor: colors.border}]}>
                    <View style={styles.heading}>
                        <ThemedText type="heading" style={styles.optionLabel}>Where do you watch?</ThemedText>
                        <PressableScale onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" hitSlop={8}>
                            <Ionicons name="close" size={24} color={colors.text}/>
                        </PressableScale>
                    </View>
                    <TextInput value={query} onChangeText={setQuery} placeholder="Search countries"
                        accessibilityLabel="Search countries" placeholderTextColor={colors.textFaint}
                        autoCorrect={false} style={[styles.search, {color: colors.text, borderColor: colors.border}]}/>
                    <PressableScale onPress={() => choose(null)} accessibilityRole="button"
                        accessibilityState={{selected: selected === null}}
                        contentStyle={[styles.option, {backgroundColor: selected === null ? colors.accentSoft : colors.surfaceSunken}]}>
                        <ThemedText style={[styles.optionLabel, {color: colors.text}]}>Use device country · {countryName(automatic)}</ThemedText>
                        {selected === null ? <Ionicons name="checkmark" size={20} color={colors.accent}/> : null}
                    </PressableScale>
                    {!result ? <ActivityIndicator style={styles.message} color={colors.accent}/> : result.failed ? (
                        <View style={styles.message}>
                            <ThemedText style={{color: colors.textMuted}}>Countries couldn’t be loaded.</ThemedText>
                            <PressableScale onPress={() => {setResult(null); setAttempt(value => value + 1);}} accessibilityRole="button">
                                <ThemedText style={{color: colors.accent}}>Try again</ThemedText>
                            </PressableScale>
                        </View>
                    ) : (
                        <FlatList data={regions} keyExtractor={region => region.code} keyboardShouldPersistTaps="handled"
                            style={styles.list} ListEmptyComponent={<ThemedText style={styles.message}>No matching countries</ThemedText>}
                            renderItem={({item}) => (
                                <PressableScale onPress={() => choose(item.code)} accessibilityRole="button"
                                    accessibilityState={{selected: selected === item.code}}
                                    contentStyle={[styles.option, {backgroundColor: selected === item.code ? colors.accentSoft : 'transparent'}]}>
                                    <ThemedText style={[styles.optionLabel, {color: colors.text}]}>{item.name}</ThemedText>
                                    {selected === item.code ? <Ionicons name="checkmark" size={20} color={colors.accent}/> : null}
                                </PressableScale>
                            )}/>
                    )}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.lg},
    panel: {width: '100%', maxWidth: 480, maxHeight: '90%', borderRadius: Radius.card, borderWidth: 1, padding: Spacing.lg, gap: Spacing.md},
    heading: {flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm},
    search: {borderWidth: 1, borderRadius: Radius.card, minHeight: 44, paddingHorizontal: Spacing.md, fontSize: 16},
    option: {minHeight: 48, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, borderRadius: Radius.card, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.sm},
    optionLabel: {flex: 1, minWidth: 0},
    list: {flexGrow: 0, minHeight: 120},
    message: {padding: Spacing.md, gap: Spacing.md},
});
