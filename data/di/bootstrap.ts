import type {Dependencies} from '@/domain';
import {getAccountLink} from './container';

export function bootstrap(dependencies: Dependencies): void {
    void dependencies.appConfig.init();
    dependencies.auth.init();
    void dependencies.purchases.init();
    dependencies.accountSync.start();
    getAccountLink()?.start();
    void dependencies.storeServices.start();
    dependencies.appUpdates.start();
    void dependencies.newMovies.hasPermission().then((granted) => {
        if (granted) void dependencies.newMovies.register();
    });
}
