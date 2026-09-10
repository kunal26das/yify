# Movie discovery competitive review

Checked **11 September 2026**. This review compares official store descriptions, not installed-app behavior. Features are developer claims unless the local code audit confirms them. Google Play pages were reviewed in the US-facing web storefront, except ytzm in India; a listing does not establish eligibility for every device or account. Apple checks covered US and India. Prices, ratings and download counts are omitted because they vary by storefront and time.

## Google Play candidates

| App and developer | Advertised comparison points | Implication for Yify |
| --- | --- | --- |
| [YTS: YIFY Movies & Series — KIPKOECH DVPT](https://play.google.com/store/apps/details?id=com.seriesandmovies.tysfyeseries) | Upcoming titles, cast, characters, production details, seasons/episodes, trailers and favorites; describes itself as discovery only. | Broader title context and upcoming discovery. Episode information is not verified episode-progress tracking. |
| [YTS Movies — RubyArdy](https://play.google.com/store/apps/details?id=com.yts.moviestrailler) | Trending/upcoming discovery, actor and genre search, official trailers and favorites; says it does not host full movies. | Improve finding a title through people and interests. |
| [Yify : Film & Series — northcoveapps](https://play.google.com/store/apps/details?id=com.yify.moviescataloguearchive) | Actor search, genre/rating/year/popularity filters, personalized picks, similar titles, watched state and custom collections. | Closest advertised organization benchmark; personalization quality is untested. |
| [JustWatch – Streaming Guide — JustWatch GmbH](https://play.google.com/store/apps/details?id=com.justwatch.justwatch) | Preferred-service filters, legal viewing availability, provider release timeline, price drops and synchronized watchlist. | Make saved discoveries actionable through regional viewing options. |
| [ytzm \| YTS movies — Devloop Inc. LK](https://play.google.com/store/apps/details?id=com.devloop.ytzm) | Genre, rating and release-date browsing; movie details. Also advertises downloads. | Compare discovery features only; download functionality is excluded from this roadmap. |
| [Y Movies – YTS Movies Library — Hosam Azzam](https://play.google.com/store/apps/details?id=com.freeapps.hosamazzam.ymovies) | Advanced search/filtering, trailers and screenshots; listing last updated in 2021. Also advertises torrent/magnet features. | Useful as a basic catalog reference; those download actions are excluded. |

## Apple App Store candidates

No currently named Yify/YTS movie app was verified through Apple’s US/India searches. Historical names appeared in search indexes, but the checked product pages returned 404. This is a regional verification limit, not a claim of worldwide absence.

| App and developer | Verified storefronts and advertised comparison points |
| --- | --- |
| Movie Streamer — Kaloyan Koravski | [US](https://apps.apple.com/us/app/movie-streamer/id1576081974), [India](https://apps.apple.com/in/app/movie-streamer/id1576081974). Closest verified YTS-related app: catalog discovery through the YTS API; says it contains no movies. Its short description does not establish advanced organization or viewing-provider features. |
| JustWatch – Movies & TV Shows — JustWatch GmbH | [US](https://apps.apple.com/us/app/justwatch-movies-tv-shows/id979227482), [India](https://apps.apple.com/in/app/justwatch-movies-tv-shows/id979227482). Legal subscription/free/ad-supported/rental/purchase offers, service filters, availability updates, daily releases and watchlist sync. |
| Letterboxd — Letterboxd | [US](https://apps.apple.com/us/app/letterboxd/id1054271011), [India](https://apps.apple.com/in/app/letterboxd/id1054271011). Watched state, dated diary, personal ratings/reviews/tags, editable lists and community activity. Paid features include viewing statistics and subscribed-service filters. |
| Movie Tracker: Watchlist — Simone Montalto | [US](https://apps.apple.com/us/app/movie-tracker-watchlist/id6443877426). Custom collections, backlog/watched history, watchlist-based recommendations, viewing options, iCloud sync and widgets. Advertises no account, tracking or ads; free tier is limited. |

## Confirmed gaps and current upgrade

The pre-upgrade app already supported catalog browsing, trailers, saving movies and browsing history. The saved list lacked query, sorting, filtering, watched state and collections. History recorded opened detail pages, not completed viewing. TV titles could not be saved. Provider discovery lacked a country selector, TV placement and complete offer categories. TV failures could appear as “coming soon” or an empty release list; some playback labels did not specify trailers.

The first upgrade implements:

- Explicit watched/unwatched state and named movie collections, with persistence and account synchronization; query, watched/genre/runtime/collection filters, saved/title/rating/year sorting, and a surprise pick from matching unwatched titles.
- Selectable viewing country; movie and TV viewing options; subscription, free, ad-supported, rent and buy categories, including providers outside the old link allowlist.
- Accurate loading/empty/error messages and retries; stale-response protection; independent artwork loading; clear trailer labels. Existing release statistics and informational notices remain.

This addresses concrete gaps; it does not establish superiority over the larger services.

## Remaining priorities

1. **Actor search and filmographies:** follow an actor from a title to their other work.
2. **Separate upcoming/trending TMDB discovery:** avoid treating a release-source catalog as comprehensive movie/TV coverage.
3. **TV watchlists and episode progress:** saved series, watched episodes and a reliable next-episode view.
4. **Title/provider alerts:** notify when a saved title becomes available on selected services; distinguish these from existing catalog notifications.

Proposed measurements, with no baseline or target claimed: trailer-start success after an intentional play; zero-result search rate; saved-title-to-provider-open conversion; and seven-day return rate. Establish denominators and measure the current experience before judging the upgrade.
