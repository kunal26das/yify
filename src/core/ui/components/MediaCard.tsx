import {APP_NAME} from '@/core/config/app';
import {parseTitleKey} from '@/core/domain/keys';
import type {MediaType} from '@/core/domain/keys';
import type {Provider} from '@/core/domain/providers';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import {mediaHref} from '@/core/navigation/hrefs';
import type {AccessibilityActionEvent} from 'react-native';
import {StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {formatRating} from '../format';
import {useTheme} from '../theme/useTheme';
import {Artwork} from './Artwork';
import {Icon} from './Icon';
import {IconButton} from './IconButton';
import {ProviderLogo} from './ProviderLogo';
import {MIN_RATING_VOTES} from './RatingBadge';
import {Text} from './Text';
import {Touchable} from './Touchable';

export type {MediaCardItem};

export type CardSurface = 'home' | 'search' | 'library' | 'person' | 'similar' | 'other';

export interface MediaCardProps {
  item: MediaCardItem;
  variant?: 'poster' | 'ranked' | 'row';
  rank?: number;
  width: number | string;
  surface: CardSurface;
  watched?: boolean;
  provider?: Provider | null;
  onOpen: (item: MediaCardItem) => void;
  onQuickActions?: () => void;
  showType?: boolean;
  inWatchlist?: boolean;
  onToggleWatchlist?: () => void;
  onMarkWatched?: () => void;
}

export interface MediaCardFacts {
  title: string;
  year: number | null;
  type: MediaType | null;
  rating: number | null;
  posterPath: string | null;
  legacy: boolean;
}

export const LEGACY_META = `Saved in an older version of ${APP_NAME}`;

const TYPE_LABEL: Readonly<Record<MediaType, {short: string; long: string}>> = {
  movie: {short: 'Movie', long: 'Movie'},
  tv: {short: 'TV', long: 'TV show'},
};

const ROW_POSTER = {width: 56, height: 84};
const WATCHED_BADGE = 28;
const PROVIDER_RING = 1;

export function mediaCardFacts(item: MediaCardItem): MediaCardFacts {
  if (item.kind === 'title') {
    const {title, year, type, rating, voteCount, posterPath} = item.title;
    return {title, year, type, rating: rating !== null && voteCount >= MIN_RATING_VOTES ? rating : null, posterPath, legacy: false};
  }
  const parsed = parseTitleKey(item.key);
  return {
    title: item.snapshot.title,
    year: item.snapshot.year,
    type: parsed?.type ?? null,
    rating: null,
    posterPath: parsed === null ? null : item.snapshot.posterPath,
    legacy: parsed === null,
  };
}

export function mediaCardName(facts: MediaCardFacts, extras: {watched?: boolean; provider?: Provider | null} = {}): string {
  if (facts.legacy) return `${facts.title}, ${LEGACY_META}`;
  const parts = [facts.title];
  if (facts.year !== null) parts.push(String(facts.year));
  if (facts.type !== null) parts.push(TYPE_LABEL[facts.type].long);
  if (facts.rating !== null) parts.push(`rated ${formatRating(facts.rating)} out of 10`);
  if (extras.watched) parts.push('watched');
  if (extras.provider) parts.push(`on ${extras.provider.name}`);
  return parts.join(', ');
}

function MetaLine({facts, showType, variant}: {facts: MediaCardFacts; showType: boolean; variant: 'bodySmall' | 'bodyMedium'}) {
  const theme = useTheme();
  if (facts.legacy) return <Text variant={variant} color="onSurfaceVariant" numberOfLines={2}>{LEGACY_META}</Text>;
  const year = facts.year === null ? null : String(facts.year);
  const type = showType && facts.type !== null ? TYPE_LABEL[facts.type].short : null;
  return (
    <View style={[styles.meta, {columnGap: theme.space.xs}]}>
      {year ? <Text variant={variant} color="onSurfaceVariant">{year}</Text> : null}
      {facts.rating !== null ? (
        <>
          {year ? <Text variant={variant} color="onSurfaceVariant">·</Text> : null}
          <Icon name="star" size={18} filled color="ratingStar"/>
          <Text variant={variant} color="onSurfaceVariant">{formatRating(facts.rating)}</Text>
        </>
      ) : null}
      {type ? <Text variant={variant} color="onSurfaceVariant">{year || facts.rating !== null ? `· ${type}` : type}</Text> : null}
    </View>
  );
}

export function MediaCard({
  item,
  variant = 'poster',
  rank,
  width,
  surface,
  watched = false,
  provider = null,
  onOpen,
  onQuickActions,
  showType = false,
  inWatchlist,
  onToggleWatchlist,
  onMarkWatched,
}: MediaCardProps) {
  const theme = useTheme();
  const facts = mediaCardFacts(item);
  const name = mediaCardName(facts, {watched, provider});
  const row = variant === 'row';
  const webMore = IS_WEB && onQuickActions !== undefined;
  const actions = [
    ...(onToggleWatchlist ? [{name: 'toggleWatchlist', label: inWatchlist ? 'Remove from watchlist' : 'Add to watchlist'}] : []),
    ...(onMarkWatched ? [{name: 'markWatched', label: 'Mark watched'}] : []),
    ...(onQuickActions ? [{name: 'moreActions', label: 'More actions'}] : []),
  ];
  const onAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'toggleWatchlist') onToggleWatchlist?.();
    if (event.nativeEvent.actionName === 'markWatched') onMarkWatched?.();
    if (event.nativeEvent.actionName === 'moreActions') onQuickActions?.();
  };

  const badges = facts.legacy ? null : (
    <>
      {watched ? (
        <View style={[styles.watched, {width: WATCHED_BADGE, height: WATCHED_BADGE, borderRadius: theme.shape.full, backgroundColor: theme.colors.secondaryContainer, top: theme.space.xs, right: theme.space.xs}]}>
          <Icon name="check_circle" size={18} filled color="onSecondaryContainer"/>
        </View>
      ) : null}
      {provider && !row ? (
        <View style={[styles.provider, {left: theme.space.xs, bottom: theme.space.xs, padding: PROVIDER_RING, borderRadius: theme.shape.extraSmall + PROVIDER_RING, backgroundColor: theme.colors.surface}]}>
          <ProviderLogo provider={provider} size={24} decorative/>
        </View>
      ) : null}
    </>
  );

  const artwork = row ? (
    <View style={{width: ROW_POSTER.width}}>
      <Artwork kind="poster" path={facts.posterPath} size="w154" width={ROW_POSTER.width} alt="" decorative/>
      {badges}
    </View>
  ) : (
    <View>
      <Artwork kind="poster" path={facts.posterPath} size="w342" width="100%" alt="" decorative fallbackLabel={facts.title} priority={rank !== undefined && rank <= 3 ? 'high' : 'normal'}/>
      {badges}
    </View>
  );

  const titleText = (
    <Text variant={row ? 'titleMedium' : 'titleSmall'} numberOfLines={2}>{facts.title}</Text>
  );
  const caption = (
    <View style={[styles.caption, {gap: theme.space.sm, paddingRight: webMore && !row ? theme.layout.minTouchTarget - theme.space.sm : 0}]}>
      {variant === 'ranked' && rank !== undefined ? (
        <Text variant="titleLarge" color="onSurfaceVariant" aria-hidden>{String(rank)}</Text>
      ) : null}
      <View style={styles.grow}>
        {titleText}
        <MetaLine facts={facts} showType={showType} variant={row ? 'bodyMedium' : 'bodySmall'}/>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, {width: width as number}]} dataSet={{surface}}>
      <Touchable
        href={mediaHref(item)}
        onPress={() => onOpen(item)}
        onLongPress={onQuickActions}
        aria-label={name}
        accessibilityActions={actions.length > 0 ? actions : undefined}
        onAccessibilityAction={actions.length > 0 ? onAccessibilityAction : undefined}
        shape="medium"
        style={row
          ? [styles.row, {gap: theme.space.lg, paddingVertical: theme.space.sm, paddingRight: webMore ? theme.layout.minTouchTarget : 0}]
          : [styles.column, {gap: theme.space.sm}]}
      >
        {artwork}
        {caption}
      </Touchable>
      {webMore ? (
        <View style={row ? styles.moreRow : styles.moreCard}>
          <IconButton icon="more_vert" label={`More actions for ${facts.title}`} onPress={onQuickActions}/>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {position: 'relative'},
  column: {flexDirection: 'column'},
  row: {flexDirection: 'row', alignItems: 'center'},
  caption: {flexDirection: 'row', alignItems: 'flex-start'},
  grow: {flex: 1, minWidth: 0},
  meta: {flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap'},
  watched: {position: 'absolute', alignItems: 'center', justifyContent: 'center'},
  provider: {position: 'absolute'},
  moreCard: {position: 'absolute', right: -8, bottom: -4},
  moreRow: {position: 'absolute', right: 0, top: 0, bottom: 0, justifyContent: 'center'},
});
