import type {PrivacyPreferences} from '@/domain';

export function optionalAnalyticsAllowed(privacy?: PrivacyPreferences): boolean {
    try {
        const choices = privacy?.getChoices();
        return choices?.adultConfirmed === true && choices.analytics === true;
    } catch {
        return false;
    }
}
