import {Ionicons} from '@expo/vector-icons';
import {Image} from 'expo-image';
import {router} from 'expo-router';
import {useState} from 'react';
import {ActivityIndicator, Pressable, ScrollView, StyleSheet, View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import type {CastMember, Torrent} from '@/domain';
import {ThemedText} from '../components/themed-text';
import {ThemedView} from '../components/themed-view';
import {LinearGradient} from '../components/linear-gradient';
import {LiquidGlassView} from '../components/liquid-glass-view';
import {usePalette} from '../hooks/use-palette';
import {useResponsive} from '../hooks/use-responsive';
import {FontFamily, Radius, Spacing} from '../constants/theme';
import {YoutubePlayer} from './components/YoutubePlayer';
import {MovieRail} from './components/MovieRail';
import {ScreenshotLightbox} from './components/ScreenshotLightbox';
import {TorrentNoticeSheet} from './components/TorrentNoticeSheet';
import {useIsInWatchlist} from './useWatchlist';
import {toggleWatchlist} from '@/lib/watchlist';
import type {MovieDetailsViewModel} from './useMovieDetailsViewModel';

const COLUMN_MAX = 920;

export function MovieDetailsScreen({ viewModel }: { viewModel: MovieDetailsViewModel }) {
  const { details, suggestions, loading, error, reload } = viewModel;
  const insets = useSafeAreaInsets();
    const {colors, scheme} = usePalette();
    const {width, isPhone} = useResponsive();
    const columnWidth = Math.min(width, COLUMN_MAX);
    const [showTrailer, setShowTrailer] = useState(false);
    const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
    const [noticeTorrent, setNoticeTorrent] = useState<Torrent | null>(null);
    const saved = useIsInWatchlist(details?.id ?? -1);

    const TORRENT_GAP = 10;
    const bodyWidth = columnWidth - Spacing.lg * 2;
    const torrentCols = Math.max(2, Math.floor(bodyWidth / 250));
    const torrentCardWidth = Math.floor((bodyWidth - TORRENT_GAP * (torrentCols - 1)) / torrentCols);

  const BackButton = (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[styles.backButton, { top: insets.top + 8 }]}
    >
        <LiquidGlassView
            tint={scheme === 'dark' ? 'dark' : 'light'}
            fallbackBackgroundColor="rgba(8,8,12,0.5)"
            style={styles.backGlass}
        >
            <Ionicons name="chevron-back" size={24} color="#fff"/>
        </LiquidGlassView>
    </Pressable>
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        {BackButton}
          <ActivityIndicator size="large" color={colors.accent}/>
      </ThemedView>
    );
  }

  if (error || !details) {
    return (
      <ThemedView style={styles.centered}>
        {BackButton}
        <View style={styles.errorBox}>
            <Ionicons name="cloud-offline-outline" size={56} color={colors.textMuted}/>
            <ThemedText type="heading" style={styles.errorTitle}>
                Couldn&apos;t load this movie
            </ThemedText>
            <ThemedText style={[styles.errorMessage, {color: colors.textMuted}]}>
            {error ?? 'Movie not found'}
          </ThemedText>
            <Pressable onPress={reload} accessibilityRole="button"
                       style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}>
                <View style={[styles.retryButton, {backgroundColor: colors.accent}]}>
                    <Ionicons name="refresh" size={18} color={colors.onAccent}/>
                    <ThemedText style={[styles.retryLabel, {color: colors.onAccent}]}>Try again</ThemedText>
                </View>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  const meta = [
    details.year ? String(details.year) : null,
    details.runtimeMinutes ? `${details.runtimeMinutes} min` : null,
    details.language ? details.language.toUpperCase() : null,
    details.mpaRating || null,
  ].filter(Boolean) as string[];

  const description = details.descriptionFull || details.descriptionIntro || details.summary;
    const posterUrl = details.posterUrls[details.posterUrls.length - 1] ?? details.posterUrls[0];
    const hasTrailer = !!details.ytTrailerCode;
    const backdropUrl = details.screenshotUrls[0] ?? details.backgroundImageUrl;

  return (
    <ThemedView style={styles.container}>
      <ScrollView
          contentContainerStyle={{paddingTop: insets.top, paddingBottom: insets.bottom + 40}}
        showsVerticalScrollIndicator={false}
      >
          <View style={styles.column}>
              <View style={styles.hero}>
                  <View style={styles.backdropWrap}>
                      {backdropUrl ? (
                          <Image
                              source={{uri: backdropUrl}}
                              style={StyleSheet.absoluteFill}
                              contentFit="cover"
                              transition={220}
                              cachePolicy="memory-disk"
                          />
                      ) : (
                          <View style={[StyleSheet.absoluteFill, {backgroundColor: colors.surfaceElevated}]}/>
                      )}
                      {hasTrailer && !showTrailer ? (
                          <Pressable
                              onPress={() => setShowTrailer(true)}
                              style={styles.playOverlay}
                              accessibilityRole="button"
                              accessibilityLabel="Play trailer"
                          >
                              <LiquidGlassView
                                  tint={scheme === 'dark' ? 'dark' : 'light'}
                                  fallbackBackgroundColor="rgba(8,8,12,0.5)"
                                  style={styles.playCircle}
                              >
                                  <Ionicons name="play" size={30} color="#fff" style={styles.playIcon}/>
                              </LiquidGlassView>
                          </Pressable>
                      ) : null}
                      {hasTrailer && showTrailer ? (
                          <View style={[StyleSheet.absoluteFill, styles.trailerOverlay]}>
                              <YoutubePlayer videoId={details.ytTrailerCode} width={columnWidth} autoplay/>
                          </View>
                      ) : null}
                  </View>
                  {!showTrailer ? (
                      <LinearGradient
                          colors={['rgba(0,0,0,0)', scheme === 'dark' ? 'rgba(38,38,36,0.9)' : 'rgba(250,249,245,0.95)']}
                          bands={12}
                          style={styles.heroFade}
                          pointerEvents="none"
                      />
                  ) : null}
          </View>

              <View style={styles.headerBlock}>
                  {posterUrl ? (
                      <Image
                          source={{uri: posterUrl}}
                          placeholder={details.posterUrls.length > 1 ? {uri: details.posterUrls[0]} : undefined}
                          placeholderContentFit="cover"
                          style={[styles.poster, {borderColor: colors.border, backgroundColor: colors.surfaceElevated}]}
                          contentFit="cover"
                          transition={220}
                          cachePolicy="memory-disk"
                      />
                  ) : null}
                  <View style={styles.titleBlock}>
                      <ThemedText type="title" style={styles.title}>
                          {details.title}
                      </ThemedText>
                      {details.titleLong && details.titleLong !== details.title ? (
                          <ThemedText style={[styles.subtitle, {color: colors.textMuted}]} numberOfLines={2}>
                              {details.titleLong}
                          </ThemedText>
                      ) : null}
                      <View style={styles.metaRow}>
                          {details.rating ? (
                              <View style={[styles.ratingPill, {
                                  backgroundColor: colors.gold + '22',
                                  borderColor: colors.gold + '55'
                              }]}>
                                  <Ionicons name="star" size={13} color={colors.gold}/>
                                  <ThemedText style={[styles.ratingText, {color: colors.gold}]}>
                                      {details.rating.toFixed(1)}
                                  </ThemedText>
                              </View>
                          ) : null}
                          {meta.map((m, i) => (
                              <ThemedText key={i} style={[styles.metaText, {color: colors.textMuted}]}>
                                  {m}
                              </ThemedText>
                          ))}
                          {details.likeCount != null ? (
                              <View style={styles.inlineStat}>
                                  <Ionicons name="heart" size={13} color={colors.accent}/>
                                  <ThemedText style={[styles.metaText, {color: colors.textMuted}]}>
                                      {formatCount(details.likeCount)}
                                  </ThemedText>
                              </View>
                          ) : null}
                          {details.downloadCount != null ? (
                              <View style={styles.inlineStat}>
                                  <Ionicons name="download" size={13} color={colors.accent}/>
                                  <ThemedText style={[styles.metaText, {color: colors.textMuted}]}>
                                      {formatCount(details.downloadCount)}
                                  </ThemedText>
                              </View>
                          ) : null}
                      </View>
                  </View>
          </View>

              <View style={styles.body}>
                  <View style={styles.actionsRow}>
                      {hasTrailer ? (
                          <Pressable
                              onPress={() => setShowTrailer((v) => !v)}
                              accessibilityRole="button"
                              accessibilityLabel={showTrailer ? 'Hide trailer' : 'Play trailer'}
                              style={({pressed}) => [styles.actionFlex, {opacity: pressed ? 0.9 : 1}]}
                          >
                              <View
                                  style={[
                                      styles.playButton,
                                      showTrailer
                                          ? {backgroundColor: colors.surfaceElevated, borderColor: colors.border, borderWidth: StyleSheet.hairlineWidth}
                                          : {backgroundColor: colors.accent},
                                  ]}
                              >
                                  <Ionicons
                                      name={showTrailer ? 'chevron-up' : 'play'}
                                      size={18}
                                      color={showTrailer ? colors.text : colors.onAccent}
                                  />
                                  <ThemedText style={[styles.playLabel, {color: showTrailer ? colors.text : colors.onAccent}]}>
                                      {showTrailer ? 'Hide trailer' : 'Play trailer'}
                                  </ThemedText>
                              </View>
                          </Pressable>
                      ) : null}
                      <Pressable
                          onPress={() => toggleWatchlist(details)}
                          accessibilityRole="button"
                          accessibilityState={{selected: saved}}
                          accessibilityLabel={saved ? 'Remove from My List' : 'Add to My List'}
                          style={({pressed}) => [styles.actionFlex, {opacity: pressed ? 0.9 : 1}]}
                      >
                          <View
                              style={[
                                  styles.saveButton,
                                  {
                                      backgroundColor: saved ? colors.accentSoft : colors.surfaceElevated,
                                      borderColor: saved ? colors.accent + '66' : colors.border,
                                  },
                              ]}
                          >
                              <Ionicons name={saved ? 'checkmark' : 'add'} size={18} color={saved ? colors.accent : colors.text}/>
                              <ThemedText style={[styles.saveLabel, {color: saved ? colors.accent : colors.text}]}>
                                  {saved ? 'Saved' : 'My List'}
                              </ThemedText>
                          </View>
                      </Pressable>
                  </View>

                  {details.genres.length > 0 ? (
                      <View style={styles.chipRow}>
                          {details.genres.map((g) => (
                              <View key={g} style={[styles.chip, {
                                  backgroundColor: colors.accentSoft,
                                  borderColor: colors.accent + '40'
                              }]}>
                                  <ThemedText style={[styles.chipText, {color: colors.accent}]}>{g}</ThemedText>
                              </View>
                          ))}
                      </View>
                  ) : null}

                  {description ? (
                      <Section title="Synopsis" colors={colors}>
                          <ThemedText style={[styles.paragraph, {color: colors.text + 'cc'}]}>{description}</ThemedText>
                      </Section>
                  ) : null}

                  {details.screenshotUrls.length > 0 ? (
                      <Section title="Screenshots" colors={colors} flush>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                                      contentContainerStyle={styles.hScroll}>
                              {details.screenshotUrls.map((uri, i) => (
                                  <Pressable
                                      key={i}
                                      onPress={() => setLightboxIndex(i)}
                                      accessibilityRole="button"
                                      accessibilityLabel={`View screenshot ${i + 1} full screen`}
                                      style={({pressed}) => ({opacity: pressed ? 0.85 : 1})}
                                  >
                                      <Image
                                          source={{uri}}
                                          style={[styles.screenshot, {backgroundColor: colors.surfaceElevated}]}
                                          contentFit="cover"
                                          transition={220}
                                          cachePolicy="memory-disk"
                                      />
                                  </Pressable>
                              ))}
                          </ScrollView>
                      </Section>
                  ) : null}

                  {details.cast.length > 0 ? (
                      <Section title="Cast" colors={colors} flush>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}
                                      contentContainerStyle={styles.hScroll}>
                              {details.cast.map((c, i) => (
                                  <CastCard key={i} cast={c} colors={colors}/>
                              ))}
                          </ScrollView>
                      </Section>
                  ) : null}

                  {details.torrents.length > 0 ? (
                      <Section title="Available Qualities" colors={colors}>
                          <View style={[styles.torrentGrid, {gap: TORRENT_GAP}]}>
                              {details.torrents.map((t, i) => (
                                  <TorrentRow key={i} torrent={t} colors={colors} width={torrentCardWidth}
                                              onPress={() => setNoticeTorrent(t)}/>
                              ))}
                          </View>
                      </Section>
                  ) : null}
              </View>

              {suggestions.length > 0 ? (
                  <View style={styles.moreLikeThis}>
                      <MovieRail
                          title="More like this"
                          movies={suggestions}
                          posterWidth={isPhone ? 118 : 132}
                          gutter={Spacing.lg}
                      />
                  </View>
              ) : null}
        </View>
      </ScrollView>
      {BackButton}
      {lightboxIndex != null ? (
          <ScreenshotLightbox
              images={details.screenshotUrls}
              initialIndex={lightboxIndex}
              onClose={() => setLightboxIndex(null)}
          />
      ) : null}
      <TorrentNoticeSheet torrent={noticeTorrent} onClose={() => setNoticeTorrent(null)}
                          bottomInset={insets.bottom}/>
    </ThemedView>
  );
}

type Colors = ReturnType<typeof usePalette>['colors'];

function Section({
  title,
  children,
                     colors,
  flush,
}: {
  title: string;
  children: React.ReactNode;
    colors: Colors;
  flush?: boolean;
}) {
  return (
    <View style={[styles.section, flush && styles.sectionFlush]}>
        <View style={[styles.sectionTitleRow, flush && {marginLeft: Spacing.lg}]}>
            <View style={[styles.sectionAccent, {backgroundColor: colors.accent}]}/>
            <ThemedText type="subtitle">{title}</ThemedText>
        </View>
      {children}
    </View>
  );
}

function CastCard({cast, colors}: { cast: CastMember; colors: Colors }) {
  return (
    <View style={styles.castCard}>
      {cast.imageUrl ? (
          <Image source={{uri: cast.imageUrl}} style={[styles.castImage, {backgroundColor: colors.surfaceElevated}]}
                 contentFit="cover" transition={220} cachePolicy="memory-disk"/>
      ) : (
          <View style={[styles.castImage, styles.castPlaceholder, {
              borderColor: colors.border,
              backgroundColor: colors.surface
          }]}>
              <Ionicons name="person" size={28} color={colors.textMuted}/>
        </View>
      )}
      <ThemedText numberOfLines={1} style={styles.castName}>
        {cast.name}
      </ThemedText>
      {cast.character ? (
          <ThemedText numberOfLines={1} style={[styles.castCharacter, {color: colors.textMuted}]}>
          {cast.character}
        </ThemedText>
      ) : null}
    </View>
  );
}

function TorrentRow({
  torrent,
                        colors,
                        width,
                        onPress,
}: {
  torrent: Torrent;
    colors: Colors;
    width: number;
    onPress: () => void;
}) {
    const source = [torrent.type, torrent.videoCodec].filter(Boolean).join(' · ') || 'Torrent';
  return (
      <Pressable
          onPress={onPress}
          accessibilityRole="button"
          style={({pressed}) => [
              styles.torrentCard,
              {width, backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.8 : 1},
          ]}
      >
          <View style={styles.torrentTop}>
              <View style={[styles.torrentQualityPill, {backgroundColor: colors.accent}]}>
                  <ThemedText
                      style={[styles.torrentQualityText, {color: colors.onAccent}]}>{torrent.quality}</ThemedText>
              </View>
              <ThemedText numberOfLines={1} style={styles.torrentType}>
                  {source}
        </ThemedText>
          </View>
          <View style={styles.torrentMetaRow}>
              <ThemedText numberOfLines={1} style={[styles.torrentMeta, {color: colors.textMuted}]}>
                  {torrent.size}
        </ThemedText>
              <View style={styles.seedPeer}>
                  <Ionicons name="arrow-up" size={11} color={colors.seed}/>
                  <ThemedText style={[styles.torrentMeta, {color: colors.seed}]}>{torrent.seeds}</ThemedText>
              </View>
              <View style={styles.seedPeer}>
                  <Ionicons name="arrow-down" size={11} color={colors.peer}/>
                  <ThemedText style={[styles.torrentMeta, {color: colors.peer}]}>{torrent.peers}</ThemedText>
              </View>
      </View>
    </Pressable>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
    column: {width: '100%', maxWidth: COLUMN_MAX, alignSelf: 'center'},
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { alignItems: 'center', paddingHorizontal: 40 },
    errorTitle: {marginTop: 16},
  errorMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
      borderRadius: Radius.pill,
    paddingHorizontal: 22,
      paddingVertical: 12,
    marginTop: 24,
  },
    retryLabel: {color: '#fff', fontSize: 15, fontWeight: '700'},
    backButton: {position: 'absolute', left: 12, zIndex: 10},
    backGlass: {
        width: 40,
        height: 40,
        borderRadius: 20,
        overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
  },

    hero: {width: '100%'},
  backdropWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
    heroFade: {position: 'absolute', left: 0, right: 0, bottom: 0, height: 90},
    playOverlay: {position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center'},
    playCircle: {
        width: 74,
        height: 74,
        borderRadius: 37,
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playIcon: {marginLeft: 4},
    trailerOverlay: {backgroundColor: '#000'},
    actionsRow: {flexDirection: 'row', alignItems: 'stretch', gap: 10, marginBottom: Spacing.lg},
    actionFlex: {flex: 1},
    playButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderRadius: Radius.pill,
        paddingVertical: 13,
    },
    saveButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        borderRadius: Radius.pill,
        paddingVertical: 13,
        paddingHorizontal: 20,
        borderWidth: StyleSheet.hairlineWidth,
    },
    saveLabel: {fontSize: 15, fontFamily: FontFamily.semibold},
    playLabel: {fontSize: 16, fontFamily: FontFamily.bold},
    moreLikeThis: {marginTop: Spacing.xxl},

    headerBlock: {flexDirection: 'row', gap: Spacing.lg, paddingHorizontal: Spacing.lg, marginTop: Spacing.md},
    poster: {
        width: 104,
        height: 156,
        borderRadius: Radius.md,
        borderWidth: StyleSheet.hairlineWidth,
        shadowColor: '#000',
        shadowOffset: {width: 0, height: 6},
        shadowOpacity: 0.3,
        shadowRadius: 12,
        elevation: 6,
  },
    titleBlock: {flex: 1, justifyContent: 'flex-end', paddingBottom: 4},
    title: {fontSize: 24, lineHeight: 29},
    subtitle: {marginTop: 4, fontSize: 13},
    metaRow: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, marginTop: 10},
    ratingPill: {
    flexDirection: 'row',
    alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: Radius.pill,
        borderWidth: StyleSheet.hairlineWidth,
    },
    ratingText: {fontSize: 13, fontWeight: '800'},
    metaText: {fontSize: 13, fontWeight: '500'},

    body: {paddingHorizontal: Spacing.lg, marginTop: Spacing.xl},
    chipRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 8},
    chip: {borderWidth: StyleSheet.hairlineWidth, borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6},
    chipText: {fontSize: 13, fontWeight: '600', textTransform: 'capitalize'},

    inlineStat: {flexDirection: 'row', alignItems: 'center', gap: 4},

    section: {marginTop: Spacing.xxl},
    sectionFlush: {marginHorizontal: -Spacing.lg},
    sectionTitleRow: {flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: Spacing.md},
    sectionAccent: {width: 4, height: 18, borderRadius: 2},
    paragraph: {fontSize: 15, lineHeight: 23},

    hScroll: {paddingHorizontal: Spacing.lg, gap: 12},
    screenshot: {width: 280, aspectRatio: 16 / 9, borderRadius: Radius.md},
    castCard: {width: 96, alignItems: 'center'},
    castImage: {width: 88, height: 88, borderRadius: 44},
    castPlaceholder: {borderWidth: StyleSheet.hairlineWidth, justifyContent: 'center', alignItems: 'center'},
    castName: {fontSize: 13, fontWeight: '700', marginTop: 8, textAlign: 'center'},
    castCharacter: {fontSize: 12, textAlign: 'center', marginTop: 1},

    torrentGrid: {flexDirection: 'row', flexWrap: 'wrap'},
    torrentCard: {
        borderWidth: StyleSheet.hairlineWidth,
        borderRadius: Radius.md,
    padding: 12,
        gap: 10,
  },
    torrentTop: {flexDirection: 'row', alignItems: 'center', gap: 10},
    torrentQualityPill: {
        borderRadius: Radius.sm,
        paddingHorizontal: 9,
        paddingVertical: 6,
        minWidth: 52,
        alignItems: 'center'
    },
    torrentQualityText: {color: '#fff', fontSize: 13, fontWeight: '800'},
    torrentType: {flex: 1, fontSize: 14, fontWeight: '700', textTransform: 'capitalize'},
    torrentMetaRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
    torrentMeta: {fontSize: 13, fontWeight: '600'},
    seedPeer: {flexDirection: 'row', alignItems: 'center', gap: 2},
});
