package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.MovieDto
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie

val MovieDto.toMovie: Movie
    get() = Movie(
        id = id,
        backgroundImageUrl = backgroundImageOriginal ?: backgroundImage,
        cast = cast.toCast,
        coverImageUrl = largeCoverImage ?: mediumCoverImage ?: smallCoverImage,
        dateUploaded = dateUploadedUnix ?: 0,
        descriptionFull = descriptionFull.orEmpty(),
        descriptionIntro = descriptionIntro.orEmpty(),
        downloadCount = downloadCount ?: 0,
        genres = genres.toGenres,
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
        trailerImageUrl = getYouTubeVideoCoverImageUrl(ytTrailerCode),
        torrents = torrentDtos.toTorrents,
        url = url,
        year = year,
    )

val MovieDto.toEntity: MovieEntity
    get() = MovieEntity(
        id = id,
        backgroundImageUrl = backgroundImageOriginal ?: backgroundImage,
        coverImageUrl = largeCoverImage ?: mediumCoverImage ?: smallCoverImage,
        dateUploaded = dateUploadedUnix,
        descriptionFull = descriptionFull,
        descriptionIntro = descriptionIntro,
        downloadCount = downloadCount,
        imdbCode = imdbCode,
        language = language,
        likeCount = likeCount,
        mpaRating = mpaRating,
        rating = rating?.toFloat(),
        runtime = runtime,
        slug = slug,
        state = state,
        summary = summary,
        synopsis = synopsis,
        title = title,
        titleEnglish = titleEnglish,
        titleLong = titleLong,
        trailerImageUrl = getYouTubeVideoCoverImageUrl(ytTrailerCode),
        url = url,
        year = year,
    )

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
        genres = emptyList(),
        imdbCode = imdbCode.orEmpty(),
        language = language.orEmpty(),
        likeCount = likeCount ?: 0,
        mpaRating = mpaRating.orEmpty(),
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

val List<MovieDto>?.toMovies: List<Movie>
    get() = this?.map { it.toMovie } ?: emptyList()

val List<MovieDto>?.toEntities: List<MovieEntity>
    get() = this?.map { it.toEntity } ?: emptyList()

private fun getYouTubeVideoCoverImageUrl(trailerCode: String?): String? {
    return if (trailerCode.isNullOrEmpty()) null
    else "https://img.youtube.com/vi/$trailerCode/maxresdefault.jpg"
}