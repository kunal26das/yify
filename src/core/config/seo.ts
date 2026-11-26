import type {MediaType} from '@/core/domain/keys';
import {APP_NAME, PLUS_NAME, SITE_ORIGIN} from './app';

export type StaticPage =
  | 'home' | 'search' | 'watchlist' | 'watched' | 'lists' | 'recent' | 'list' | 'you' | 'plus'
  | 'settings' | 'appearance' | 'streaming' | 'privacy' | 'account' | 'about';

export interface PageMetadata {
  title: string;
  description?: string;
  robots?: {index: boolean; follow: boolean};
  alternates?: {canonical: string};
  openGraph?: {
    title?: string;
    description?: string;
    url?: string;
    siteName?: string;
    type?: string;
    images?: {url: string}[];
  };
  twitter?: {
    card?: 'summary' | 'summary_large_image';
    title?: string;
    description?: string;
    images?: string[];
  };
}

export interface TitleDocumentInput {
  type: MediaType;
  title: string;
  year: number | null;
}

export const INDEXABLE_HOST = SITE_ORIGIN.replace(/^https:\/\//, '');
export const OG_IMAGE_URL = `${SITE_ORIGIN}/og-card.png`;
export const HOME_TITLE = `${APP_NAME} — find where to watch movies and TV`;
export const HOME_DESCRIPTION = 'Watch trailers, see where movies and TV shows are streaming in your country, and keep a watch diary.';

export const STATIC_PAGE_NAMES: Readonly<Record<Exclude<StaticPage, 'home'>, string>> = {
  search: 'Search',
  watchlist: 'Watchlist',
  watched: 'Watched',
  lists: 'Lists',
  recent: 'Recently viewed',
  list: 'List',
  you: 'You',
  plus: PLUS_NAME,
  settings: 'Settings',
  appearance: 'Appearance',
  streaming: 'Region and services',
  privacy: 'Privacy',
  account: 'Account',
  about: 'About',
};

export function pageTitle(name: string): string {
  return `${name} | ${APP_NAME}`;
}

export function titleDocumentTitle(input: TitleDocumentInput): string {
  if (input.type === 'tv') {
    const series = input.year === null ? 'TV series' : `TV series ${input.year}`;
    return pageTitle(`${input.title} (${series}) — trailer & where to watch`);
  }
  const year = input.year === null ? '' : ` (${input.year})`;
  return pageTitle(`${input.title}${year} — trailer, cast & where to watch`);
}

export function personDocumentTitle(name: string): string {
  return pageTitle(`${name} — movies and TV shows`);
}

export function isIndexableHost(host: string | null): boolean {
  return (host ?? INDEXABLE_HOST).split(',')[0].trim().toLowerCase() === INDEXABLE_HOST;
}

export function staticPageTitle(page: StaticPage): string {
  return page === 'home' ? HOME_TITLE : pageTitle(STATIC_PAGE_NAMES[page]);
}

export function staticMetadata(page: StaticPage, host: string | null): PageMetadata {
  const indexable = isIndexableHost(host);
  if (page !== 'home') {
    return {title: staticPageTitle(page), robots: {index: false, follow: indexable}};
  }
  const canonical = `${SITE_ORIGIN}/`;
  return {
    title: HOME_TITLE,
    description: HOME_DESCRIPTION,
    ...(indexable ? {} : {robots: {index: false, follow: false}}),
    alternates: {canonical},
    openGraph: {
      title: HOME_TITLE,
      description: HOME_DESCRIPTION,
      url: canonical,
      siteName: APP_NAME,
      type: 'website',
      images: [{url: OG_IMAGE_URL}],
    },
    twitter: {card: 'summary_large_image', title: HOME_TITLE, description: HOME_DESCRIPTION, images: [OG_IMAGE_URL]},
  };
}
