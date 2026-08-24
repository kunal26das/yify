import type {Dependencies} from '@/domain';
import {publishNotificationSettings} from '../services/NewMoviesNotifierImpl';
import {getAccountLink} from './container';

export function bootstrap(dependencies: Dependencies): void {
    void dependencies.appConfig.init();
    dependencies.auth.init();
    void dependencies.purchases.init();
    void dependencies.ads.init();
    dependencies.accountSync.start();
    getAccountLink()?.start();
    void dependencies.storeServices.start();
    dependencies.appUpdates.start();
    void dependencies.newMovies.hasPermission().then((granted) => {
        if (granted) void dependencies.newMovies.register();
    });
    publishNotificationSettings(dependencies.preferences.getPreferences());
    dependencies.preferences.subscribe(() =>
        publishNotificationSettings(dependencies.preferences.getPreferences())
    );
}
