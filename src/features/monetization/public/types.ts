import type {MediaType} from '@/core/domain/keys';
import type {CardSurface} from '@/core/ui/components/MediaCard';

export type PlusStatus = 'unknown' | 'free' | 'plus';

export type PlusStore = 'play_store' | 'rc_billing' | 'other';

export interface EntitlementSnapshot {
  active: boolean;
  productId: string | null;
  store: PlusStore | null;
  expiresAt: string | null;
  willRenew: boolean;
  billingIssue: boolean;
  managementUrl: string | null;
}

export interface PlusEntitlement extends EntitlementSnapshot {
  status: PlusStatus;
  source: 'none' | 'cache' | 'store';
  appUserId: string | null;
  checkedAt: number | null;
}

export type PaywallPlacement = 'you_card' | 'plus_route' | 'list_limit' | 'insights' | 'ad_free_row' | 'accent_theme';

export type TitleOpenSource = 'tap' | 'deep_link';

export interface OpenTitleInput {
  source: TitleOpenSource;
  surface: CardSurface | 'deep_link';
  contentType: MediaType;
  contentId: number;
  title: string;
  posterPath: string | null;
}

export type OpenTitle = (navigate: () => void, input: OpenTitleInput) => void;

export const PLUS_ENTITLEMENT = 'remove_ads';

export const FREE_CUSTOM_LIST_LIMIT = 3;
