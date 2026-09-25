import {type ReactNode, useState} from 'react';
import {Platform, Pressable, ScrollView, StyleSheet, Switch, View} from 'react-native';
import {Link, usePathname} from 'expo-router';
import Head from 'expo-router/head';
import {usePrivacyPreferences} from '../di/DependenciesContext';
import {usePrivacyChoices} from '../hooks/use-privacy-choices';
import {usePalette} from '../hooks/use-palette';
import {LEGAL_LINKS, openLegalPage} from '../constants/legal';
import {Radius, Spacing} from '../constants/theme';
import {ThemedText} from './themed-text';
import {canonicalUrl} from '../constants/site';

const PAGE_TITLES: Record<string, string> = {
    '/': 'Yify — Discover Movies', '/movies': 'Browse Movies — Yify', '/shows': 'Shows — Yify',
    '/preferences': 'Preferences — Yify', '/watchlist': 'Watchlist — Yify', '/history': 'History — Yify',
    '/journal': 'Journal — Yify', '/anime': 'Anime — Yify',
    '/upgrade': 'Supporter options — Yify',
};

export function PrivacyGate({children}: {children: ReactNode}) {
    const choices = usePrivacyChoices();
    const privacy = usePrivacyPreferences();
    const {colors} = usePalette();
    const pathname = usePathname();
    const [adult, setAdult] = useState(false);
    const [analytics, setAnalytics] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (choices.adultConfirmed) return children;

    const proceed = () => {
        if (!adult) return;
        try {
            privacy.updateChoices({adultConfirmed: true, analytics});
            setError(null);
        } catch {
            setError('Could not save your choice. Allow storage for Yify and try again.');
        }
    };

    return (
        <ScrollView style={{backgroundColor: colors.background}} contentContainerStyle={styles.page}>
            <Head>
                <title>{PAGE_TITLES[pathname] ?? 'Yify — Movie Discovery'}</title>
                <meta name="robots" content={pathname === '/anime' ? 'noindex,nofollow'
                    : ['/preferences', '/watchlist', '/history', '/journal', '/upgrade'].includes(pathname) ? 'noindex,follow' : 'index,follow'}/>
                <link rel="canonical" href={canonicalUrl(pathname)}/>
            </Head>
            <View style={[styles.card, {borderColor: colors.border}]}>
                <ThemedText type="title">Welcome to Yify</ThemedText>
                <ThemedText>Yify is for adults aged 18 and over.</ThemedText>
                <View style={styles.row}>
                    <ThemedText style={styles.label}>I am 18 or older</ThemedText>
                    <Switch value={adult} onValueChange={setAdult} accessibilityLabel="I am 18 or older"/>
                </View>
                <View style={styles.row}>
                    <View style={styles.label}>
                        <ThemedText type="defaultSemiBold">Optional usage analytics</ThemedText>
                        <ThemedText style={{color: colors.textMuted}}>Share app activity and purchase or ad measurements with Google Firebase and RevenueCat, and performance measurements with Sentry. You can change this in Preferences → Privacy.</ThemedText>
                    </View>
                    <Switch value={analytics} onValueChange={setAnalytics} accessibilityLabel="Optional usage analytics"/>
                </View>
                <ThemedText style={{color: colors.textMuted}}>You can continue with analytics off. Account, billing and crash diagnostics are explained in our privacy policy. Advertising choices are handled separately.</ThemedText>
                <View style={styles.links}>
                    {LEGAL_LINKS.map(link => Platform.OS === 'web'
                        ? <Link key={link.url} href={link.url} target="_blank" rel="noopener noreferrer">
                            <ThemedText type="link">{link.label}</ThemedText>
                        </Link>
                        : <Pressable key={link.url} accessibilityRole="link"
                        onPress={() => void openLegalPage(link.url).catch(() => setError('Could not open the page. Please try again.'))}>
                        <ThemedText type="link">{link.label}</ThemedText>
                    </Pressable>)}
                </View>
                {error ? <ThemedText accessibilityRole="alert">{error}</ThemedText> : null}
                <Pressable disabled={!adult} accessibilityRole="button" accessibilityState={{disabled: !adult}}
                    onPress={proceed} style={[styles.button, {backgroundColor: colors.accent, opacity: adult ? 1 : 0.45}]}>
                    <ThemedText type="defaultSemiBold" style={{color: colors.onAccent}}>Continue</ThemedText>
                </Pressable>
                {Platform.OS === 'web' ? <View style={styles.links}>
                    {[['Movies', '/movies'], ['Shows', '/shows'], ['About Yify', '/guide/'], ['Yify Supporter', '/support/']].map(([label, path]) =>
                        <Link key={path} href={canonicalUrl(path)}><ThemedText type="link">{label}</ThemedText></Link>)}
                </View> : null}
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    page: {flexGrow: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl, paddingVertical: 64},
    card: {width: '100%', maxWidth: 560, borderWidth: 1, borderRadius: Radius.lg, padding: Spacing.xl, gap: Spacing.lg},
    row: {flexDirection: 'row', alignItems: 'center', gap: Spacing.md},
    label: {flex: 1},
    links: {flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.lg},
    button: {minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: Spacing.md, borderRadius: Radius.md},
});
