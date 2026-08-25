import type {AnalyticsSink, Movie, Torrent} from '@/domain';

let sink: AnalyticsSink | null = null;

export function installAnalyticsSink(next: AnalyticsSink): void {
    sink = next;
}

function trackEvent(name: string, params?: Record<string, string | number | boolean>): void {
    sink?.trackEvent(name, params);
}

function trackScreenView(screenName: string): void {
    sink?.trackScreenView(screenName);
}

function movieParams(movie: Pick<Movie, 'id' | 'title'>) {
    return {movie_id: movie.id, movie_title: movie.title};
}

export const Analytics = {
    screenView: trackScreenView,

    heroImpression: (movie: Movie, index: number) =>
        trackEvent('hero_impression', {...movieParams(movie), hero_index: index}),
    shelfImpression: (shelfKey: string) => trackEvent('shelf_impression', {shelf_key: shelfKey}),

    movieOpen: (movie: Pick<Movie, 'id' | 'title'>, source: string) =>
        trackEvent('select_content', {content_type: 'movie', ...movieParams(movie), source}),
    heroCta: (movie: Movie) => trackEvent('hero_cta', movieParams(movie)),
    heroMoreInfo: (movie: Movie) => trackEvent('hero_more_info', movieParams(movie)),
    heroTrailerAutoplay: (movie: Pick<Movie, 'id' | 'title'>) =>
        trackEvent('hero_trailer_autoplay', movieParams(movie)),
    heroMuteToggle: (movie: Pick<Movie, 'id' | 'title'>, muted: boolean) =>
        trackEvent('hero_mute_toggle', {...movieParams(movie), muted}),
    navSelect: (destination: string) => trackEvent('nav_select', {destination}),
    playStoreOpen: (source: string) => trackEvent('play_store_open', {source}),
    footerLink: (destination: string) => trackEvent('footer_link', {destination}),
    settingChanged: (setting: string, value: string) =>
        trackEvent('setting_changed', {setting, value}),
    posterHoverCard: (movie: Pick<Movie, 'id' | 'title'>, source: string) =>
        trackEvent('poster_hover_card', {...movieParams(movie), source}),
    searchOpen: (source: string) => trackEvent('search_open', {source}),
    browseAllOpen: (source: string) => trackEvent('browse_all_open', {source}),
    shelfSeeAll: (shelfTitle: string) => trackEvent('shelf_see_all', {shelf_title: shelfTitle}),
    genreOpen: (genre: string) => trackEvent('genre_open', {genre}),
    websiteOpen: (source: string) => trackEvent('website_open', {source}),
    railPage: (railTitle: string, direction: 'back' | 'forward') =>
        trackEvent('rail_page', {rail_title: railTitle, direction}),

    search: (term: string, resultCount?: number) =>
        trackEvent('search', {search_term: term, ...(resultCount != null ? {result_count: resultCount} : {})}),
    searchCleared: () => trackEvent('search_cleared'),
    filtersOpen: () => trackEvent('filters_open'),
    filtersApplied: (filters: Record<string, string | number | undefined>) =>
        trackEvent('filters_applied', Object.fromEntries(
            Object.entries(filters).filter(([, v]) => v != null) as [string, string | number][],
        )),
    filtersReset: () => trackEvent('filters_reset'),
    browseLoadMore: (loadedCount: number) => trackEvent('browse_load_more', {loaded_count: loadedCount}),
    scrollToTop: () => trackEvent('browse_scroll_to_top'),

    trailerPlay: (movie: Pick<Movie, 'id' | 'title'>) => trackEvent('trailer_play', movieParams(movie)),
    trailerClose: (movie: Pick<Movie, 'id' | 'title'>) => trackEvent('trailer_close', movieParams(movie)),
    watchlistAdd: (movie: Pick<Movie, 'id' | 'title'>) => trackEvent('watchlist_add', movieParams(movie)),
    watchlistRemove: (movie: Pick<Movie, 'id' | 'title'>) => trackEvent('watchlist_remove', movieParams(movie)),
    screenshotOpen: (movieId: number, index: number) =>
        trackEvent('screenshot_open', {movie_id: movieId, screenshot_index: index}),
    torrentTap: (movieId: number, torrent: Torrent) =>
        trackEvent('torrent_tap', {
            movie_id: movieId,
            quality: torrent.quality,
            type: torrent.type ?? '',
            size: torrent.size,
        }),
    torrentNoticeDismissed: (movieId: number) => trackEvent('torrent_notice_dismissed', {movie_id: movieId}),

    shareOpen: (movieId: number) => trackEvent('share_open', {movie_id: movieId}),
    watchProviderOpen: (movieId: number, region: string) =>
        trackEvent('watch_provider_open', {movie_id: movieId, region}),

    playerMinimize: (movie: Pick<Movie, 'id' | 'title'>) =>
        trackEvent('player_minimize', movieParams(movie)),
    playerMaximize: (movie: Pick<Movie, 'id' | 'title'>) =>
        trackEvent('player_maximize', movieParams(movie)),
    playerQueueAdvance: (movie: Pick<Movie, 'id' | 'title'>) =>
        trackEvent('player_queue_advance', movieParams(movie)),
    playerPip: (movie: Pick<Movie, 'id' | 'title'>, active: boolean) =>
        trackEvent('player_pip', {...movieParams(movie), active}),

    feedChipSelect: (chipKey: string, surface: string) =>
        trackEvent('feed_chip_select', {chip_key: chipKey, surface}),

    showsImpression: (count: number) => trackEvent('shows_impression', {show_count: count}),
    showsUnavailable: () => trackEvent('shows_unavailable'),

    signIn: (method: string) => trackEvent('login', {method}),
    signInFailed: (method: string, reason: string) =>
        trackEvent('login_failed', {method, reason}),
    signOut: () => trackEvent('logout'),

    supporterPrompt: (source: string) => trackEvent('supporter_prompt', {source}),
    coffeeOpen: (source: string) => trackEvent('coffee_open', {source}),

    notificationOpen: (movieId: number) => trackEvent('notification_open', {movie_id: movieId}),
    retry: (source: 'home' | 'browse' | 'browse_more' | 'details' | 'shows') =>
        trackEvent('retry', {source}),
    loadError: (source: 'home' | 'browse' | 'details' | 'shows') => trackEvent('load_error', {source}),
};
