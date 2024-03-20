package io.github.kunal26das.yify.movies.domain.repo

import io.github.kunal26das.yify.movies.domain.model.Movie
import io.github.kunal26das.yify.movies.domain.preference.MoviePreference

interface MovieRepository {

    suspend fun getMoviesCount(): Result<Long?>

    suspend fun getMovies(
        limit: Int,
        page: Int,
        moviePreference: MoviePreference?
    ): Result<List<Movie>>

    suspend fun getMovieSuggestions(movieId: Int): Result<List<Movie>>
}