package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.model.MovieModel
import io.github.kunal26das.yify.domain.model.Movie

val MovieModel.toMovie: Movie
    get() = Movie(
        backgroundImageUrl = backgroundImageOriginal ?: backgroundImage,
        cast = cast.toCast,
        coverImage = largeCoverImage ?: mediumCoverImage ?: smallCoverImage,
        dateUploaded = dateUploadedUnix ?: 0,
        descriptionFull = descriptionFull.orEmpty(),
        descriptionIntro = descriptionIntro.orEmpty(),
        downloadCount = downloadCount ?: 0,
        genres = genres ?: emptyList(),
        imdbCode = imdbCode.orEmpty(),
        language = language.orEmpty(),
        likeCount = likeCount ?: 0,
        mpaRating = mpaRating.orEmpty(),
        rating = rating?.toFloat() ?: 0f,
        runtime = runtime ?: 0,
        slug = slug.orEmpty(),
        state = state.orEmpty(),
        screenshotUrls = listOfNotNull(
            largeScreenshotImage1 ?: mediumScreenshotImage1,
            largeScreenshotImage2 ?: mediumScreenshotImage2,
            largeScreenshotImage3 ?: mediumScreenshotImage3,
        ),
        summary = summary.orEmpty(),
        synopsis = synopsis.orEmpty(),
        title = title.orEmpty(),
        titleEnglish = titleEnglish.orEmpty(),
        titleLong = titleLong.orEmpty(),
        trailerImageUrl = ytTrailerCode?.let { "https://img.youtube.com/vi/$it/maxresdefault.jpg" },
        torrents = torrentModels.toTorrents,
        url = url,
        year = year,
    )

val List<MovieModel>?.toMovies: List<Movie>
    get() = this?.map { it.toMovie } ?: emptyList()