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
import io.github.kunal26das.yify.domain.db.ImmutablePreference
import io.github.kunal26das.yify.domain.db.MutablePreference
import io.github.kunal26das.yify.domain.db.YifyDatabase
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.mapper.toMovie
import io.github.kunal26das.yify.domain.mapper.toTorrents
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference
import io.github.kunal26das.yify.domain.repo.MovieRepository
import javax.inject.Inject
import kotlin.math.max

class MovieRepositoryImpl @Inject constructor(
    private val immutablePreference: ImmutablePreference,
    private val mutablePreference: MutablePreference,
    private val movieService: MovieService,
    private val yifyDatabase: YifyDatabase,
    private val crashLogger: CrashLogger,
) : MovieRepository {

    override suspend fun getLocalMoviesCount(): Int {
        return yifyDatabase.movieDao.getMoviesCount()
    }

    override suspend fun getRemoteMoviesCount(genre: Genre?): Int {
        val result = movieService.getMovies(limit = 1, genre = genre?.key)
        val count = result.getOrNull()?.dataDto?.movieCount ?: 0
        if (result.isSuccess) {
            if (genre != null) {
                mutablePreference.setGenreMovieCount(genre, count)
            } else {
                mutablePreference.setMaxMovieCount(count)
            }
        }
        return count
    }

    override suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?
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
            updateDatabase(it.movies)
            updateMovieCount(it.movieCount ?: 0)
        }.map {
            it.movies.toMovies(
                genreFallback = { genre ->
                    crashLogger.log(UnknownGenreException(genre))
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
            it.dataDto.movie
        }.onSuccess {
            it?.let { updateDatabase(listOf(it)) }
        }.map {
            it?.toMovie()
        }
    }

    override fun getMoviesSource(
        moviePreference: MoviePreference?
    ): PagingSource<Int, MovieEntity> {
        return yifyDatabase.movieDao.getMovies(
            quality = moviePreference?.quality?.name,
            minimumRating = moviePreference?.minimumRating,
            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre,
            sortBy = moviePreference?.sortBy?.name,
//            orderBy = moviePreference?.orderBy?.name,
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

    private suspend fun updateMovieCount(movieCount: Int) {
        val max = max(movieCount, immutablePreference.getMaxMovieCount() ?: 0)
        mutablePreference.setCurrentMovieCount(movieCount)
        mutablePreference.setMaxMovieCount(max)
    }
}