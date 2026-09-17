# Streaming services

Users save their streaming services separately for each viewing country. These preferences sync with their Yify account; they do not connect or verify a streaming account. Selecting a service does not grant access to its catalogue or start playback.

The country picker offers optional, one-time location detection after the user taps “Use current location” and grants permission. Manual selection and the device-region setting remain available if permission is denied, detection times out or the detected country is unsupported. No location request runs on app launch or in the background. Only the resulting country preference is saved and synced.

Android requests approximate foreground location; iOS defaults to reduced accuracy. Native builds use the operating system’s reverse geocoder. Web uses browser geolocation with high accuracy disabled, rounds coordinates to two decimal places and sends them directly to BigDataCloud’s client-side reverse-geocoding endpoint. It sends no account credentials and does not fall back to IP lookup after a denial. The picker explains this sharing before requesting permission. Coordinates are not persisted or sent to Yify analytics or diagnostics. Closing the picker or choosing manually cancels the lookup; late results cannot change the preference.

The native location module requires a new store build with runtime 1.8.4; it cannot be delivered to older binaries by OTA alone. Web geolocation requires HTTPS (or localhost) and a same-origin geolocation Permissions-Policy.

## Data and links

The feature reuses Yify's existing TMDB integration and its JustWatch availability data. No separate availability-provider account, server secret or monthly request allowance is introduced. TMDB's commercial-use licensing must still be verified: its standard free API is for non-commercial use with attribution, and revenue-generating apps require a commercial agreement.

`getCatalog(country)` loads supported countries and requests provider choices for the selected country lazily. Movie and TV provider lists supply the choices; coverage comes from TMDB rather than a fixed country or service list. Extra channels are selectable when TMDB exposes them as distinct providers. Its provider list does not supply a structured relationship between a channel and its parent service.

Title lookups resolve the IMDb identifier through TMDB and read the selected country's subscription, free, ad-supported, rental and purchase offers. Missing configuration or a failed request means unavailable, not an empty successful result. Countries outside the returned coverage remain distinguishable from titles with no reported offers.

TMDB does not provide direct streaming-service deep links. Viewing links open the returned regional TMDB watch page, where users can follow the available provider links. This does not promise a provider app launch or autoplay. Show JustWatch attribution with availability data and retain TMDB's required attribution.

## Requests and caching

Streaming catalogues and title results are cached on the client for up to 24 hours, and identical requests are coalesced. Provider lists are loaded for the selected country rather than fetched for every country. Watchlist scrolling makes no availability requests; an explicit check handles at most 20 unique titles with two concurrent lookups.

The existing TMDB request layer applies timeouts and does not automatically retry HTTP 429 responses. TMDB still applies traffic limits: its documentation describes an approximate upper limit of 40 requests per second, subject to change. The documented limit is not an unlimited-use promise. No new monthly allowance is added by this feature, and existing account or commercial-contract conditions still apply.

The watchlist's “On my services” filter matches selected services with subscription, free or ad-supported offers. Rentals and purchases do not match merely because the service is selected. Unchecked and unavailable titles remain distinguishable; opening viewing options never marks a title watched.

Requests use the app's existing direct TMDB connection. TMDB receives requested title identifiers and country filters where applicable, plus ordinary connection information such as the user's IP address. These requests do not include Yify account credentials or streaming-service credentials. The selected country is also included when opening the regional watch page.

## Release checks

1. Verify the existing TMDB configuration, commercial license and TMDB/JustWatch attribution.
2. Check country-specific provider choices, several movie and TV titles, and unsupported/error states.
3. Verify regional TMDB watch-page opening on web, Android and iOS.
4. Verify preferences survive restart and sync, including country changes and switching Yify accounts.

Sources: [TMDB licensing and attribution](https://developer.themoviedb.org/docs/faq), [traffic limits](https://developer.themoviedb.org/docs/rate-limiting), [supported countries](https://developer.themoviedb.org/reference/watch-providers-available-regions), [provider lists](https://developer.themoviedb.org/reference/watch-providers-movie-list), [availability and link limitations](https://developer.themoviedb.org/reference/movie-watch-providers).
