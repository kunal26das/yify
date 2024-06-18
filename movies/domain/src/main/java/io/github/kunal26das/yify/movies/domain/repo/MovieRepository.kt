package io.github.kunal26das.yify.movies.domain.repo

import androidx.paging.PagingSource
import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference

interface MovieRepository {

    suspend fun getMoviesCount(
        moviePreference: MoviePreference?
    ): Result<Long>

    suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?
    ): Result<List<Movie>>

    suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>>

    fun getPagedMovies(
        moviePreference: MoviePreference?,
        onFirstLoad: ((Long) -> Unit)? = null,
    ): PagingSource<Int, Movie>
}