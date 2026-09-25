export const PRIVACY_NOTICE_VERSION = '2026-09-25';

export interface PrivacyChoices {
    readonly adultConfirmed: boolean;
    readonly analytics: boolean;
    readonly updatedAt: string | null;
    readonly noticeVersion: string;
}

export const DEFAULT_PRIVACY_CHOICES: PrivacyChoices = Object.freeze({
    adultConfirmed: false,
    analytics: false,
    updatedAt: null,
    noticeVersion: PRIVACY_NOTICE_VERSION,
});
