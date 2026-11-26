import {personKey} from '@/core/domain/keys';
import type {Provider} from '@/core/domain/providers';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import {personHref} from '@/core/navigation/hrefs';
import {useId, useRef, useState} from 'react';
import type {FlatListProps, LayoutChangeEvent, NativeScrollEvent, NativeSyntheticEvent, ViewStyle} from 'react-native';
import {FlatList, StyleSheet, View} from 'react-native';
import {IS_WEB} from '../environment';
import {useImageHostMode} from '../imageHost';
import {imageUrl} from '../images';
import {useWindowClass} from '../layout/useWindowClass';
import {WEB_GUTTER, webStyle} from '../layout/webStyle';
import {useTheme} from '../theme/useTheme';
import {Artwork} from './Artwork';
import {Avatar} from './Avatar';
import {ErrorState} from './ErrorState';
import {IconButton} from './IconButton';
import type {CardSurface} from './MediaCard';
import {MediaCard} from './MediaCard';
import {itemKey} from './posterGridLayout';
import {SectionHeader} from './SectionHeader';
import {Skeleton} from './Skeleton';
import {Text} from './Text';
import {Touchable} from './Touchable';
import {VisuallyHidden} from './VisuallyHidden';

export type RailPersonItem = {kind: 'person'; personId: number; slug: string; name: string; role: string; profilePath: string | null};
export type RailStillItem = {kind: 'still'; path: string; index: number};
export type RailItem =
  | {kind: 'media'; media: MediaCardItem; watched?: boolean; provider?: Provider | null}
  | RailPersonItem
  | RailStillItem;

export interface RailProps {
  title: string;
  subtitle?: string;
  variant?: 'poster' | 'ranked' | 'still' | 'person';
  items: readonly RailItem[];
  status: 'loading' | 'ready' | 'error';
  onRetry?: () => void;
  seeAll?: {href: string};
  surface: CardSurface;
  onOpen?: (item: MediaCardItem) => void;
  emptyText?: string;
  onOpenPerson?: (item: RailPersonItem) => void;
  onOpenStill?: (index: number) => void;
}

export const SEE_ALL_LABEL = 'See all';
export const RAIL_SKELETONS = 6;
export const SCROLL_STEP = 0.8;

const WEB_CARD_WIDTH = 'clamp(112px, 12vw, 168px)';
const PERSON = {width: 96, avatar: 72} as const;
const STILL = {width: 240, height: 135} as const;

export function railGutter(gutter: number, endInset = 0): ViewStyle {
  if (!IS_WEB) return {paddingLeft: gutter, paddingRight: gutter - endInset};
  return webStyle({paddingLeft: WEB_GUTTER, paddingRight: endInset > 0 ? `calc(${WEB_GUTTER} - ${endInset}px)` : WEB_GUTTER});
}

export function railItemKey(item: RailItem): string {
  if (item.kind === 'media') return itemKey(item.media);
  if (item.kind === 'person') return `person:${item.personId}:${item.role}`;
  return `still:${item.index}`;
}

function PersonCard({item, onOpen}: {item: RailPersonItem; onOpen?: (item: RailPersonItem) => void}) {
  const theme = useTheme();
  const mode = useImageHostMode();
  return (
    <Touchable
      href={personHref(personKey(item.personId), item.slug)}
      onPress={onOpen ? () => onOpen(item) : undefined}
      aria-label={item.role ? `${item.name}, ${item.role}` : item.name}
      shape="medium"
      style={[styles.person, {width: PERSON.width, gap: theme.space.xs, paddingVertical: theme.space.xs}]}
    >
      <Avatar name={item.name} photoUrl={imageUrl(item.profilePath, 'w185', mode)} size={PERSON.avatar} decorative/>
      <Text variant="titleSmall" align="center" numberOfLines={2}>{item.name}</Text>
      {item.role ? <Text variant="bodySmall" color="onSurfaceVariant" align="center" numberOfLines={2}>{item.role}</Text> : null}
    </Touchable>
  );
}

function StillCard({item, total, onOpen}: {item: RailStillItem; total: number; onOpen?: (index: number) => void}) {
  return (
    <Touchable
      onPress={onOpen ? () => onOpen(item.index) : undefined}
      disabled={onOpen === undefined}
      aria-label={`Open image ${item.index + 1} of ${total}`}
      shape="medium"
      style={{width: STILL.width}}
    >
      <Artwork kind="still" path={item.path} size="w300" width={STILL.width} alt="" decorative/>
    </Touchable>
  );
}

export function Rail({title, subtitle, variant = 'poster', items, status, onRetry, seeAll, surface, onOpen, emptyText, onOpenPerson, onOpenStill}: RailProps) {
  const theme = useTheme();
  const windowClass = useWindowClass() ?? 'compact';
  const headerId = useId();
  const list = useRef<FlatList<RailItem>>(null);
  const [offset, setOffset] = useState(0);
  const [viewport, setViewport] = useState(0);
  const cardWidth: number | string = IS_WEB ? WEB_CARD_WIDTH : theme.layout.railPosterWidth[windowClass];
  const gutter = railGutter(theme.layout.gutter[windowClass]);

  if (status === 'ready' && items.length === 0 && emptyText === undefined) return null;

  const scrollBy = (direction: 1 | -1) => {
    const next = Math.max(0, offset + direction * viewport * SCROLL_STEP);
    list.current?.scrollToOffset({offset: next, animated: true});
  };
  const scrollable = IS_WEB && windowClass === 'expanded' && status === 'ready' && items.length > 0;
  const arrows = scrollable ? (
    <View style={[styles.arrows, {gap: theme.space.xs}]}>
      <IconButton icon="chevron_left" label={`Scroll ${title} back`} onPress={() => scrollBy(-1)} disabled={offset <= 0}/>
      <IconButton icon="chevron_right" label={`Scroll ${title} forward`} onPress={() => scrollBy(1)}/>
    </View>
  ) : null;

  const renderItem: FlatListProps<RailItem>['renderItem'] = ({item, index}) => (
    <View role="listitem">
      {item.kind === 'media' ? (
        <MediaCard
          item={item.media}
          variant={variant === 'ranked' ? 'ranked' : 'poster'}
          rank={variant === 'ranked' ? index + 1 : undefined}
          width={cardWidth}
          surface={surface}
          watched={item.watched}
          provider={item.provider ?? null}
          onOpen={(media) => onOpen?.(media)}
        />
      ) : item.kind === 'person' ? (
        <PersonCard item={item} onOpen={onOpenPerson}/>
      ) : (
        <StillCard item={item} total={items.length} onOpen={onOpenStill}/>
      )}
    </View>
  );

  let content;
  if (status === 'loading' && items.length === 0) {
    content = (
      <View aria-busy style={[styles.row, {gap: theme.space.md}, gutter]}>
        <VisuallyHidden>{`Loading ${title}`}</VisuallyHidden>
        {Array.from({length: RAIL_SKELETONS}, (_, index) => (
          <View key={index} style={{width: variant === 'still' ? STILL.width : variant === 'person' ? PERSON.width : (cardWidth as number), gap: theme.space.sm}}>
            <Skeleton shape={variant === 'person' ? 'circle' : 'rect'} width={variant === 'person' ? PERSON.avatar : '100%'} aspectRatio={variant === 'still' ? 16 / 9 : variant === 'person' ? undefined : 2 / 3}/>
            <Skeleton shape="text" width="100%" lines={2}/>
          </View>
        ))}
      </View>
    );
  } else if (status === 'error' && items.length === 0) {
    content = (
      <View style={gutter}>
        <ErrorState size="inline" title={`Couldn't load ${title}.`} onRetry={onRetry ?? (() => undefined)}/>
      </View>
    );
  } else if (items.length === 0) {
    content = (
      <View style={gutter}>
        <Text variant="bodyMedium" color="onSurfaceVariant">{emptyText}</Text>
      </View>
    );
  } else {
    content = (
      <FlatList
        ref={list}
        horizontal
        data={items}
        keyExtractor={railItemKey}
        renderItem={renderItem}
        role="list"
        showsHorizontalScrollIndicator={false}
        initialNumToRender={6}
        windowSize={5}
        contentContainerStyle={[{gap: theme.space.md}, gutter]}
        onLayout={scrollable ? (event: LayoutChangeEvent) => setViewport(event.nativeEvent.layout.width) : undefined}
        onScroll={scrollable ? (event: NativeSyntheticEvent<NativeScrollEvent>) => setOffset(event.nativeEvent.contentOffset.x) : undefined}
        scrollEventThrottle={scrollable ? 64 : undefined}
      />
    );
  }

  return (
    <View role="region" aria-labelledby={headerId} style={[styles.region, {gap: theme.space.sm}]}>
      <View style={railGutter(theme.layout.gutter[windowClass], seeAll || arrows ? theme.space.sm : 0)}>
        <SectionHeader
          title={title}
          subtitle={subtitle}
          nativeID={headerId}
          action={seeAll ? {label: SEE_ALL_LABEL, accessibilityLabel: `${SEE_ALL_LABEL} ${title}`, href: seeAll.href} : undefined}
          trailing={arrows}
        />
      </View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  region: {alignSelf: 'stretch'},
  row: {flexDirection: 'row'},
  arrows: {flexDirection: 'row'},
  person: {alignItems: 'center'},
});
