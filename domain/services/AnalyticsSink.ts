export type AnalyticsParams = Record<string, string | number | boolean>;

export interface AnalyticsSink {
    trackEvent(name: string, params?: AnalyticsParams): void;

    trackScreenView(screenName: string): void;

    setUserProperty(name: string, value: string | null): void;
}
