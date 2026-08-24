import type {AdGateway} from '@/domain';

export class AdMobAdGateway implements AdGateway {
    readonly supported = false;

    async init(): Promise<void> {
    }

    show(): Promise<void> | null {
        return null;
    }

    privacyOptionsRequired(): boolean {
        return false;
    }

    async showPrivacyOptions(): Promise<void> {
    }
}
