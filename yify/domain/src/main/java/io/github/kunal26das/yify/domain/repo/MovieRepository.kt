package io.github.kunal26das.yify.domain.repo

import androidx.paging.PagingSource
import io.github.kunal26das.yify.domain.entity.MovieEntity
import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.MoviePreference

interface MovieRepository {

    suspend fun getMoviesCount(genre: Genre?): Int

    suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?
    ): Result<List<Movie>>

    fun getMoviesSource(moviePreference: MoviePreference?): PagingSource<Int, MovieEntity>

    suspend fun getMovie(movieId: Int): Result<Movie?>
}