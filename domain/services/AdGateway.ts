import type {AdTrigger} from '../policies/adGating';

export interface AdGateway {
    readonly supported: boolean;

    init(): Promise<void>;

    show(trigger: AdTrigger): Promise<void> | null;

    privacyOptionsRequired(): boolean;

    showPrivacyOptions(): Promise<void>;
}
