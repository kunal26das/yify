package io.github.kunal26das.yify.domain.repo

import androidx.paging.PagingSource
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference

interface MovieRepository {

    suspend fun getLocalMoviesCount(): Int

    suspend fun getRemoteMoviesCount(): Int

    suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference? = null
    ): Result<List<Movie>>

    suspend fun getLocalMovie(movieId: Int): Movie?

    suspend fun getRemoteMovie(movieId: Int): Result<Movie?>

    suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>>

    fun getMoviesSource(moviePreference: MoviePreference?): PagingSource<Int, MovieEntity>
}