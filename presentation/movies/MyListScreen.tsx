import {Ionicons} from '@expo/vector-icons';
import {useMemo} from 'react';
import {FlatList, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {Movie} from '@/domain';
import {Analytics} from '@/lib/analytics-events';
import {PressableScale, enterRise} from '../components/motion';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {HoverCardHost} from './components/HoverCard';
import {MoviePosterItem} from './components/MoviePosterItem';
import {POSTER_GAP, POSTER_MIN_WIDTH} from './components/moviePosterLayout';
import {TopNav, useTopNavHeight} from './components/TopNav';
import {useWatchlist} from './useWatchlist';
import {useGoTo} from './constants/destinations';

export function MyListScreen() {
    const insets = useSafeAreaInsets();
    const {colors} = usePalette();
    const {width, contentMaxWidth, gutter} = useResponsive();
    const navHeight = useTopNavHeight();
    const movies = useWatchlist();
    const goTo = useGoTo();

    const gridWidth = Math.min(width, contentMaxWidth);
    const numColumns = useMemo(
        () => Math.max(2, Math.floor(gridWidth / (POSTER_MIN_WIDTH + POSTER_GAP))),
        [gridWidth]
    );
    const itemWidth = useMemo(
        () => Math.floor((gridWidth - POSTER_GAP) / numColumns) - POSTER_GAP,
        [gridWidth, numColumns]
    );

    return (
        <HoverCardHost>
            <ThemedView style={styles.container}>
                {movies.length === 0 ? (
                    <Animated.View entering={enterRise()} style={[styles.empty, {paddingTop: navHeight}]}>
                        <Ionicons name="bookmark-outline" size={54} color={colors.textMuted}/>
                        <ThemedText type="heading" style={styles.emptyTitle}>Your list is empty</ThemedText>
                        <ThemedText style={[styles.emptyBody, {color: colors.textMuted}]}>
                            Open any movie and tap My List to keep it here.
                        </ThemedText>
                        <PressableScale
                            onPress={() => {
                                Analytics.browseAllOpen('my_list_empty');
                                goTo('/browse');
                            }}
                            pressedScale={0.94}
                            pressedOpacity={0.85}
                            hoveredScale={1.03}
                        >
                            <View style={[styles.cta, {backgroundColor: colors.accent}]}>
                                <Ionicons name="search" size={17} color={colors.onAccent}/>
                                <ThemedText style={[styles.ctaLabel, {color: colors.onAccent}]}>
                                    Find something to watch
                                </ThemedText>
                            </View>
                        </PressableScale>
                    </Animated.View>
                ) : (
                    <FlatList
                        key={numColumns}
                        data={movies}
                        numColumns={numColumns}
                        keyExtractor={(item: Movie) => String(item.id)}
                        renderItem={({item}) => (
                            <MoviePosterItem movie={item} width={itemWidth} source="my_list"/>
                        )}
                        showsVerticalScrollIndicator={false}
                        ListHeaderComponent={
                            <Animated.View
                                entering={enterRise()}
                                style={{paddingHorizontal: gutter - POSTER_GAP / 2}}
                            >
                                <ThemedText type="title" style={styles.heading}>My List</ThemedText>
                                <ThemedText style={[styles.count, {color: colors.textMuted}]}>
                                    {movies.length} {movies.length === 1 ? 'title' : 'titles'}
                                </ThemedText>
                            </Animated.View>
                        }
                        contentContainerStyle={{
                            paddingTop: navHeight + Spacing.sm,
                            paddingBottom: insets.bottom + 40,
                            paddingHorizontal: POSTER_GAP / 2,
                            alignSelf: 'center',
                            width: gridWidth,
                        }}
                    />
                )}
                <TopNav active="my-list"/>
            </ThemedView>
        </HoverCardHost>
    );
}

const styles = StyleSheet.create({
    container: {flex: 1},
    heading: {marginBottom: 2},
    count: {fontSize: 13.5, fontFamily: FontFamily.medium, marginBottom: Spacing.lg},

    empty: {flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, gap: 6},
    emptyTitle: {marginTop: 12},
    emptyBody: {fontSize: 14, lineHeight: 20, textAlign: 'center'},
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        paddingHorizontal: 22,
        paddingVertical: 12,
        marginTop: 20,
    },
    ctaLabel: {fontSize: 15, fontFamily: FontFamily.bold},
});
