import type {Movie, Torrent} from '@/domain';
import {trackEvent, trackScreenView} from './analytics';

// Central catalog of every analytics event in the app. All UI code goes
// through these helpers so event names/params stay consistent across platforms.

function movieParams(movie: Pick<Movie, 'id' | 'title'>) {
    return {movie_id: movie.id, movie_title: movie.title};
}

export const Analytics = {
    screenView: trackScreenView,

    // Discovery / impressions
    heroImpression: (movie: Movie, index: number) =>
        trackEvent('hero_impression', {...movieParams(movie), hero_index: index}),
    shelfImpression: (shelfKey: string) => trackEvent('shelf_impression', {shelf_key: shelfKey}),

    // Navigation CTAs
    movieOpen: (movie: Pick<Movie, 'id' | 'title'>, source: string) =>
        trackEvent('select_content', {content_type: 'movie', ...movieParams(movie), source}),
    heroCta: (movie: Movie) => trackEvent('hero_cta', movieParams(movie)),
    searchOpen: (source: string) => trackEvent('search_open', {source}),
    browseAllOpen: (source: string) => trackEvent('browse_all_open', {source}),
    shelfSeeAll: (shelfTitle: string) => trackEvent('shelf_see_all', {shelf_title: shelfTitle}),
    railPage: (railTitle: string, direction: 'back' | 'forward') =>
        trackEvent('rail_page', {rail_title: railTitle, direction}),

    // Browse / search
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

    // Movie details engagement
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

    // System
    notificationOpen: (movieId: number) => trackEvent('notification_open', {movie_id: movieId}),
    retry: (source: 'home' | 'browse' | 'details') => trackEvent('retry', {source}),
    loadError: (source: 'home' | 'browse' | 'details') => trackEvent('load_error', {source}),
};
