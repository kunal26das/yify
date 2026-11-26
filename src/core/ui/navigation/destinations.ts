export interface Destination {
  route: '(home)' | '(search)' | '(library)' | '(you)';
  href: '/' | '/search' | '/library' | '/you';
  label: 'Home' | 'Search' | 'Library' | 'You';
}

export const DESTINATIONS: readonly Destination[] = [
  {route: '(home)', href: '/', label: 'Home'},
  {route: '(search)', href: '/search', label: 'Search'},
  {route: '(library)', href: '/library', label: 'Library'},
  {route: '(you)', href: '/you', label: 'You'},
];
