package io.github.kunal26das.yify.data.mapper

import io.github.kunal26das.yify.data.dto.MovieDto
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.Quality
import javax.inject.Inject

internal class MovieMapper @Inject constructor(
    private val languageMapper: LanguageMapper,
    private val genreMapper: GenreMapper,
) {
    fun toMovie(movieDto: MovieDto) = Movie(
        id = movieDto.id,
        backgroundImageUrl = movieDto.backgroundImageOriginal ?: movieDto.backgroundImage,
        coverImageUrl = movieDto.largeCoverImage ?: movieDto.mediumCoverImage
        ?: movieDto.smallCoverImage,
        dateUploaded = movieDto.dateUploadedUnix ?: 0,
        description = movieDto.descriptionFull.orEmpty(),
        genres = genreMapper.toGenres(movieDto.genres),
        imdbCode = movieDto.imdbCode.orEmpty(),
        language = languageMapper.toLanguage(movieDto.language),
        mpaRating = movieDto.mpaRating.orEmpty(),
        peers = movieDto.torrentDtos.maxPeers,
        quality = movieDto.torrentDtos.bestQuality ?: Quality.Unknown,
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
        url = movieDto.url,
        year = movieDto.year,
        youtubeTrailerCode = movieDto.youtubeTrailerCode,
    )

    fun toEntity(movieDto: MovieDto) = MovieEntity(
        id = movieDto.id,
        backgroundImageUrl = movieDto.backgroundImageOriginal ?: movieDto.backgroundImage,
        coverImageUrl = movieDto.largeCoverImage ?: movieDto.mediumCoverImage
        ?: movieDto.smallCoverImage,
        dateUploaded = movieDto.dateUploadedUnix,
        description = movieDto.descriptionFull,
        genres = genreMapper.toGenres(movieDto.genres),
        imdbCode = movieDto.imdbCode,
        language = languageMapper.toLanguage(movieDto.language),
        mpaRating = movieDto.mpaRating,
        peers = movieDto.torrentDtos.maxPeers,
        quality = movieDto.torrentDtos.bestQuality,
        rating = movieDto.rating?.toFloat(),
        runtime = movieDto.runtime,
        seeds = movieDto.torrentDtos.maxSeeds,
        slug = movieDto.slug,
        state = movieDto.state,
        summary = movieDto.summary,
        synopsis = movieDto.synopsis,
        title = movieDto.title,
        titleEnglish = movieDto.titleEnglish,
        titleLong = movieDto.titleLong,
        url = movieDto.url,
        year = movieDto.year,
        youtubeTrailerCode = movieDto.youtubeTrailerCode,
    )

    fun toMovies(
        movies: List<MovieDto>?
    ): List<Movie> {
        return movies?.map {
            toMovie(it)
        } ?: emptyList()
    }

    fun toEntities(movieDtos: List<MovieDto>?): List<MovieEntity> {
        return movieDtos?.map { toEntity(it) } ?: emptyList()
    }
}