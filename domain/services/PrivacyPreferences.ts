import type {PrivacyChoices} from '../entities/PrivacyChoices';

export interface PrivacyPreferences {
    getChoices(): PrivacyChoices;
    subscribe(listener: () => void): () => void;
    updateChoices(choices: Pick<PrivacyChoices, 'adultConfirmed' | 'analytics'> & {youtube?: boolean}): void;
}
