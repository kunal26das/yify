import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CastMember, Torrent } from '@/domain';
import { ThemedText } from '../components/themed-text';
import { ThemedView } from '../components/themed-view';
import { useThemeColor } from '../hooks/use-theme-color';
import { YoutubePlayer } from './components/YoutubePlayer';
import type { MovieDetailsViewModel } from './useMovieDetailsViewModel';

const ACCENT = '#0a84ff';
const H_PADDING = 16;

export function MovieDetailsScreen({ viewModel }: { viewModel: MovieDetailsViewModel }) {
  const { details, loading, error, reload } = viewModel;
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const textColor = useThemeColor({}, 'text');
  const mutedColor = textColor + '99';

  const BackButton = (
    <Pressable
      onPress={() => router.back()}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Go back"
      style={[styles.backButton, { top: insets.top + 8 }]}
    >
      <Ionicons name="chevron-back" size={24} color="#fff" />
    </Pressable>
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        {BackButton}
        <ActivityIndicator size="large" color={ACCENT} />
      </ThemedView>
    );
  }

  if (error || !details) {
    return (
      <ThemedView style={styles.centered}>
        {BackButton}
        <View style={styles.errorBox}>
          <Ionicons name="cloud-offline-outline" size={56} color={mutedColor} />
          <ThemedText style={styles.errorTitle}>Couldn&apos;t load this movie</ThemedText>
          <ThemedText style={[styles.errorMessage, { color: mutedColor }]}>
            {error ?? 'Movie not found'}
          </ThemedText>
          <Pressable
            onPress={reload}
            accessibilityRole="button"
            style={({ pressed }) => [styles.retryButton, { opacity: pressed ? 0.85 : 1 }]}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <ThemedText style={styles.retryLabel}>Try again</ThemedText>
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

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Top: trailer player, falling back to the backdrop image */}
        {details.ytTrailerCode ? (
          <YoutubePlayer videoId={details.ytTrailerCode} width={width} />
        ) : details.backgroundImageUrl ? (
          <View style={styles.backdropWrap}>
            <Image
              source={{ uri: details.backgroundImageUrl }}
              style={styles.backdrop}
              contentFit="cover"
              cachePolicy="memory-disk"
            />
            <View style={styles.backdropScrim} />
          </View>
        ) : null}

        <View style={styles.body}>
          <ThemedText type="title" style={styles.title}>
            {details.title}
          </ThemedText>
          {details.titleLong && details.titleLong !== details.title ? (
            <ThemedText style={[styles.subtitle, { color: mutedColor }]}>
              {details.titleLong}
            </ThemedText>
          ) : null}

          <View style={styles.metaRow}>
            {details.rating ? (
              <View style={styles.ratingPill}>
                <Ionicons name="star" size={13} color="#f5c518" />
                <ThemedText style={styles.ratingText}>{details.rating.toFixed(1)}</ThemedText>
              </View>
            ) : null}
            {meta.map((m, i) => (
              <ThemedText key={i} style={[styles.metaText, { color: mutedColor }]}>
                {m}
              </ThemedText>
            ))}
          </View>

          {details.genres.length > 0 ? (
            <View style={styles.chipRow}>
              {details.genres.map((g) => (
                <View key={g} style={[styles.chip, { borderColor: textColor + '22' }]}>
                  <ThemedText style={styles.chipText}>{g}</ThemedText>
                </View>
              ))}
            </View>
          ) : null}

          {(details.likeCount != null || details.downloadCount != null) ? (
            <View style={styles.statsRow}>
              {details.likeCount != null ? (
                <Stat icon="heart" label={formatCount(details.likeCount)} color={mutedColor} />
              ) : null}
              {details.downloadCount != null ? (
                <Stat
                  icon="download"
                  label={formatCount(details.downloadCount)}
                  color={mutedColor}
                />
              ) : null}
            </View>
          ) : null}

          {/* Synopsis */}
          {description ? (
            <Section title="Synopsis" textColor={textColor}>
              <ThemedText style={[styles.paragraph, { color: textColor + 'cc' }]}>
                {description}
              </ThemedText>
            </Section>
          ) : null}

          {/* Screenshots */}
          {details.screenshotUrls.length > 0 ? (
            <Section title="Screenshots" textColor={textColor} flush>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {details.screenshotUrls.map((uri, i) => (
                  <Image
                    key={i}
                    source={{ uri }}
                    style={styles.screenshot}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                  />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Cast */}
          {details.cast.length > 0 ? (
            <Section title="Cast" textColor={textColor} flush>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.hScroll}
              >
                {details.cast.map((c, i) => (
                  <CastCard key={i} cast={c} textColor={textColor} mutedColor={mutedColor} />
                ))}
              </ScrollView>
            </Section>
          ) : null}

          {/* Torrents */}
          {details.torrents.length > 0 ? (
            <Section title="Available In" textColor={textColor}>
              {details.torrents.map((t, i) => (
                <TorrentRow key={i} torrent={t} textColor={textColor} mutedColor={mutedColor} />
              ))}
            </Section>
          ) : null}
        </View>
      </ScrollView>
      {BackButton}
    </ThemedView>
  );
}

function Section({
  title,
  children,
  textColor,
  flush,
}: {
  title: string;
  children: React.ReactNode;
  textColor: string;
  flush?: boolean;
}) {
  return (
    <View style={[styles.section, flush && styles.sectionFlush]}>
      <ThemedText style={[styles.sectionTitle, flush && { marginLeft: H_PADDING }]}>
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function Stat({ icon, label, color }: { icon: 'heart' | 'download'; label: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={14} color={color} />
      <ThemedText style={[styles.statText, { color }]}>{label}</ThemedText>
    </View>
  );
}

function CastCard({
  cast,
  textColor,
  mutedColor,
}: {
  cast: CastMember;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={styles.castCard}>
      {cast.imageUrl ? (
        <Image source={{ uri: cast.imageUrl }} style={styles.castImage} contentFit="cover" />
      ) : (
        <View style={[styles.castImage, styles.castPlaceholder, { borderColor: textColor + '22' }]}>
          <Ionicons name="person" size={28} color={mutedColor} />
        </View>
      )}
      <ThemedText numberOfLines={1} style={styles.castName}>
        {cast.name}
      </ThemedText>
      {cast.character ? (
        <ThemedText numberOfLines={1} style={[styles.castCharacter, { color: mutedColor }]}>
          {cast.character}
        </ThemedText>
      ) : null}
    </View>
  );
}

function TorrentRow({
  torrent,
  textColor,
  mutedColor,
}: {
  torrent: Torrent;
  textColor: string;
  mutedColor: string;
}) {
  return (
    <View style={[styles.torrentRow, { borderColor: textColor + '14' }]}>
      <View style={styles.torrentQualityPill}>
        <ThemedText style={styles.torrentQualityText}>{torrent.quality}</ThemedText>
      </View>
      <View style={styles.torrentInfo}>
        <ThemedText style={styles.torrentType}>
          {[torrent.type, torrent.videoCodec].filter(Boolean).join(' · ')}
        </ThemedText>
        <ThemedText style={[styles.torrentMeta, { color: mutedColor }]}>
          {torrent.size} · ▲ {torrent.seeds} · ▼ {torrent.peers}
        </ThemedText>
      </View>
    </View>
  );
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBox: { alignItems: 'center', paddingHorizontal: 40 },
  errorTitle: { fontSize: 18, fontWeight: '700', marginTop: 16 },
  errorMessage: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: ACCENT,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: 24,
  },
  retryLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  backButton: {
    position: 'absolute',
    left: 12,
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  backdropWrap: { width: '100%', aspectRatio: 16 / 9, backgroundColor: '#000' },
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  backdropScrim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  body: { paddingHorizontal: H_PADDING },
  title: { marginTop: 16, fontSize: 24, lineHeight: 30 },
  subtitle: { marginTop: 2, fontSize: 14 },
  metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  ratingPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 14, fontWeight: '700' },
  metaText: { fontSize: 14 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 5 },
  chipText: { fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 20, marginTop: 14 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statText: { fontSize: 14 },
  section: { marginTop: 24 },
  sectionFlush: { marginHorizontal: -H_PADDING },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  paragraph: { fontSize: 15, lineHeight: 22 },
  hScroll: { paddingHorizontal: H_PADDING, gap: 12 },
  screenshot: { width: 260, aspectRatio: 16 / 9, borderRadius: 10, backgroundColor: '#000' },
  castCard: { width: 92 },
  castImage: { width: 92, height: 92, borderRadius: 46, backgroundColor: '#000' },
  castPlaceholder: { borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  castName: { fontSize: 13, fontWeight: '600', marginTop: 6, textAlign: 'center' },
  castCharacter: { fontSize: 12, textAlign: 'center' },
  torrentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  torrentQualityPill: {
    backgroundColor: ACCENT,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  torrentQualityText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  torrentInfo: { flex: 1 },
  torrentType: { fontSize: 14, fontWeight: '600', textTransform: 'capitalize' },
  torrentMeta: { fontSize: 13, marginTop: 2 },
});
