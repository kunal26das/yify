export interface AvailabilityPush {
    supported(): Promise<boolean>;
    register(): Promise<{kind: 'expo' | 'fcm'; token: string}>;
    unregister(): Promise<void>;
}

export interface AvailabilityAlertState {
    ready: boolean;
    available: boolean;
    enabled: boolean;
    pending: boolean;
    error: string | null;
}

export const INITIAL_AVAILABILITY_ALERT_STATE: AvailabilityAlertState = {
    ready: false, available: false, enabled: false, pending: false, error: null,
};

export interface AvailabilityAlerts {
    getState(): AvailabilityAlertState;
    subscribe(listener: () => void): () => void;
    start(): void;
    refresh(country: string): Promise<void>;
    enable(country: string): Promise<boolean>;
    disable(): Promise<boolean>;
}
