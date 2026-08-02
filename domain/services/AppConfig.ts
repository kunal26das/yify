export interface AppConfig {
    init(): Promise<void>;

    ready(): Promise<void>;

    error(): string | null;

    getApiBaseUrl(): string;

    getTmdbApiKey(): string;
}
