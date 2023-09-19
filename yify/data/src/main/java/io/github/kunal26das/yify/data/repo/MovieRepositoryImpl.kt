package io.github.kunal26das.yify.data.repo

import androidx.paging.PagingSource
import io.github.kunal26das.common.domain.logger.CrashLogger
import io.github.kunal26das.yify.data.UnknownGenreException
import io.github.kunal26das.yify.data.dto.MovieDto
import io.github.kunal26das.yify.data.mapper.key
import io.github.kunal26das.yify.data.mapper.toEntities
import io.github.kunal26das.yify.data.mapper.toMovie
import io.github.kunal26das.yify.data.mapper.toMovies
import io.github.kunal26das.yify.data.service.MovieService
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.mapper.toMovie
import io.github.kunal26das.yify.domain.mapper.toTorrents
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.SortBy
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject

class MovieRepositoryImpl @Inject constructor(
    private val mutablePreference: MutablePreference,
    private val movieService: MovieService,
    private val yifyDatabase: YifyDatabase,
    private val crashLogger: CrashLogger,
) : MovieRepository {

    override suspend fun ping(): Boolean {
        return movieService.getMovies(
            limit = 1,
            page = MovieService.FIRST_PAGE,
        ).onSuccess {
            mutablePreference.setMovieCount(it.dataDto.movieCount ?: 0)
        }.isSuccess
    }

    override suspend fun getLocalMoviesCount(): Int {
        return yifyDatabase.movieDao.getMoviesCount()
    }

    override suspend fun getRemoteMoviesCount(): Result<Int?> {
        val result = movieService.getMovies(
            limit = 1,
            page = MovieService.FIRST_PAGE,
            sortBy = SortBy.DateAdded.key,
            orderBy = OrderBy.Descending.key,
        )
        return result.map {
            it.dataDto.movieCount
        }
    }

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?,
        updateDatabase: Boolean,
    ): Result<List<Movie>> {
        val result = movieService.getMovies(
            limit = limit,
            page = page,
            quality = moviePreference?.quality?.key,
            minimumRating = moviePreference?.minimumRating,
            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre?.key,
            sortBy = moviePreference?.sortBy?.key,
            orderBy = moviePreference?.orderBy?.key,
        )
        return result.map { it.dataDto }.onSuccess {
            if (updateDatabase) {
                updateDatabase(it.movies)
            }
        }.map {
            it.movies.toMovies(
                genreFallback = { genre ->
                    logUnknownGenre(genre)
                }
            )
        }
    }

    override suspend fun getLocalMovie(movieId: Int): Movie? {
        return yifyDatabase.transaction {
            val torrents = torrentDao.getTorrents(movieId).toTorrents
            yifyDatabase.movieDao.getMovie(movieId)?.toMovie(torrents = torrents)
        }
    }

    override suspend fun getRemoteMovie(movieId: Int): Result<Movie?> {
        return movieService.getMovie(movieId).map {
            it.dataDto.movie?.toMovie()
        }
    }

    override suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>> {
        return movieService.getMovieSuggestions(movieId).map {
            it.dataDto.movies.toMovies(
                genreFallback = { genre ->
                    logUnknownGenre(genre)
                }
            )
        }
    }

    override fun getMoviesSource(
        moviePreference: MoviePreference?
    ): PagingSource<Int, MovieEntity> {
        return yifyDatabase.movieDao.getMovies(
            quality = moviePreference?.quality?.value,
            minimumRating = moviePreference?.minimumRating,
//            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre,
            sortBy = moviePreference?.sortBy?.name,
            orderBy = moviePreference?.orderBy?.name,
        )
    }

    private suspend fun updateDatabase(movies: List<MovieDto>?) {
        yifyDatabase.transaction {
            movieDao.upsert(movies.toEntities)
            movies?.flatMap {
                it.torrentDtos.toEntities(it.id)
            }?.let {
                torrentDao.upsert(it)
            }
        }
    }

    private fun logUnknownGenre(genre: String) {
        crashLogger.log(UnknownGenreException(genre))
    }
}