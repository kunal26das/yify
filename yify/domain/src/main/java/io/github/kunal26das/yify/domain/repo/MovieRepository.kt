package io.github.kunal26das.yify.domain.repo

import io.github.kunal26das.yify.domain.model.Movie

interface MovieRepository {
    suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: String? = null,
        minimumRating: Int? = null,
        queryTerm: String? = null,
        genre: String? = null,
        sortBy: String? = null,
        orderBy: String? = null,
        withRtRating: Boolean? = null,
    ): List<Movie>

    suspend fun getMovie(movieId: Int): Movie?
    suspend fun getMovieSuggestions(movieId: Int): List<Movie>
}