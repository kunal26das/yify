import {createContext, useContext, type ReactNode} from 'react';
import type {
    AccountSync,
    AppConfig,
    AppUpdates,
    AuthRepository,
    NewMoviesNotifier,
    PurchaseRepository,
    Dependencies,
    MovieRepository,
    PreferencesRepository,
    SearchHistoryRepository,
    WatchlistRepository,
    ShowRepository,
    TmdbRepository,
} from '@/domain';

const DependenciesContext = createContext<Dependencies | null>(null);

interface DependenciesProviderProps {
    dependencies: Dependencies;
    children: ReactNode;
}

export function DependenciesProvider({dependencies, children}: DependenciesProviderProps) {
    return (
        <DependenciesContext.Provider value={dependencies}>
            {children}
        </DependenciesContext.Provider>
    );
}

function useDependencies(): Dependencies {
    const dependencies = useContext(DependenciesContext);
    if (dependencies == null) {
        throw new Error('DependenciesProvider is missing above this component');
    }
    return dependencies;
}

export function useMovieRepository(): MovieRepository {
    return useDependencies().movies;
}

export function useShowRepository(): ShowRepository {
    return useDependencies().shows;
}

export function useTmdbRepository(): TmdbRepository {
    return useDependencies().tmdb;
}

export function useAppConfig(): AppConfig {
    return useDependencies().appConfig;
}

export function useAuthRepository(): AuthRepository {
    return useDependencies().auth;
}

export function usePreferencesRepository(): PreferencesRepository {
    return useDependencies().preferences;
}

export function useWatchlistRepository(): WatchlistRepository {
    return useDependencies().watchlist;
}

export function useAppUpdates(): AppUpdates {
    return useDependencies().appUpdates;
}

export function usePurchaseRepository(): PurchaseRepository {
    return useDependencies().purchases;
}

export function useNewMoviesNotifier(): NewMoviesNotifier {
    return useDependencies().newMovies;
}

export function useSearchHistory(): SearchHistoryRepository {
    return useDependencies().searchHistory;
}

export function useAccountSync(): AccountSync {
    return useDependencies().accountSync;
}
