package io.github.kunal26das.yify.domain.mapper

import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.Torrent

fun MovieEntity.toMovie(
    torrents: List<Torrent> = emptyList(),
): Movie = Movie(
    id = id,
    backgroundImageUrl = backgroundImageUrl,
    coverImageUrl = coverImageUrl,
    dateUploaded = dateUploaded ?: 0,
    description = descriptionFull.orEmpty(),
    genres = genres.orEmpty(),
    imdbCode = imdbCode.orEmpty(),
    languageCode = language.orEmpty(),
    mpaRating = mpaRating.orEmpty(),
    quality = quality ?: Quality.Unknown,
    rating = rating ?: 0f,
    runtime = runtime ?: 0,
    slug = slug.orEmpty(),
    state = state.orEmpty(),
    summary = summary.orEmpty(),
    synopsis = synopsis.orEmpty(),
    title = title.orEmpty(),
    titleEnglish = titleEnglish.orEmpty(),
    titleLong = titleLong.orEmpty(),
    torrents = torrents,
    trailerImageUrl = getYouTubeVideoCoverImageUrl(youtubeTrailerCode),
    url = url,
    year = year,
    youtubeTrailerUrl = getYouTubeVideoUrl(youtubeTrailerCode),
)

val List<MovieEntity>?.toMovies
    get() = this?.map { it.toMovie() }.orEmpty()

fun getYouTubeVideoCoverImageUrl(trailerCode: String?): String? {
    return if (trailerCode.isNullOrEmpty()) null
    else "https://img.youtube.com/vi/$trailerCode/maxresdefault.jpg"
}

fun getYouTubeVideoUrl(trailerCode: String?): String? {
    return if (trailerCode.isNullOrEmpty()) null
    else "https://www.youtube.com/watch?v=$trailerCode"
}