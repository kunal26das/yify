import type {MediaType} from '@/core/domain/keys';
import type {SearchType} from '@/core/domain/search';
import {analyticsInstanceId, logAnalyticsEvent, logAnalyticsScreen, setAnalyticsUserProperties} from './analytics';

export type ScreenName = 'home' | 'search' | 'title_movie' | 'title_tv' | 'person' | 'library' | 'you' | 'plus' | 'settings';
export type CardSurface = 'home' | 'search' | 'library' | 'person' | 'similar' | 'other';
export type ContentType = MediaType | 'person';
export type ContentId = `${ContentType}:${number}`;
export type Flag = 0 | 1;
export type PaywallPlacementParam = 'you_card' | 'plus_route' | 'list_limit' | 'insights' | 'ad_free_row' | 'accent_theme';
export type PaywallMode = 'store' | 'play_link' | 'web_checkout';
export type PlusPackage = 'monthly' | 'annual';
export type ProviderMonetization = 'flatrate' | 'free' | 'ads' | 'rent' | 'buy';
export type AdSkipReasonParam =
  | 'disabled' | 'platform' | 'entitlement_unknown' | 'plus' | 'not_tap' | 'trailer'
  | 'session_warmup' | 'frequency' | 'cooldown' | 'consent' | 'offline' | 'not_loaded' | 'stale_ad' | 'show_timeout';
export type SettingName = 'region' | 'theme' | 'accent' | 'services' | 'analytics' | 'trailer_captions';

export type AnalyticsEvent =
  | {name: 'screen_view'; params: {screen_name: ScreenName; screen_class: ScreenName}}
  | {name: 'select_content'; params: {content_type: ContentType; content_id: ContentId; surface: CardSurface | 'deep_link'}}
  | {name: 'search'; params: {query_length: number; result_count: number; scope: SearchType; has_filters: Flag}}
  | {name: 'trailer_start'; params: {content_type: MediaType; content_id: ContentId; surface: 'title' | 'home'}}
  | {name: 'watchlist_add'; params: {content_type: MediaType; content_id: ContentId; surface: CardSurface}}
  | {name: 'watchlist_remove'; params: {content_type: MediaType; content_id: ContentId}}
  | {name: 'watched_add'; params: {content_type: MediaType; has_rating: Flag; has_note: Flag; rewatch: Flag}}
  | {name: 'list_create'; params: {list_count: number; plus: Flag}}
  | {name: 'list_item_add'; params: {content_type: MediaType}}
  | {name: 'watch_provider_open'; params: {content_type: MediaType; content_id: ContentId; provider_id: number; monetization: ProviderMonetization; region: string}}
  | {name: 'share'; params: {method: 'system_sheet' | 'copy_link'; content_type: ContentType; item_id: ContentId}}
  | {name: 'login'; params: {method: 'google'}}
  | {name: 'sign_up'; params: {method: 'google'}}
  | {name: 'paywall_view'; params: {placement: PaywallPlacementParam; mode: PaywallMode; plus: Flag}}
  | {name: 'purchase_start'; params: {package: PlusPackage; placement: PaywallPlacementParam}}
  | {name: 'purchase_result'; params: {result: 'granted' | 'not_granted' | 'cancelled' | 'pending' | 'already_owned' | 'failed'; package: PlusPackage; error_code: string}}
  | {name: 'restore_result'; params: {result: 'restored' | 'none' | 'failed'; reason: 'user' | 'post_login_reconcile'}}
  | {name: 'play_store_open'; params: {placement: PaywallPlacementParam}}
  | {name: 'ad_shown'; params: {placement: 'title_open'; open_ordinal: number}}
  | {name: 'ad_skipped'; params: {reason: AdSkipReasonParam}}
  | {name: 'insights_view'; params: {plus: Flag; period: 'month' | 'year'}}
  | {name: 'setting_change'; params: {setting: SettingName; value: string}}
  | {name: 'store_update'; params: {type: 'flexible' | 'immediate'; result: 'started' | 'declined' | 'installed' | 'failed'}}
  | {name: 'library_migration'; params: {resolved: number; unresolved: number; result: 'ok' | 'partial' | 'failed'}};

export type AnalyticsEventName = AnalyticsEvent['name'];

export const ANALYTICS_EVENT_NAMES: readonly AnalyticsEventName[] = [
  'screen_view', 'select_content', 'search', 'trailer_start', 'watchlist_add', 'watchlist_remove', 'watched_add', 'list_create',
  'list_item_add', 'watch_provider_open', 'share', 'login', 'sign_up', 'paywall_view', 'purchase_start', 'purchase_result',
  'restore_result', 'play_store_open', 'ad_shown', 'ad_skipped', 'insights_view', 'setting_change', 'store_update', 'library_migration',
];

export function contentId(type: ContentType, id: number): ContentId {
  return `${type}:${id}`;
}

export function track(event: AnalyticsEvent): void {
  if (event.name === 'screen_view') {
    logAnalyticsScreen(event.params.screen_name);
    return;
  }
  const params: Record<string, string | number> = {...event.params};
  logAnalyticsEvent(event.name, params);
}

export function trackScreen(screen: ScreenName): void {
  logAnalyticsScreen(screen);
}

export function setUserProperties(properties: {plus?: boolean; signed_in?: boolean}): void {
  const values: Record<string, string> = {};
  if (properties.plus !== undefined) values.plus = String(properties.plus);
  if (properties.signed_in !== undefined) values.signed_in = String(properties.signed_in);
  if (Object.keys(values).length > 0) setAnalyticsUserProperties(values);
}

export function getAppInstanceId(): Promise<string | null> {
  return analyticsInstanceId();
}
