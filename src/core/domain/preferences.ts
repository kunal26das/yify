import type {MyServices, RegionCode} from './providers';

export type ThemePreference = 'system' | 'light' | 'dark';
export type Accent = 'default' | 'accent1' | 'accent2' | 'accent3';

export interface Preferences {
  theme: ThemePreference;
  accent: Accent;
  region: RegionCode | null;
  services: MyServices;
  recentPaused: boolean;
  trailerCaptions: boolean;
}

export type PreferenceStamps = Record<keyof Preferences, number>;

export interface PreferencesSectionState {
  values: Preferences;
  stamps: PreferenceStamps;
}

export const DEFAULT_PREFERENCES: Preferences = {
  theme: 'dark',
  accent: 'default',
  region: null,
  services: {},
  recentPaused: false,
  trailerCaptions: false,
};

export interface Consent {
  analytics: boolean;
  youtube: boolean;
  noticeVersion: string;
  decidedAt: string | null;
}

export const V2_NOTICE_VERSION = 'v3';

export const DEFAULT_CONSENT: Consent = {
  analytics: false,
  youtube: false,
  noticeVersion: '',
  decidedAt: null,
};

export function consentPromptDue(consent: Consent): boolean {
  return consent.decidedAt === null || consent.noticeVersion !== V2_NOTICE_VERSION;
}
