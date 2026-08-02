export interface NewMoviesNotifier {
    hasPermission(): Promise<boolean>;

    requestPermission(): Promise<boolean>;

    register(): Promise<void>;

    check(force?: boolean): Promise<number>;
}
