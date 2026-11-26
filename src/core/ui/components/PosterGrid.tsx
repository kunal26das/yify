import type {Provider} from '@/core/domain/providers';
import type {MediaCardItem} from '@/core/navigation/hrefs';
import type {ReactElement, ReactNode, Ref} from 'react';
import {FlatList, StyleSheet, useWindowDimensions, View} from 'react-native';
import {useWindowClass} from '../layout/useWindowClass';
import {useTheme} from '../theme/useTheme';
import {ErrorState} from './ErrorState';
import type {CardSurface} from './MediaCard';
import {MediaCard} from './MediaCard';
import {GRID_SKELETON_ROWS, gridColumns, gridContentWidth, gridItemWidth, itemKey, LOAD_MORE_ERROR, LOADING_LABEL} from './posterGridLayout';
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

function SkeletonRows({columns, width, rows}: {columns: number; width: number; rows: number}) {
  const theme = useTheme();
  return (
    <View style={[styles.skeletons, {gap: theme.space.md}]}>
      {Array.from({length: rows * columns}, (_, index) => (
        <View key={index} style={{width, gap: theme.space.sm}}>
          <Skeleton shape="rect" width={width} height={Math.round(width * 1.5)}/>
          <Skeleton shape="text" width={width} lines={2}/>
        </View>
      ))}
    </View>
  );
}

export function PosterGrid({items, surface, status, hasMore, loadingMore, onLoadMore, onRetry, onOpen, header, empty, watchedKeys, providerFor, onQuickActions, scrollRef}: PosterGridProps) {
  const theme = useTheme();
  const viewport = useWindowDimensions();
  const windowClass = useWindowClass() ?? 'compact';
  const contentWidth = gridContentWidth(viewport.width, windowClass);
  const columns = gridColumns(contentWidth, windowClass);
  const width = gridItemWidth(contentWidth, columns, windowClass);
  const gap = theme.layout.gridGap[windowClass];
  const gutter = theme.layout.gutter[windowClass];
  const initialLoad = items.length === 0 && status === 'loading';

  const footer: ReactElement | undefined = loadingMore ? (
    <View style={{marginTop: gap}}><SkeletonRows columns={columns} width={width} rows={1}/></View>
  ) : status === 'error' && items.length > 0 ? (
    <ErrorState size="inline" title={LOAD_MORE_ERROR} onRetry={onRetry}/>
  ) : undefined;

  const placeholder: ReactElement = initialLoad ? (
    <View aria-busy style={{gap}}>
      <VisuallyHidden>{LOADING_LABEL}</VisuallyHidden>
      <SkeletonRows columns={columns} width={width} rows={GRID_SKELETON_ROWS * 2}/>
    </View>
  ) : status === 'error' ? (
    <ErrorState onRetry={onRetry}/>
  ) : (
    <View>{empty}</View>
  );

  return (
    <FlatList
      key={columns}
      ref={scrollRef}
      data={items}
      numColumns={columns}
      keyExtractor={itemKey}
      initialNumToRender={columns * 4}
      onEndReachedThreshold={0.6}
      onEndReached={() => {
        if (hasMore && !loadingMore && status !== 'error') onLoadMore();
      }}
      ListHeaderComponent={header ? <View>{header}</View> : undefined}
      ListEmptyComponent={placeholder}
      ListFooterComponent={footer}
      columnWrapperStyle={columns > 1 ? {gap} : undefined}
      contentContainerStyle={{paddingHorizontal: gutter, paddingBottom: theme.space.xl, rowGap: gap, alignSelf: 'center', width: contentWidth + gutter * 2}}
      role="list"
      renderItem={({item}) => (
        <View role="listitem" style={{width}}>
          <MediaCard
            item={item}
            width={width}
            surface={surface}
            watched={watchedKeys?.has(itemKey(item)) ?? false}
            provider={providerFor?.(item) ?? null}
            onOpen={onOpen}
            onQuickActions={onQuickActions ? () => onQuickActions(item) : undefined}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  skeletons: {flexDirection: 'row', flexWrap: 'wrap'},
});
