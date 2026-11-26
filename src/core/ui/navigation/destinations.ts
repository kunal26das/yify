import type {IconName} from '@/core/ui/icons/glyphs';

export interface Destination {
  route: '(home)' | '(search)' | '(library)' | '(you)';
  href: '/' | '/search' | '/library' | '/you';
  label: 'Home' | 'Search' | 'Library' | 'You';
  icon: IconName;
}

export const DESTINATIONS: readonly Destination[] = [
  {route: '(home)', href: '/', label: 'Home', icon: 'home'},
  {route: '(search)', href: '/search', label: 'Search', icon: 'search'},
  {route: '(library)', href: '/library', label: 'Library', icon: 'video_library'},
  {route: '(you)', href: '/you', label: 'You', icon: 'account_circle'},
];

export function destinationForSegments(segments: readonly string[]): Destination {
  return DESTINATIONS.find((destination) => segments.includes(destination.route)) ?? DESTINATIONS[0];
}

export function destinationForRoute(routeName: string): Destination | null {
  return DESTINATIONS.find((destination) => destination.route === routeName) ?? null;
}
