# Streaming services

Users save services and extra channels separately for each viewing country. These choices sync with their Yify account; they do not connect or verify a streaming account. Official apps and websites keep responsibility for sign-in, profiles and playback access.

Android and iOS open HTTPS title links through the operating system, with a browser fallback if opening fails. Web opens the official title page in a separate tab without an opener. Provider-specific app launching still needs device verification; an HTTPS title link does not guarantee native app launch or autoplay.

## Data and configuration

The Streaming Availability API supplies supported countries, services, add-ons and title offers. Configure `YIFY_STREAMING_API_KEY` as a sensitive, server-only EAS Hosting environment variable. Never prefix it with `EXPO_PUBLIC_`, put it in Remote Config, or include it in a client build. Native apps and both web deployments call the public Yify API; only the server calls the provider.

- `GET /api/streaming/countries`
- `GET /api/streaming/title?imdbId=tt0068646&country=US`

Missing credentials, timeouts and quota errors return unavailable. They do not mean there are no offers. Countries outside the provider's live coverage remain selectable through existing regional viewing options, but direct links and service-based matching report the coverage gap. Existing TMDB/JustWatch viewing options remain a fallback. Their commercial licensing must be confirmed independently.

Coverage comes from the authenticated `/v4/countries` response, not a hard-coded service or country list. The public provider sample used in validation contains 65 countries; it is not evidence of a configured production account or complete coverage of every Yify market. Compare the activated account's coverage with the required release markets before advertising universal coverage. Additional licensed sources may be needed.

## Requests and quotas

The provider's free commercial plan currently permits 1,000 upstream requests per month. Its hard quota prevents overage charges. Verify current pricing before activation or a paid upgrade.

Country data is cached for seven days on the server, and title data for 24 hours. Successful public responses use CDN caching; title cache lifetime is bounded by its original check time. Clients persist recent title results for up to 24 hours and coalesce identical requests. Watchlist scrolling makes no availability requests. An explicit check handles at most 20 unique titles with two concurrent requests.

`YIFY_STREAMING_UPSTREAM_REQUESTS_PER_DAY` defaults to 25 per server instance. This and admission limits are best-effort protections, not a distributed monthly quota. Cold starts or multiple instances can exceed that local budget. Monitor the provider's actual monthly usage; a paid production rollout should use an appropriate plan and shared durable cache/budget if needed.

The watchlist's “On my services” filter only matches explicit subscription/free offers or an explicitly selected extra channel. Rentals and purchases never match merely because the base service was selected. Unchecked and unavailable titles remain distinguishable; a link click never marks a film watched.

## Release checks

1. Activate the API account and configure the server secret; deploy the API before clients using it.
2. Verify live country/service coverage, attribution, several supported-country title responses and unsupported/error states.
3. Check Android and iOS installed-app and browser fallback behavior, and web title-page opening. Include login/profile prompts, extra channels and unavailable regional titles.
4. Verify service preferences survive restart and sync, including country changes and switching Yify accounts.

Sources: [pricing](https://www.movieofthenight.com/about/api/pricing), [terms](https://developers.movieofthenight.com/terms-and-conditions), [country API](https://docs.movieofthenight.com/resource/countries), [official schema](https://github.com/movieofthenight/streaming-availability-api/blob/main/openapi.yaml).
