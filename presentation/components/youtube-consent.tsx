import {type ReactNode, useState} from 'react';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {usePrivacyPreferences} from '../di/DependenciesContext';
import {usePrivacyChoices} from '../hooks/use-privacy-choices';
import {usePalette} from '../hooks/use-palette';
import {Radius, Spacing} from '../constants/theme';
import {openLegalPage} from '../constants/legal';
import {ThemedText} from './themed-text';

export function YoutubeConsent({children}: {children: ReactNode}) {
    const choices = usePrivacyChoices();
    const privacy = usePrivacyPreferences();
    const {colors} = usePalette();
    const [error, setError] = useState<string | null>(null);

    if (choices.adultConfirmed && choices.youtube) return children;

    const allow = () => {
        try {
            privacy.updateChoices({...choices, youtube: true});
            setError(null);
        } catch {
            setError('Could not save your choice. YouTube remains off.');
        }
    };

    return (
        <ScrollView style={{flex: 1, backgroundColor: colors.background}}
            contentContainerStyle={styles.content}>
            <ThemedText type="defaultSemiBold">Play with YouTube</ThemedText>
            <ThemedText style={[styles.copy, {color: colors.textMuted}]}>
                YouTube receives your IP address and video choices and may use cookies. Allow trailers on this device? Change this anytime in Preferences → Privacy.
            </ThemedText>
            <View style={styles.actions}>
                <Pressable accessibilityRole="button" accessibilityLabel="Allow YouTube trailers"
                    onPress={allow} style={[styles.button, {backgroundColor: colors.accent}]}>
                    <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Allow YouTube</ThemedText>
                </Pressable>
                <Pressable accessibilityRole="link" accessibilityLabel="YouTube privacy policy"
                    onPress={() => void openLegalPage('https://policies.google.com/privacy')
                        .catch(() => setError('Could not open Google’s privacy policy.'))}>
                    <ThemedText type="link">YouTube privacy</ThemedText>
                </Pressable>
            </View>
            {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    content: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm},
    copy: {textAlign: 'center', maxWidth: 560},
    actions: {flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: Spacing.lg},
    button: {minHeight: 44, justifyContent: 'center', paddingHorizontal: Spacing.lg, borderRadius: Radius.md},
});
