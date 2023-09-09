package io.github.kunal26das.yify.domain.repo

import io.github.kunal26das.yify.domain.model.Genre
import io.github.kunal26das.yify.domain.model.Movie
import io.github.kunal26das.yify.domain.model.OrderBy
import io.github.kunal26das.yify.domain.model.Quality
import io.github.kunal26das.yify.domain.model.SortBy

interface MovieRepository {

    suspend fun getMoviesCount(genre: Genre?): Int

    suspend fun getMovies(
        limit: Int,
        page: Int,
        quality: Quality? = null,
        minimumRating: Int? = null,
        queryTerm: String? = null,
        genre: Genre? = null,
        sortBy: SortBy? = null,
        orderBy: OrderBy? = null,
        withRtRating: Boolean? = null,
    ): List<Movie>

    suspend fun getMovie(movieId: Int): Movie?
}