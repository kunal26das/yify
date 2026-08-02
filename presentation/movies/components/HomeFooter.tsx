import {StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {Analytics} from '@/presentation/analytics/events';
import {PressableScale, enterRise} from '../../components/motion';
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
    {label: 'Action', href: '/movies?genre=action'},
    {label: 'Comedy', href: '/movies?genre=comedy'},
    {label: 'Drama', href: '/movies?genre=drama'},
    {label: '4K Ultra HD', href: '/movies?quality=2160p'},
];

const APP_LINKS: readonly FooterLink[] = [{label: 'Preferences', href: '/preferences'}];

export function HomeFooter() {
    const {colors} = usePalette();
    const {isPhone, gutter} = useResponsive();
    const goTo = useGoTo();

    const go = (link: FooterLink) => {
        Analytics.footerLink(link.label);
        goTo(link.href);
    };

    const column = (title: string, links: readonly FooterLink[], index: number) => (
        <Animated.View entering={enterRise(index + 1)} style={styles.column} key={title}>
            <ThemedText style={[styles.columnTitle, {color: colors.text}]}>{title}</ThemedText>
            {links.map((link) => (
                <PressableScale
                    key={link.label}
                    onPress={() => go(link)}
                    accessibilityRole="link"
                    pressedScale={0.94}
                    pressedOpacity={0.6}
                    hoveredScale={1.04}
                    contentStyle={styles.linkHit}
                >
                    <ThemedText style={[styles.link, {color: colors.textMuted}]}>{link.label}</ThemedText>
                </PressableScale>
            ))}
        </Animated.View>
    );

    return (
        <View style={[styles.footer, {borderTopColor: colors.border, paddingHorizontal: gutter}]}>
            <View style={[styles.top, isPhone && styles.topPhone]}>
                <Animated.View entering={enterRise()} style={styles.brand}>
                    <ThemedText type="title" style={[styles.wordmark, {color: colors.accent}]}>
                        YIFY
                    </ThemedText>
                    <ThemedText style={[styles.tagline, {color: colors.textMuted}]}>
                        A quieter way to browse the catalogue — trailers, ratings and a list you keep.
                    </ThemedText>
                    <View style={styles.store}>
                        <PlayStoreButton source="home_footer"/>
                    </View>
                </Animated.View>

                <View style={[styles.columns, isPhone && styles.columnsPhone]}>
                    {column('Browse', BROWSE_LINKS, 0)}
                    {column('Genres', GENRE_LINKS, 1)}
                    {column('App', APP_LINKS, 2)}
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
    linkHit: {alignSelf: 'flex-start'},

});
