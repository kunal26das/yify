export interface SupporterNudge {
    recordAdShown(): void;

    shouldPrompt(): boolean;

    recordPrompted(): void;

    recordDeclined(): void;

    recordAccepted(): void;

    recordHomeVisit(): boolean;

    isDiscoveryDismissed(): boolean;

    dismissDiscovery(): void;
}
