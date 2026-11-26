import type {MediaCardItem} from '@/core/navigation/hrefs';
import type {WindowClass} from '../layout/windowClass';
import {layout} from '../theme/tokens';

export const GRID_MAX_ITEMS = 400;
export const GRID_SKELETON_ROWS = 4;
export const LOAD_MORE_ERROR = "Couldn't load more titles.";
export const LOADING_LABEL = 'Loading titles';

export function itemKey(item: MediaCardItem): string {
  return item.kind === 'title' ? item.title.key : item.key;
}

export function gridColumns(contentWidth: number, windowClass: WindowClass): number {
  const gap = layout.gridGap[windowClass];
  const fitted = Math.floor((contentWidth + gap) / (layout.posterMinWidth[windowClass] + gap));
  return Math.max(3, fitted);
}

export function gridItemWidth(contentWidth: number, columns: number, windowClass: WindowClass): number {
  const gap = layout.gridGap[windowClass];
  return Math.floor((contentWidth - gap * (columns - 1)) / columns);
}

export function gridContentWidth(windowWidth: number, windowClass: WindowClass): number {
  const chrome = windowClass === 'compact' ? 0 : layout.navigationRailWidth;
  const available = windowWidth - chrome - layout.gutter[windowClass] * 2;
  return Math.max(0, Math.min(available, layout.maxContentWidth.grid));
}
