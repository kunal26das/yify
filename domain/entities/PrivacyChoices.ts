export const PRIVACY_NOTICE_VERSION = '2026-09-25-v2';

export interface PrivacyChoices {
    readonly adultConfirmed: boolean;
    readonly analytics: boolean;
    readonly youtube: boolean;
    readonly updatedAt: string | null;
    readonly noticeVersion: string;
}

export const DEFAULT_PRIVACY_CHOICES: PrivacyChoices = Object.freeze({
    adultConfirmed: false,
    analytics: false,
    youtube: false,
    updatedAt: null,
    noticeVersion: PRIVACY_NOTICE_VERSION,
});
