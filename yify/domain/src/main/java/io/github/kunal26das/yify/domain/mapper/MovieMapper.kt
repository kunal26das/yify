package io.github.kunal26das.yify.domain.mapper

import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Quality

val MovieEntity.toMovie: Movie
    get() = Movie(
        id = id,
        backgroundImageUrl = backgroundImageUrl,
        cast = emptyList(),
        coverImageUrl = coverImageUrl,
        dateUploaded = dateUploaded ?: 0,
        descriptionFull = descriptionFull.orEmpty(),
        descriptionIntro = descriptionIntro.orEmpty(),
        downloadCount = downloadCount ?: 0,
        genres = genres.orEmpty(),
        imdbCode = imdbCode.orEmpty(),
        language = language.orEmpty(),
        likeCount = likeCount ?: 0,
        mpaRating = mpaRating.orEmpty(),
        quality = quality ?: Quality.Unknown,
        rating = rating ?: 0f,
        runtime = runtime ?: 0,
        screenshotUrls = emptyList(),
        slug = slug.orEmpty(),
        state = state.orEmpty(),
        summary = summary.orEmpty(),
        synopsis = synopsis.orEmpty(),
        title = title.orEmpty(),
        titleEnglish = titleEnglish.orEmpty(),
        titleLong = titleLong.orEmpty(),
        torrents = emptyList(),
        trailerImageUrl = trailerImageUrl,
        url = url,
        year = year,
    )

val List<MovieEntity>?.toMovies
    get() = this?.map { it.toMovie }.orEmpty()