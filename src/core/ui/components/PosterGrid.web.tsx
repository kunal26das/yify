import type {Provider} from '@/core/domain/providers';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import type {ReactNode, Ref} from 'react';
import {useEffect, useRef} from 'react';
import type {FlatList, HostInstance, ScrollViewInstance} from 'react-native';
import {ScrollView, StyleSheet, View} from 'react-native';
import {webStyle} from '../layout/webStyle';
import {useTheme} from '../theme/useTheme';
import {Button} from './Button';
import {ErrorState} from './ErrorState';
import type {CardSurface} from './MediaCard';
import {MediaCard} from './MediaCard';
import {GRID_MAX_ITEMS, GRID_SKELETON_ROWS, itemKey, LOAD_MORE_ERROR, LOADING_LABEL} from './posterGridLayout';
import {Skeleton} from './Skeleton';
import {VisuallyHidden} from './VisuallyHidden';

export interface PosterGridProps {
  items: readonly MediaCardItem[];
  surface: CardSurface;
  status: 'loading' | 'ready' | 'error';
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onRetry: () => void;
  onOpen: (item: MediaCardItem) => void;
  header?: ReactNode;
  empty: ReactNode;
  watchedKeys?: ReadonlySet<string>;
  providerFor?: (item: MediaCardItem) => Provider | null;
  onQuickActions?: (item: MediaCardItem) => void;
  scrollRef?: Ref<FlatList<MediaCardItem>>;
}

export const LOAD_MORE_LABEL = 'Load more';
export const REFINE_LABEL = 'Refine your search to see more';

const GRID = webStyle({
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(100px, 13vw, 168px), 1fr))',
  gap: 'clamp(12px, 1.5vw, 16px)',
});
const GUTTER = webStyle({paddingLeft: 'clamp(16px, 2.5vw, 32px)', paddingRight: 'clamp(16px, 2.5vw, 32px)'});
const SENTINEL_MARGIN = '600px 0px';
const SKELETON_CELLS = GRID_SKELETON_ROWS * 6;

function useLoadMoreSentinel(enabled: boolean, onLoadMore: () => void) {
  const sentinel = useRef<HostInstance>(null);
  useEffect(() => {
    const node = sentinel.current as unknown as Element | null;
    if (!enabled || node === null || typeof IntersectionObserver === 'undefined') return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) onLoadMore();
    }, {rootMargin: SENTINEL_MARGIN});
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, onLoadMore]);
  return sentinel;
}

function SkeletonCells({count}: {count: number}) {
  const theme = useTheme();
  return Array.from({length: count}, (_, index) => (
    <View key={index} style={{gap: theme.space.sm}}>
      <Skeleton shape="rect" width="100%" aspectRatio={2 / 3}/>
      <Skeleton shape="text" width="100%" lines={2}/>
    </View>
  ));
}

export function PosterGrid({items, surface, status, hasMore, loadingMore, onLoadMore, onRetry, onOpen, header, empty, watchedKeys, providerFor, onQuickActions, scrollRef}: PosterGridProps) {
  const theme = useTheme();
  const visible = items.slice(0, GRID_MAX_ITEMS);
  const capped = items.length >= GRID_MAX_ITEMS && hasMore;
  const canLoad = hasMore && !capped && !loadingMore && status !== 'error';
  const sentinel = useLoadMoreSentinel(canLoad, onLoadMore);
  const initialLoad = items.length === 0 && status === 'loading';

  let body: ReactNode;
  if (initialLoad) {
    body = (
      <View aria-busy>
        <VisuallyHidden>{LOADING_LABEL}</VisuallyHidden>
        <View style={GRID}><SkeletonCells count={SKELETON_CELLS}/></View>
      </View>
    );
  } else if (items.length === 0) {
    body = status === 'error' ? <ErrorState onRetry={onRetry}/> : empty;
  } else {
    body = (
      <>
        <View role="list" style={GRID}>
          {visible.map((item) => (
            <View role="listitem" key={itemKey(item)}>
              <MediaCard
                item={item}
                width="100%"
                surface={surface}
                watched={watchedKeys?.has(itemKey(item)) ?? false}
                provider={providerFor?.(item) ?? null}
                onOpen={onOpen}
                onQuickActions={onQuickActions ? () => onQuickActions(item) : undefined}
              />
            </View>
          ))}
          {loadingMore ? <SkeletonCells count={6}/> : null}
        </View>
        {status === 'error' ? <ErrorState size="inline" title={LOAD_MORE_ERROR} onRetry={onRetry}/> : null}
        <View ref={sentinel} style={styles.sentinel}/>
        {hasMore || capped ? (
          <View style={{marginTop: theme.space.lg}}>
            <Button
              label={capped ? REFINE_LABEL : LOAD_MORE_LABEL}
              variant="outlined"
              fullWidth
              loading={loadingMore}
              disabled={capped}
              onPress={onLoadMore}
            />
          </View>
        ) : null}
      </>
    );
  }

  return (
    <ScrollView
      ref={scrollRef as unknown as Ref<ScrollViewInstance>}
      contentContainerStyle={[GUTTER, styles.content, {paddingBottom: theme.space.xl, maxWidth: theme.layout.maxContentWidth.grid + 64}]}
    >
      {header}
      {body}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {width: '100%', alignSelf: 'center'},
  sentinel: {height: 1},
});
