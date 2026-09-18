export interface NewMoviesNotifier {
    hasPermission(): Promise<boolean>;

    permissionStatus?(): Promise<'granted' | 'undetermined' | 'denied' | 'unavailable'>;

    requestPermission(): Promise<boolean>;

    register(): Promise<void>;

    check(force?: boolean): Promise<number>;
}
