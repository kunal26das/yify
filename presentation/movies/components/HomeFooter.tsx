import {Pressable, StyleSheet, View} from 'react-native';
import {Analytics} from '@/lib/analytics-events';
import {ThemedText} from '../../components/themed-text';
import {FontFamily, Spacing} from '../../constants/theme';
import {usePalette} from '../../hooks/use-palette';
import {useResponsive} from '../../hooks/use-responsive';
import {DESTINATIONS, useGoTo} from '../constants/destinations';
import {PlayStoreButton} from './PlayStoreButton';

interface FooterLink {
    label: string;
    href: string;
}

const BROWSE_LINKS: readonly FooterLink[] = DESTINATIONS.map(({label, href}) => ({label, href}));

const GENRE_LINKS: readonly FooterLink[] = [
    {label: 'Action', href: '/browse?genre=action'},
    {label: 'Comedy', href: '/browse?genre=comedy'},
    {label: 'Drama', href: '/browse?genre=drama'},
    {label: '4K Ultra HD', href: '/browse?quality=2160p'},
];

const APP_LINKS: readonly FooterLink[] = [{label: 'Settings', href: '/settings'}];

export function HomeFooter() {
    const {colors} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const goTo = useGoTo();

    const go = (link: FooterLink) => {
        Analytics.footerLink(link.label);
        goTo(link.href);
    };

    const column = (title: string, links: readonly FooterLink[]) => (
        <View style={styles.column} key={title}>
            <ThemedText style={[styles.columnTitle, {color: colors.text}]}>{title}</ThemedText>
            {links.map((link) => (
                <Pressable
                    key={link.label}
                    onPress={() => go(link)}
                    accessibilityRole="link"
                    style={({pressed}) => ({opacity: pressed ? 0.6 : 1})}
                >
                    <ThemedText style={[styles.link, {color: colors.textMuted}]}>{link.label}</ThemedText>
                </Pressable>
            ))}
        </View>
    );

    return (
        <View style={[styles.footer, {borderTopColor: colors.border, paddingHorizontal: gutter}]}>
            <View style={[styles.top, isPhone && styles.topPhone]}>
                <View style={styles.brand}>
                    <ThemedText type="title" style={[styles.wordmark, {color: colors.accent}]}>
                        YIFY
                    </ThemedText>
                    <ThemedText style={[styles.tagline, {color: colors.textMuted}]}>
                        A quieter way to browse the catalogue — trailers, ratings and a list you keep.
                    </ThemedText>
                    <View style={styles.store}>
                        <PlayStoreButton source="home_footer"/>
                    </View>
                </View>

                <View style={[styles.columns, isPhone && styles.columnsPhone]}>
                    {column('Browse', BROWSE_LINKS)}
                    {column('Genres', GENRE_LINKS)}
                    {column('App', APP_LINKS)}
                </View>
            </View>

        </View>
    );
}

const styles = StyleSheet.create({
    footer: {
        marginTop: Spacing.xl,
        paddingTop: Spacing.xxl,
        paddingBottom: Spacing.xl,
        borderTopWidth: StyleSheet.hairlineWidth,
    },
    top: {flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.xxl},
    topPhone: {flexDirection: 'column', gap: Spacing.xl},

    brand: {flexShrink: 1, maxWidth: 380, gap: Spacing.sm},
    wordmark: {fontSize: 22, letterSpacing: 1.5, fontFamily: FontFamily.displayExtra},
    tagline: {fontSize: 13.5, lineHeight: 19, fontFamily: FontFamily.regular},
    store: {marginTop: Spacing.sm},

    columns: {flexDirection: 'row', gap: Spacing.xxxl},
    columnsPhone: {gap: Spacing.xl, justifyContent: 'space-between'},
    column: {gap: 7},
    columnTitle: {fontSize: 13, letterSpacing: 0.6, marginBottom: 2, fontFamily: FontFamily.bold},
    link: {fontSize: 13.5, fontFamily: FontFamily.regular},

});
