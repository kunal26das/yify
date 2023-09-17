package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.MovieDto
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.mapper.getYouTubeVideoCoverImageUrl
import io.github.kunal26das.yify.domain.mapper.getYouTubeVideoUrl
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Quality

fun MovieDto.toMovie(
    genreFallback: (String) -> Unit = {},
): Movie = Movie(
    id = id,
    backgroundImageUrl = backgroundImageOriginal ?: backgroundImage,
    coverImageUrl = largeCoverImage ?: mediumCoverImage ?: smallCoverImage,
    dateUploaded = dateUploadedUnix ?: 0,
    description = descriptionFull.orEmpty(),
    genres = genres.toGenres(genreFallback),
    imdbCode = imdbCode.orEmpty(),
    languageCode = language.orEmpty(),
    mpaRating = mpaRating.orEmpty(),
    quality = torrentDtos.bestQuality ?: Quality.Unknown,
    rating = rating?.toFloat() ?: 0f,
    runtime = runtime ?: 0,
    slug = slug.orEmpty(),
    state = state.orEmpty(),
    summary = summary.orEmpty(),
    synopsis = synopsis.orEmpty(),
    title = title.orEmpty(),
    titleEnglish = titleEnglish.orEmpty(),
    titleLong = titleLong.orEmpty(),
    trailerImageUrl = getYouTubeVideoCoverImageUrl(youtubeTrailerCode),
    torrents = torrentDtos.toTorrents,
    url = url,
    year = year,
    youtubeTrailerUrl = getYouTubeVideoUrl(youtubeTrailerCode),
)

val MovieDto.toEntity: MovieEntity
    get() = MovieEntity(
        id = id,
        backgroundImageUrl = backgroundImageOriginal ?: backgroundImage,
        coverImageUrl = largeCoverImage ?: mediumCoverImage ?: smallCoverImage,
        dateUploaded = dateUploadedUnix,
        descriptionFull = descriptionFull,
        genres = genres.toGenres(),
        imdbCode = imdbCode,
        language = language,
        mpaRating = mpaRating,
        peers = torrentDtos?.maxPeers,
        quality = torrentDtos.bestQuality,
        rating = rating?.toFloat(),
        runtime = runtime,
        seeds = torrentDtos?.maxSeeds,
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

fun List<MovieDto>?.toMovies(
    genreFallback: (String) -> Unit = {}
): List<Movie> {
    return this?.map {
        it.toMovie(genreFallback)
    } ?: emptyList()
}

val List<MovieDto>?.toEntities: List<MovieEntity>
    get() = this?.map { it.toEntity } ?: emptyList()