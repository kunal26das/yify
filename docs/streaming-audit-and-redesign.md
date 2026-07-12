# Yify — Streaming UX Audit & Redesign

A benchmark of the best movie/TV streaming apps in the world, turned into a concrete
redesign of Yify. Hard constraint honored throughout: **no new external APIs — every
new surface is built from Yify's existing YTS endpoints** (`list_movies`,
`movie_details`, `movie_suggestions`, `movie_parental_guides`).

## What the best apps actually do

**Netflix** — The home screen is the product. A single full-bleed *billboard* hero
rotates featured titles, followed by a stack of horizontal *rails* ("Trending Now",
"New Releases", genre rows) and the signature **ranked Top 10** rail with oversized
numerals. Almost nothing is a flat grid; everything is an editorialized row.

**Apple TV+ / Criterion / Mubi** — Taste and typography. Large expressive display type,
generous negative space, poster-forward layouts, restrained color, cinematic
full-bleed art on detail pages with the title set *over* the artwork rather than beside
a thumbnail.

**Max / Disney+ / Prime Video** — Strong brand hero + rails, prominent primary action
(Play) that stays reachable, clear metadata (year · runtime · rating · maturity), and
"More Like This" / "You May Also Like" recommendations on every detail page.

**Letterboxd / Spotify (discovery patterns)** — Multiple *entry points* into the same
catalog: curated shelves, genre shortcuts, and a fast search that is a distinct
destination, not a filter bolted onto a grid.

## The gap in Yify (before)

Yify was already beautifully crafted — clean architecture, a warm Fraunces + Hanken
type system, liquid-glass UI. But the entire browse experience was **one flat, infinite
poster grid sorted a single way at a time.** There was no hero, no editorial rows, no
sense of "what's worth watching", and `movie_suggestions` (a built-in recommendations
endpoint) was fetched by the repository but never shown. Discovery — the thing the best
apps obsess over — was the weakest link.

## The redesign (mapped to Yify's own API)

| Streaming pattern | Yify implementation | Data source (existing API) |
|---|---|---|
| Rotating billboard hero | `HeroBillboard` — full-bleed backdrop, scrim, title, meta, CTAs, auto-advance | `list_movies` (`backgroundImageUrl` is already returned) |
| Editorial rails | `MovieRail` reusing the existing poster card, one per shelf | `list_movies` with different `sort_by` / `genre` / `quality` |
| Ranked Top 10 | `MovieRail variant="ranked"` with oversized outlined numerals | `list_movies?sort_by=download_count` |
| Curated Home as landing | New `HomeScreen` at `/` (hero + ~9 rails) | `useHomeViewModel` fans out parallel `list_movies` calls |
| Search/Browse as its own destination | Existing grid moves to `/browse`, deep-linked with filters | unchanged view model, now seedable |
| Cinematic detail page | Full-bleed backdrop hero, title over art, prominent **Play Trailer** CTA | `movie_details` (`ytTrailerCode`, screenshots, backdrop) |
| "More Like This" | `More like this` rail on the detail page | `movie_suggestions` (previously unused) |

### Shelves shipped on Home

Featured (hero) · Trending this week · Top rated · Just added · 4K Ultra HD ·
Crowd favourites · plus genre rows (Action, Sci-Fi, Comedy, Horror, Drama). Every shelf
is a different query against the same endpoint — zero new data dependencies.

### Visual / brand decisions

Kept the existing identity (clay-coral accent, Fraunces display + Hanken body,
liquid glass) and extended it rather than replacing it: rail headers in Fraunces,
Netflix-style numerals in the accent/gold family, stronger cinematic scrims, and a
poster treatment consistent between grid, rails, and hero.

## Navigation model

```
/  (index)     → HomeScreen      curated hero + rails (new landing)
/browse        → Browse grid     search + filters (the old home, now deep-linkable)
/movie/[id]    → MovieDetails     cinematic hero + trailer + More like this
```

Home's search pill and every rail's "See all" deep-link into `/browse` with the right
filters pre-applied, so the curated and exploratory surfaces stay connected.
