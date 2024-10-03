package io.github.kunal26das.yify.movies.data.repo

import androidx.paging.PagingSource
import io.github.kunal26das.common.domain.logger.ExceptionLogger
import io.github.kunal26das.yify.movies.data.mapper.GenreMapper
import io.github.kunal26das.yify.movies.data.mapper.MovieMapper
import io.github.kunal26das.yify.movies.data.mapper.key
import io.github.kunal26das.yify.movies.data.service.MovieService
import io.github.kunal26das.yify.movies.data.source.MoviesPagingSource
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.model.OrderBy
import io.github.kunal26das.yify.movies.domain.model.SortBy
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference
import io.github.kunal26das.yify.movies.domain.repo.MovieRepository
import javax.inject.Inject

internal class MovieRepositoryImpl @Inject constructor(
    private val movieService: MovieService,
    private val movieMapper: MovieMapper,
    private val genreMapper: GenreMapper,
    private val exceptionLogger: ExceptionLogger,
) : MovieRepository {

    override suspend fun getMoviesCount(
        moviePreference: MoviePreference?
    ): Result<Long> {
        val result = movieService.getMovies(
            limit = 1,
            page = MovieService.FIRST_PAGE,
            sortBy = SortBy.DateAdded.key,
            orderBy = OrderBy.Descending.key,
            quality = moviePreference?.quality?.key,
            minimumRating = moviePreference?.minimumRating,
            queryTerm = moviePreference?.queryTerm,
            genre = moviePreference?.genre?.let {
                genreMapper.getKey(it)
            }
        )
        return result.map {
            it.dataDto?.movieCount ?: 0
        }
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
            genre = moviePreference?.genre?.let {
                genreMapper.getKey(it)
            },
            sortBy = moviePreference?.sortBy?.key,
            orderBy = moviePreference?.orderBy?.key,
        )
        return result.map {
            movieMapper.toMovies(it.dataDto?.movies)
        }
    }

    override suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>> {
        return movieService.getMovieSuggestions(movieId).map {
            movieMapper.toMovies(it.dataDto?.movies)
        }
    }

    override fun getPagedMovies(
        moviePreference: MoviePreference?,
        onFirstLoad: ((Long) -> Unit)?,
    ): PagingSource<Int, Movie> {
        return MoviesPagingSource(
            movieService = movieService,
            movieMapper = movieMapper,
            genreMapper = genreMapper,
            exceptionLogger = exceptionLogger,
            moviePreference = moviePreference,
            onFirstLoad = onFirstLoad,
        )
    }
}