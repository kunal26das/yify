import type {Dependencies} from '@/domain';
import {publishNotificationSettings, refreshMovieNotificationContent} from '../services/NewMoviesNotifierImpl';
import {getAccountLink} from './container';

const started = new WeakSet<Dependencies>();

export function bootstrap(dependencies: Dependencies): void {
    if (!dependencies.privacy.getChoices().adultConfirmed || started.has(dependencies)) return;
    started.add(dependencies);
    void dependencies.appConfig.init();
    dependencies.auth.init();
    void dependencies.purchases.init();
    void dependencies.ads.init();
    dependencies.accountSync.start();
    getAccountLink()?.start();
    void dependencies.storeServices.start();
    dependencies.appUpdates.start();
    void dependencies.newMovies.register().catch(error =>
        dependencies.diagnostics.capture(error, 'notifications.register')
    );
    publishNotificationSettings(dependencies.preferences.getPreferences());
    dependencies.preferences.subscribe(() =>
        publishNotificationSettings(dependencies.preferences.getPreferences())
    );
    dependencies.watchlist.subscribe(refreshMovieNotificationContent);
    dependencies.library.subscribe(refreshMovieNotificationContent);
    dependencies.availabilityAlerts?.start();
    dependencies.journal?.start();
}
