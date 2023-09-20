package io.github.kunal26das.yify.domain.mapper

import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Language
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Torrent

fun MovieEntity.toMovie(
    torrents: List<Torrent> = emptyList(),
) = Movie(
    id = id,
    backgroundImageUrl = backgroundImageUrl,
    coverImageUrl = coverImageUrl,
    dateUploaded = dateUploaded ?: 0,
    description = description.orEmpty(),
    genres = genres.orEmpty(),
    imdbCode = imdbCode.orEmpty(),
    language = language ?: Language.Unknown,
    mpaRating = mpaRating.orEmpty(),
    peers = peers ?: 0,
    quality = quality ?: Quality.Unknown,
    rating = rating ?: 0f,
    runtime = runtime ?: 0,
    seeds = seeds ?: 0,
    slug = slug.orEmpty(),
    state = state.orEmpty(),
    summary = summary.orEmpty(),
    synopsis = synopsis.orEmpty(),
    title = title.orEmpty(),
    titleEnglish = titleEnglish.orEmpty(),
    titleLong = titleLong.orEmpty(),
    torrents = torrents,
    url = url,
    year = year,
    youtubeTrailerCode = youtubeTrailerCode,
)

val Movie.toEntity
    get() = MovieEntity(
        id = id,
        backgroundImageUrl = backgroundImageUrl,
        coverImageUrl = coverImageUrl,
        dateUploaded = dateUploaded,
        description = description,
        genres = genres,
        imdbCode = imdbCode,
        language = language,
        mpaRating = mpaRating,
        peers = peers,
        quality = quality,
        rating = rating,
        runtime = runtime,
        seeds = seeds,
        slug = slug,
        state = state,
        summary = summary,
        synopsis = synopsis,
        title = title,
        titleEnglish = titleEnglish,
        titleLong = titleLong,
        url = url,
        year = year,
        youtubeTrailerCode = youtubeTrailerCode,
    )

val List<MovieEntity>?.toMovies
    get() = this?.map { it.toMovie() }.orEmpty()

val List<Movie>?.toEntities
    get() = this?.map { it.toEntity }.orEmpty()