package io.github.kunal26das.yify.movies.data.mapper

import io.github.kunal26das.yify.movies.data.dto.MovieDto
import io.github.kunal26das.yify.movies.domain.model.Movie

internal class MovieMapper(
    private val genreMapper: GenreMapper,
) {
    fun toMovie(movieDto: MovieDto) = Movie(
        id = movieDto.id,
        backgroundImageOriginalUrl = movieDto.backgroundImageOriginal.orEmpty(),
        backgroundImageUrl = movieDto.backgroundImage.orEmpty(),
        largeCoverImageUrl = movieDto.largeCoverImage.orEmpty(),
        mediumCoverImageUrl = movieDto.mediumCoverImage.orEmpty(),
        smallCoverImageUrl = movieDto.smallCoverImage.orEmpty(),
        dateUploaded = movieDto.dateUploadedUnix ?: 0,
        description = movieDto.descriptionFull.orEmpty(),
        genres = genreMapper.toGenres(movieDto.genres),
        imdbCode = movieDto.imdbCode.orEmpty(),
        mpaRating = movieDto.mpaRating.orEmpty(),
        peers = movieDto.torrentDtos.maxPeers,
        quality = movieDto.torrentDtos.bestQuality,
        rating = movieDto.rating?.toFloat() ?: 0f,
        runtime = movieDto.runtime ?: 0,
        seeds = movieDto.torrentDtos.maxSeeds,
        slug = movieDto.slug.orEmpty(),
        state = movieDto.state.orEmpty(),
        summary = movieDto.summary.orEmpty(),
        synopsis = movieDto.synopsis.orEmpty(),
        title = movieDto.title.orEmpty(),
        titleEnglish = movieDto.titleEnglish.orEmpty(),
        titleLong = movieDto.titleLong.orEmpty(),
        torrents = movieDto.torrentDtos.toTorrents(movieDto.id),
        url = movieDto.url.orEmpty(),
        year = movieDto.year,
        youtubeTrailerCode = movieDto.youtubeTrailerCode.orEmpty(),
    )

    fun toMovies(
        movies: List<MovieDto>?
    ): List<Movie> {
        return movies?.map {
            toMovie(it)
        } ?: emptyList()
    }
}